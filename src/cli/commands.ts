import { isUncertain } from "../decode/confidence.js";
import {
  convert,
  convertGreedily,
  convertPieces,
  convertPiecesGreedily,
  type ConvertedPiece,
} from "../decode/convert.js";
import { applySandhi, type SandhiOptions } from "../decode/sandhi.js";
import { segment } from "../decode/segment.js";
import { check, type CheckedSyllable } from "../grade/check.js";
import { match, type MatchRange } from "../search/match.js";
import { toCharacters } from "../script/characters.js";
import {
  numeralHanzi,
  type NumeralOptions,
  percentHanzi,
  readNumeralHanzi,
} from "../numerals/numerals.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { convertToAnnotatedHtml, convertToHtml } from "../format/html.js";
import { slug } from "../format/slug.js";
import { toTranscription } from "../format/transcription.js";
import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
} from "../syllable/inventory.js";
import { readWord, splitSyllables } from "../syllable/split.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
  writeSyllableSpelling,
} from "../syllable/syllable.js";
import {
  CHECK_FLAGS,
  checkOptions,
  convertOptions,
  CONVERT_FLAGS,
  htmlOptions,
  MATCH_FLAGS,
  matchQuery,
  SCRIPT_FLAGS,
  scriptFrom,
  scriptTarget,
  SLUG_FLAGS,
  slugOptions,
  transcriptionSystem,
  UsageError,
} from "./arguments.js";
import { type Painter, PLAIN } from "./colour.js";
import { isUncertainChoice, toScriptPieces } from "../decode/script.js";
import type { ScriptTables } from "../script/conversion.js";
import {
  type Command,
  type CommandInput,
  column,
  dictionaryOf,
  paintedPieces,
  type Reported,
  written,
} from "./command.js";
import { systemNamed, TRANSCRIBE } from "./transcribe-command.js";

export type { Command, CommandInput, Reported } from "./command.js";
export {
  type System,
  SYSTEMS,
  systemNamed,
  writtenWith,
} from "./transcribe-command.js";

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
 * Convert each text, one line in and one line out.
 */
const CONVERT: Command = {
  name: "convert",
  summary: "hanzi to pinyin",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS, "greedy", "system"],
  needsDictionary: true,
  run: (input) => {
    const options = convertOptions(input.flags);
    const isGreedy = input.flags.greedy === true;
    const decode = isGreedy ? convertGreedily : convert;
    const inPieces = isGreedy ? convertPiecesGreedily : convertPieces;
    const system = systemNamed(transcriptionSystem(input.flags));
    if (system !== undefined) {
      // hanzi → pinyin → the system, which is the shape ROADMAP.md predicted
      // for the whole of `transcription`. See toTranscription for why the word
      // grouping is shared and only the join is the system's.
      return input.texts.map((text) => {
        const written = toTranscription(
          inPieces(dictionaryOf(input), text, options),
          (syllables) => system.word(syllables, options.notation !== "none"),
          { capitals: system.capitals },
        );
        return {
          lines: [written],
          data: { text, system: system.name, transcription: written },
        };
      });
    }
    return input.texts.map((text) => {
      const pinyin = decode(dictionaryOf(input), text, options);
      // The pieces cost a second sweep of the lattice, so they are only asked
      // for where there is a colour to put on them.
      const written =
        input.paint === PLAIN
          ? pinyin
          : paintedPieces(inPieces(dictionaryOf(input), text, options), input);
      return { lines: [written], data: { text, pinyin } };
    });
  },
};

/**
 * Convert each text to HTML, one element per syllable.
 */
const HTML: Command = {
  name: "html",
  summary: "hanzi to pinyin as HTML, one element per syllable",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS, "no-tone-classes", "no-uncertain", "no-lang"],
  needsDictionary: true,
  run: (input) => {
    const options = htmlOptions(input.flags);
    return input.texts.map((text) => {
      const html = convertToHtml(dictionaryOf(input), text, options);
      return { lines: [html], data: { text, html } };
    });
  },
};

/**
 * Annotate each text: the hanzi, with its reading above.
 *
 * Uncoloured for the same reason `html` is — the classes are the hook, and a
 * terminal escape code inside markup would be pasted into a page.
 */
const ANNOTATE: Command = {
  name: "annotate",
  summary: "hanzi with its pinyin above, as ruby HTML",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS, "no-tone-classes", "no-uncertain", "no-lang"],
  needsDictionary: true,
  run: (input) => {
    const options = htmlOptions(input.flags);
    return input.texts.map((text) => {
      const html = convertToAnnotatedHtml(dictionaryOf(input), text, options);
      return { lines: [html], data: { text, html } };
    });
  },
};

