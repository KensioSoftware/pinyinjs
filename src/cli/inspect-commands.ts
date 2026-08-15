/**
 * The subcommands that report what the dictionary and the decoder know.
 *
 * `explain`, `lookup`, `syllable` and `sandhi` all answer questions about a
 * word rather than converting one, and they share the shape of that answer:
 * a decoded reading, the evidence behind it, and what else was on offer.
 */
import { isUncertain } from "../decode/confidence.js";
import { convertPieces, type ConvertedPiece } from "../decode/convert.js";
import { applySandhi } from "../decode/sandhi.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import { readWord, splitSyllables } from "../syllable/split.js";
import {
  readSyllable,
  writeSyllable,
  writeSyllableSpelling,
} from "../syllable/syllable.js";
import { convertOptions, CONVERT_FLAGS } from "./arguments.js";
import { type Painter, PLAIN } from "./colour.js";
import {
  type Command,
  type CommandInput,
  column,
  dictionaryOf,
  paintedPieces,
  type Reported,
  written,
} from "./command.js";

/**
 * How settled a decoded syllable was, in one word.
 *
 * `locked` means no other reading was on offer, `word` that taking one would
 * have meant breaking a dictionary word apart, and `guess` that another reading
 * of the same characters was there for the taking. See ROADMAP.md for how often
 * each turns out to be wrong.
 */
function stateOf(piece: ConvertedPiece): string {
  const { confidence } = piece;
  if (confidence === undefined || confidence.isLocked) {
    return "locked";
  }
  return isUncertain(confidence) ? "guess" : "word";
}

/**
 * What a decode rejected at one syllable, and what rejecting it saved.
 */
function alternativesOf(
  piece: ConvertedPiece,
  input: CommandInput,
): readonly {
  readonly reading: string;
  readonly painted: string;
  readonly cost: number;
}[] {
  const { notation } = convertOptions(input.flags);
  return (piece.confidence?.alternatives ?? []).map((alternative) => {
    const spelled = alternative.reading.map((syllable) =>
      writeSyllable(syllable, notation),
    );
    return {
      reading: spelled.join(""),
      painted: spelled
        .map((text, at) => input.paint(text, alternative.reading[at]?.tone))
        .join(""),
      // Rounded because a cost is a sum of frequency buckets and a per-word
      // charge of 4.62, which lands on 24.620000000000005 often enough to be
      // worth not putting in front of anybody.
      cost: Math.round(alternative.cost * 100) / 100,
    };
  });
}

/**
 * One decoded syllable, as `explain` reports it.
 */
function explainSyllable(
  piece: ConvertedPiece,
  input: CommandInput,
): { readonly line: string; readonly data: unknown } {
  const state = stateOf(piece);
  const alternatives = alternativesOf(piece, input);
  const beaten = alternatives
    .map(
      (alternative) => `${alternative.painted} +${alternative.cost.toFixed(1)}`,
    )
    .join("  ");

  return {
    // The state stays a word. Colour means tone in every command, including
    // this one: two scales on one line and a reader cannot tell which is which.
    line: `  ${column(
      input.paint(piece.text, piece.syllable?.tone),
      8,
    )}${column(state, 8)}${beaten}`.trimEnd(),
    data: {
      text: piece.text,
      state,
      ...(piece.syllable?.tone !== undefined && { tone: piece.syllable.tone }),
      alternatives: alternatives.map(({ reading, cost }) => ({
        reading,
        cost,
      })),
    },
  };
}

/**
 * Show what the decoder chose, syllable by syllable, and what it rejected.
 */
export const EXPLAIN: Command = {
  name: "explain",
  summary: "show each syllable, how settled it was, and what it beat",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS],
  needsDictionary: true,
  run: (input) => {
    const dictionary = dictionaryOf(input);
    const options = convertOptions(input.flags);

    return input.texts.map((text) => {
      const pieces = convertPieces(dictionary, text, options);
      const pinyin = pieces.map((piece) => piece.text).join("");
      const syllables = pieces
        .filter((piece) => piece.syllable !== undefined)
        .map((piece) => explainSyllable(piece, input));

      return {
        lines: [
          `${text}  ${paintedPieces(pieces, input)}`,
          ...syllables.map((syllable) => syllable.line),
        ],
        data: {
          text,
          pinyin,
          syllables: syllables.map((syllable) => syllable.data),
        },
      };
    });
  },
};

/**
 * What the dictionary holds for a word.
 */