/**
 * Split each text into the words the decoder finds in it.
 *
 * The words on one line, since that is what the answer is, with the reading
 * under each so the split can be read against what it settled. A stretch that
 * was never Han is shown as itself and marked, because it is part of the text
 * and not part of the segmentation.
 */
const SEGMENT: Command = {
  name: "segment",
  summary: "split text into words",
  argument: "[text...]",
  flags: [],
  needsDictionary: true,
  run: (input) =>
    input.texts.map((text) => {
      const found = segment(dictionaryOf(input), text);
      return {
        lines: [
          found.map((one) => one.text).join(" / "),
          // Unpadded, as `lookup` is and for the same reason: a hanzi column
          // cannot be lined up by counting characters, since a terminal draws
          // most of them two cells wide and 。 and Latin one.
          ...found.map(
            (one) =>
              `  ${[
                one.text,
                written(one.reading, input.paint),
                one.isKnown ? one.partOfSpeech : "—",
              ]
                .filter((cell) => cell !== "")
                .join("  ")}`,
          ),
        ],
        data: {
          text,
          words: found.map((one) => ({
            text: one.text,
            at: one.at,
            reading: one.reading
              .map((syllable) => writeSyllable(syllable))
              .join(" "),
            partOfSpeech: one.partOfSpeech,
            isProperNoun: one.isProperNoun,
            isKnown: one.isKnown,
          })),
        },
      };
    }),
};

/**
 * A text with the matched stretches marked, for a terminal.
 *
 * Brackets rather than colour, because the output is as likely to be piped as
 * read: a match is a position, and a position survives being redirected into a
 * file where an escape sequence would only clutter it.
 */
function marked(text: string, ranges: readonly MatchRange[]): string {
  const characters = toCharacters(text);
  const opens = new Set(ranges.map((range) => range.at));
  const closes = new Set(ranges.map((range) => range.at + range.length - 1));
  return characters
    .map(
      (character, at) =>
        `${opens.has(at) ? "[" : ""}${character}${closes.has(at) ? "]" : ""}`,
    )
    .join("");
}

/**
 * Filter texts by a pinyin query, best match first.
 *
 * Ranked rather than left in the order given, because ranking is what the
 * scores are for and a filter nobody can see the order of is a filter that
 * looks arbitrary. Every text still gets a line, matched or not, so that a run
 * over a file says what it did with each of them.
 */
const MATCH: Command = {
  name: "match",
  summary: "filter text by a pinyin query, best first",
  argument: "[text...]",
  flags: [...MATCH_FLAGS],
  needsDictionary: true,
  run: (input) => {
    const query = matchQuery(input.flags);
    const found = input.texts.map((text) => ({
      text,
      match: match(dictionaryOf(input), text, query),
    }));
    const ranked = [
      ...found
        .filter((one) => one.match !== undefined)
        .toSorted(
          (first, second) =>
            (second.match?.score ?? 0) - (first.match?.score ?? 0),
        ),
      ...found.filter((one) => one.match === undefined),
    ];

    return ranked.map((one) => {
      if (one.match === undefined) {
        return {
          lines: [`${one.text}  no match`],
          data: { query, text: one.text, matched: false },
        };
      }
      // Rounded for the reason `explain` rounds a cost: a score is a sum of
      // weights and a fraction, and 6.333333333333333 in a column tells a
      // reader nothing the first two places do not.
      const score = Math.round(one.match.score * 100) / 100;
      return {
        lines: [`${marked(one.text, one.match.ranges)}  ${score.toFixed(2)}`],
        data: {
          query,
          text: one.text,
          matched: true,
          score,
          ranges: one.match.ranges.map((range) => ({
            at: range.at,
            length: range.length,
          })),
        },
      };
    });
  },
};

/**
 * The hanzi and the pinyin typed for it, as `check` is given them.
 *
 * Two arguments at a terminal — `pinyinjs check 银行 yínxíng` — with everything
 * after the first joined back up, so that unquoted pinyin with spaces in it
 * works the way anybody would expect it to. A piped file is one pair per line,
 * separated by a tab, since pinyin has spaces in it and the hanzi may too.
 */
function checkPairs(
  texts: readonly string[],
): readonly (readonly [string, string])[] {
  if (texts.some((text) => text.includes("\t"))) {
    return texts.map((text) => {
      const [hanzi = "", ...rest] = text.split("\t");
      return [hanzi, rest.join("\t")] as const;
    });
  }
  const [hanzi = "", ...rest] = texts;
  return [[hanzi, rest.join(" ")] as const];
}

/**
 * One checked syllable, as a line and as data.
 *
 * The characters, then what was expected, then what was typed, then the two
 * verdicts. Spacing is written only where it went wrong, since `correct` on
 * every line would bury the one that did not.
 */
function checkedSyllable(
  one: CheckedSyllable,
  input: CommandInput,
): { readonly line: string; readonly data: unknown } {
  const expected =
    one.expected === undefined ? "" : writeSyllable(one.expected);
  // Written only where it went wrong: `correct` on every line would bury the
  // one that did not.
  const spacing = one.spacing === "correct" ? undefined : one.spacing;

  return {
    line: `  ${column(one.source ?? "", 6)}${column(
      input.paint(expected, one.expected?.tone),
      8,
    )}${column(one.text, 8)}${column(one.verdict, 10)}${spacing ?? ""}`.trimEnd(),
    data: {
      verdict: one.verdict,
      isCorrect: one.isCorrect,
      ...(one.spacing !== undefined && { spacing: one.spacing }),
      ...(expected !== "" && { expected }),
      ...(one.text !== "" && { typed: one.text }),
      ...(one.source !== undefined && { source: one.source }),
      ...(one.at !== undefined && { at: one.at }),
    },
  };
}

/**
 * Mark typed pinyin against the text it was written for.
 *
 * The heading carries the answer the text converts to, because a check that
 * says only what is wrong leaves a reader hunting for what was right.
 */
const CHECK: Command = {
  name: "check",
  summary: "mark typed pinyin against the text",
  argument: "<text> <pinyin>",
  flags: [...CONVERT_FLAGS, ...CHECK_FLAGS],
  needsDictionary: true,
  run: (input) => {
    const dictionary = dictionaryOf(input);
    const options = checkOptions(input.flags);

    return checkPairs(input.texts).map(([text, typed]) => {
      if (typed === "") {
        throw new UsageError("check needs a text and the pinyin typed for it");
      }
      const marked = check(dictionary, text, typed, options);
      const score = Math.round(marked.score * 100);
      const syllables = marked.syllables.map((one) =>
        checkedSyllable(one, input),
      );
      // The answer as the conversion writes it, spacing and all, since the
      // spacing is one of the things being marked and a reading joined by
      // spaces would show every word broken apart.
      const pieces = convertPieces(dictionary, text, options);

      return {
        lines: [
          `${text}  ${paintedPieces(pieces, input)}  ${String(score)}%`,
          ...syllables.map((one) => one.line),
        ],
        data: {
          text,
          typed,
          isCorrect: marked.isCorrect,
          score: marked.score,
          pinyin: pieces.map((piece) => piece.text).join(""),
          syllables: syllables.map((one) => one.data),
        },
      };
    });
  },
};

/**
 * Write a text as a slug.
 *
 * Uncoloured, for the reason `html` is: a slug is a string for a machine, and
 * colouring the tones in something meant to be pasted into a URL would be
 * putting escape codes where they cannot go.
 */
const SLUG: Command = {
  name: "slug",
  summary: "hanzi to a URL-safe slug",
  argument: "[text...]",
  flags: [...SLUG_FLAGS],
  needsDictionary: true,
  run: (input) => {
    const options = slugOptions(input.flags);
    return input.texts.map((text) => {
      const written = slug(dictionaryOf(input), text, options);
      return { lines: [written], data: { text, slug: written } };
    });
  },
};

/**
 * The tables a command declared it needs.
 */
function scriptTablesOf(input: CommandInput): ScriptTables {
  /* c8 ignore next 3 -- loaded for every command that declares it needs them */
  if (input.scriptTables === undefined) {
    throw new UsageError("the script conversion tables were not loaded");
  }
  return input.scriptTables;
}

/**
 * Convert between 简体 and 繁體, one line in and one line out.
 *
 * The per-character evidence rides in the JSON rather than the lines, because
 * the answer a person wants here is the converted text and a second column of
 * `locked` on every character would bury it. `--json` carries what was a guess.
 */