function entryFound(
  dictionary: Dictionary,
  word: string,
  paint: Painter,
): Reported {
  const entry = dictionary.lookup(word);
  if (entry === undefined) {
    return {
      lines: [`${word}  not in the dictionary`],
      data: { word, found: false },
    };
  }

  const tags = [
    entry.partOfSpeech,
    entry.isProperNoun ? "proper noun" : "",
  ].filter((tag) => tag !== "");
  const others = dictionary.readingsOf(word).slice(1);

  return {
    lines: [
      `${word}  ${written(entry.reading, paint)}${tags.length > 0 ? `  ${tags.join(", ")}` : ""}`,
      ...(entry.taiwanReading === undefined
        ? []
        : [`  zh-TW  ${written(entry.taiwanReading, paint)}`]),
      ...(others.length > 0
        ? [
            `  also   ${others
              .map((reading) => written(reading, paint))
              .join(", ")}`,
          ]
        : []),
    ],
    data: {
      word,
      found: true,
      reading: written(entry.reading, PLAIN),
      partOfSpeech: entry.partOfSpeech,
      isProperNoun: entry.isProperNoun,
      ...(entry.taiwanReading !== undefined && {
        taiwanReading: written(entry.taiwanReading, PLAIN),
      }),
      otherReadings: others.map((reading) => written(reading, PLAIN)),
    },
  };
}

/**
 * Look words up in the dictionary.
 */
export const LOOKUP: Command = {
  name: "lookup",
  summary: "what the dictionary holds for a word",
  argument: "<word...>",
  flags: [],
  needsDictionary: true,
  run: (input) =>
    input.texts.map((word) =>
      entryFound(dictionaryOf(input), word, input.paint),
    ),
};

/**
 * One written syllable, taken apart.
 */
function syllableTaken(
  spelling: string,
  paint: Painter,
): {
  readonly line: string;
  readonly data: unknown;
} {
  const syllable = readSyllable(spelling);
  /* c8 ignore next 6 -- splitSyllables only ever emits syllables that read */
  if (syllable === undefined) {
    return {
      line: `  ${column(spelling, 10)}not a syllable`,
      data: { spelling },
    };
  }

  const isAttested = DICTIONARY_SYLLABLES.has(
    writeSyllableSpelling({ ...syllable, erhua: false }),
  );
  const parts = [
    `${syllable.initial === "" ? "∅" : syllable.initial} + ${syllable.final}`,
    syllable.tone === undefined ? "no tone" : `tone ${String(syllable.tone)}`,
    ...(syllable.erhua === true ? ["儿化"] : []),
  ];
  const notations = {
    marks: writeSyllable(syllable),
    numbers: writeSyllable(syllable, "numbers"),
    superscript: writeSyllable(syllable, "superscript"),
  };

  return {
    line: `  ${column(paint(spelling, syllable.tone), 10)}${column(
      parts.join(", "),
      22,
    )}${column(
      Object.values(notations)
        .map((written) => paint(written, syllable.tone))
        .join("  "),
      22,
    )}${isAttested ? "" : "not attested"}`.trimEnd(),
    data: {
      spelling,
      initial: syllable.initial,
      final: syllable.final,
      ...(syllable.tone !== undefined && { tone: syllable.tone }),
      erhua: syllable.erhua === true,
      isAttested,
      ...notations,
    },
  };
}

/**
 * Take written pinyin apart, with no dictionary at all.
 */
export const SYLLABLE: Command = {
  name: "syllable",
  summary: "take written pinyin apart, with no dictionary",
  argument: "<pinyin...>",
  flags: [],
  needsDictionary: false,
  run: (input) =>
    input.texts.map((text) => {
      const split = splitSyllables(text);
      if (split === undefined) {
        return {
          lines: [`${text}  not readable as pinyin`],
          data: { text, read: false },
        };
      }
      const taken = split.map((spelling) =>
        syllableTaken(spelling, input.paint),
      );
      return {
        lines: [
          `${text}  ${split
            .map((spelling) =>
              input.paint(spelling, readSyllable(spelling)?.tone),
            )
            .join(" ")}`,
          ...taken.map((syllable) => syllable.line),
        ],
        data: {
          text,
          read: true,
          syllables: taken.map((syllable) => syllable.data),
        },
      };
    }),
};

/**
 * Apply sandhi to written pinyin, with no dictionary at all.
 */
export const SANDHI: Command = {
  name: "sandhi",
  summary: "apply tone sandhi to written pinyin",
  argument: "<pinyin...>",
  flags: ["third-tone", "no-sandhi"],
  needsDictionary: false,
  run: (input) => {
    const options = convertOptions(input.flags).sandhi;
    return input.texts.map((text) => {
      // Whitespace is the only word boundary written pinyin has, and third-tone
      // sandhi needs it: 行長很喜歡 is `hángzhǎng hén xǐhuan`, where a scan that
      // could not see the boundary would lower the 長 as well.
      const words = text
        .split(/\s+/u)
        .filter((part) => part !== "")
        .map((part) => readWord(part));
      if (words.length === 0 || words.some((word) => word === undefined)) {
        return {
          lines: [`${text}  not readable as pinyin`],
          data: { text, read: false },
        };
      }
      const read = words.filter((word) => word !== undefined);
      const said = applySandhi(
        read.flat(),
        options,
        read.map((word) => word.length),
      );
      return {
        lines: [`${text}  ${written(said, input.paint)}`],
        data: { text, read: true, pinyin: written(said, PLAIN) },
      };
    });
  },
};