const SCRIPT: Command = {
  name: "script",
  summary: "简体 ↔ 繁體 conversion",
  argument: "[text...]",
  flags: [...SCRIPT_FLAGS],
  needsDictionary: true,
  needsScriptTables: true,
  run: (input) => {
    const to = scriptTarget(input.flags);
    const from = scriptFrom(input.flags);
    return input.texts.map((text) => {
      const { text: written, choices } = toScriptPieces(
        dictionaryOf(input),
        scriptTablesOf(input),
        text,
        { to, ...(from !== undefined && { from }) },
      );
      return {
        lines: [written],
        data: {
          text,
          script: written,
          to,
          characters: choices.map((choice) => ({
            from: choice.from,
            to: choice.to,
            evidence: choice.evidence,
            ...(choice.alternatives.length > 0 && {
              alternatives: [...choice.alternatives],
            }),
          })),
          uncertain: choices
            .filter((choice) => isUncertainChoice(choice))
            .map((choice) => choice.from),
        },
      };
    });
  },
};

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
const EXPLAIN: Command = {
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
const LOOKUP: Command = {
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
const SYLLABLE: Command = {
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
const SANDHI: Command = {
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

/**
 * Report what is loaded, which is the first thing to check when output looks
 * wrong.
 */
const INFO: Command = {
  name: "info",
  summary: "which dictionary is loaded, and how big it is",
  argument: "",
  flags: [],
  needsDictionary: true,
  run: (input) => {
    const keys = dictionaryOf(input).size;
    const directory = input.choice.directory;
    return [
      {
        lines: [
          `tier       ${input.choice.tier}`,
          `data       ${directory ?? "the artifacts that shipped"}`,
          `keys       ${keys.toLocaleString("en-GB")}`,
          `syllables  ${String(ATTESTED_SYLLABLES.length)} attested, ${String(DICTIONARY_SYLLABLES.size)} spellings in the inventory`,
        ],
        data: {
          tier: input.choice.tier,
          ...(directory !== undefined && { data: directory }),
          keys,
          attestedSyllables: ATTESTED_SYLLABLES.length,
          inventorySpellings: DICTIONARY_SYLLABLES.size,
        },
      },
    ];
  },
};

/**
 * Apply the sandhi a counted quantity takes, and only there.
 *
 * 一百 is said `yìbǎi`, but 110 read out is `yāo yāo líng` and never
 * `yì yì líng`, and 3.14 is `sān diǎn yī sì`: a digit said on its own keeps its
 * citation tone, and so does everything after the decimal point, which is read
 * digit by digit whatever the style. So the sandhi pass runs over the counted
 * part of the number and stops at the 点.
 */
function counted(
  hanzi: string,
  reading: readonly Syllable[],
  options: NumeralOptions,
  sandhi: SandhiOptions | undefined,
): readonly Syllable[] {
  if (options.style === "digits") {
    return reading;
  }
  const point = toCharacters(hanzi).indexOf("点");
  const quantity = point === -1 ? reading.length : point;
  return [
    ...applySandhi(reading.slice(0, quantity), sandhi),
    ...reading.slice(quantity),
  ];
}

/**
 * Read numbers aloud, as quantities or digit by digit.
 *
 * Needs no dictionary, for the same reason `syllable` and `sandhi` do not:
 * reading a number is arithmetic and a twenty-entry reading table, not a
 * lookup. Which of the two styles a number takes is the caller's to say —
 * 2026年 is read out digit by digit and 2026个 is counted — so the flag is
 * where that choice lives rather than a guess about the text around it.
 */
const NUMBER: Command = {
  name: "number",
  summary: "read a number as Chinese numerals",
  argument: "<number...>",
  flags: [
    "notation",
    "digits",
    "yao",
    "no-liang",
    "percent",
    "third-tone",
    "no-sandhi",
  ],
  needsDictionary: false,
  run: (input) => {
    const { notation, sandhi } = convertOptions(input.flags);
    const options: NumeralOptions = {
      style: input.flags.digits === true ? "digits" : "cardinal",
      ...(input.flags.yao === true && { yao: true }),
      ...(input.flags["no-liang"] === true && { liang: "never" as const }),
    };
    return input.texts.map((text) => {
      const hanzi =
        input.flags.percent === true
          ? percentHanzi(text, options)
          : numeralHanzi(text, options);
      const reading =
        hanzi === undefined ? undefined : readNumeralHanzi(hanzi, options);
      if (hanzi === undefined || reading === undefined) {
        return {
          lines: [`${text}  not a number`],
          data: { text, read: false },
        };
      }
      const said = counted(hanzi, reading, options, sandhi);
      const spelled = said.map((syllable) => writeSyllable(syllable, notation));
      return {
        lines: [
          `${column(text, 12)}${column(hanzi, 18)}${spelled
            .map((written, at) => input.paint(written, said[at]?.tone))
            .join(" ")}`,
        ],
        data: {
          text,
          hanzi,
          pinyin: spelled.join(" "),
          style: options.style,
        },
      };
    });
  },
};

/**
 * Every subcommand, in the order the help lists them.
 */
export const COMMANDS: readonly Command[] = [
  CONVERT,
  HTML,
  ANNOTATE,
  SEGMENT,
  MATCH,
  CHECK,
  SLUG,
  SCRIPT,
  EXPLAIN,
  LOOKUP,
  SYLLABLE,
  SANDHI,
  NUMBER,
  TRANSCRIBE,
  INFO,
];

/**
 * The command of a given name.
 */
export function commandNamed(name: string): Command | undefined {
  return COMMANDS.find((command) => command.name === name);
}
