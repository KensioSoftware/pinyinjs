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
  isBopomofo,
  readBopomofo,
  writeBopomofo,
  writeBopomofoWord,
} from "../transcription/bopomofo.js";
import {
  readGwoyeu,
  writeGwoyeu,
  writeGwoyeuWord,
} from "../transcription/gwoyeu.js";
import { readIpa, writeIpa, writeIpaWord } from "../transcription/ipa.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  readWadeGilesWord,
  splitWadeGiles,
  writeWadeGiles,
  writeWadeGilesWord,
} from "../transcription/wade-giles.js";
import { readYale, writeYale, writeYaleWord } from "../transcription/yale.js";
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
  type DictionaryChoice,
  type Flags,
  type FlagName,
  htmlOptions,
  MATCH_FLAGS,
  matchQuery,
  SCRIPT_FLAGS,
  scriptFrom,
  scriptTarget,
  SLUG_FLAGS,
  slugOptions,
  type TranscriptionSource,
  transcriptionSource,
  transcriptionSystem,
  UsageError,
} from "./arguments.js";
import { type Painter, PLAIN, visibleLength } from "./colour.js";
import { isUncertainChoice, toScriptPieces } from "../decode/script.js";
import type { ScriptTables } from "../script/conversion.js";

/**
 * What a command is given to work with.
 */
export interface CommandInput {
  /** The words, phrases or texts to act on, one per line of output. */
  readonly texts: readonly string[];
  readonly flags: Flags;
  /** Loaded for the commands that declare they need one. */
  readonly dictionary: Dictionary | undefined;
  /** Loaded for the one command that converts between the scripts. */
  readonly scriptTables: ScriptTables | undefined;
  readonly choice: DictionaryChoice;
  /**
   * How to write a syllable, which is where tone colour is applied.
   *
   * Handed in rather than worked out, because whether the output is a terminal
   * is a fact about the run and not about the command. A command that writes no
   * syllables never calls it, and `html` deliberately does not: markup is a
   * format for a machine, exactly as `--json` is.
   */
  readonly paint: Painter;
}

/**
 * One answer, in both the forms the CLI can write it.
 *
 * Every command reports both rather than one being derived from the other: the
 * lines are for a person reading them and the data is for `jq`, and a person's
 * columns are a poor thing to parse. Keeping them side by side in each command
 * is what stops them drifting apart.
 */
export interface Reported {
  readonly lines: readonly string[];
  /** Written as one JSON document per answer, for `--json`. */
  readonly data: unknown;
}

/**
 * One subcommand.
 */
export interface Command {
  readonly name: string;
  /** One line, for the command list in the help. */
  readonly summary: string;
  /** What follows the command name, for its own help. */
  readonly argument: string;
  /** The flags it takes, beyond the global ones. */
  readonly flags: readonly FlagName[];
  /**
   * Whether it reads the dictionary.
   *
   * The syllable layer needs no data at all, and a command that only uses it
   * should not wait for 2.4 MB to load.
   */
  readonly needsDictionary: boolean;
  /**
   * Whether it reads the script conversion tables, which are their own file.
   *
   * Off for everything but `script`: the tables are 96 KB nothing else looks
   * at, and the point of keeping them out of the dictionary is not paying for
   * them by default.
   */
  readonly needsScriptTables?: boolean;
  readonly run: (input: CommandInput) => readonly Reported[];
}

/**
 * The dictionary a command declared it needs.
 */
function dictionaryOf(input: CommandInput): Dictionary {
  /* c8 ignore next 3 -- loaded for every command that declares it needs one */
  if (input.dictionary === undefined) {
    throw new UsageError("no dictionary was loaded");
  }
  return input.dictionary;
}

/**
 * Pad a column so that what follows it lines up.
 *
 * Padded to what a reader sees rather than to the string's length: a coloured
 * cell carries escape sequences that take no width on screen, and `padEnd`
 * counts them.
 */
function column(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleLength(text)));
}

/**
 * A reading written out, syllable by syllable, each in its tone's colour.
 */
function written(reading: readonly Syllable[], paint: Painter): string {
  return reading
    .map((syllable) => paint(writeSyllable(syllable), syllable.tone))
    .join(" ");
}

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
 * A conversion's pieces joined back up, each syllable in its tone's colour.
 */
function paintedPieces(
  pieces: readonly ConvertedPiece[],
  input: CommandInput,
): string {
  return pieces
    .map((piece) => input.paint(piece.text, piece.syllable?.tone))
    .join("");
}

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
 * One syllable or word, in every system.
 */
interface Transcribed {
  readonly pinyin: string;
  readonly bopomofo: string;
  readonly wadeGiles: string;
  readonly yale: string;
  readonly gwoyeu: string;
  readonly ipa: string;
  /**
   * Whether the Wade-Giles this came from was spelled exactly.
   *
   * Undefined when the input was not Wade-Giles, since the question only
   * arises there.
   */
  readonly isExact?: boolean;
}

/**
 * One row of `transcribe`, before it is written in anything.
 */
interface Reading {
  readonly syllables: readonly Syllable[];
  /** Whether the Wade-Giles this came from was spelled exactly. */
  readonly isExact?: boolean;
}

/**
 * How one system writes a word: a syllable at a time, and what it joins on.
 *
 * The `write*Word` helpers are each a map and a join, and this takes them apart
 * so that every syllable can be painted its own colour. That duplicates five
 * separators, so each entry carries the helper it stands in for and
 * `commands.test.ts` asserts the two agree over the whole inventory in every
 * tone state — rather than the list being trusted.
 */
export interface System {
  /** What `--from` and `--system` call it. */
  readonly name: TranscriptionSource;
  readonly write: (syllable: Syllable) => string;
  readonly separator: string;
  /**
   * How the system writes a word, with its tones or without them.
   *
   * `--notation none` can only be honoured where the tone is written
   * separately*: Wade-Giles, Yale and IPA all have a way to leave it off.
   * Bopomofo marks it with a symbol of the script and Gwoyeu Romatzyh spells
   * it into the syllable, so for those two there is nothing to leave off and
   * the flag is ignored rather than approximated.
   */
  readonly word: (syllables: readonly Syllable[], hasTones: boolean) => string;
  /**
   * Whether the system writes the capitals the conversion settled.
   *
   * The three romanisations do, since a romanisation is a way of writing
   * Chinese in the Latin alphabet and inherits what that alphabet does with a
   * proper noun. IPA and bopomofo do not — see {@link toTranscription}.
   */
  readonly capitals: boolean;
}

const BOPOMOFO: System = {
  name: "bopomofo",
  write: writeBopomofo,
  separator: " ",
  word: (syllables) => writeBopomofoWord(syllables),
  capitals: false,
};

const WADE_GILES: System = {
  name: "wade-giles",
  write: writeWadeGiles,
  separator: "-",
  word: (syllables, hasTones) =>
    writeWadeGilesWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: true,
};

const YALE: System = {
  name: "yale",
  write: writeYale,
  separator: "",
  word: (syllables, hasTones) =>
    writeYaleWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: true,
};

const GWOYEU: System = {
  name: "gwoyeu",
  write: writeGwoyeu,
  separator: "",
  word: (syllables) => writeGwoyeuWord(syllables),
  capitals: true,
};

const IPA: System = {
  name: "ipa",
  write: writeIpa,
  separator: "",
  word: (syllables, hasTones) =>
    writeIpaWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: false,
};

/**
 * Every system `transcribe` writes a column for, for the guard above.
 */
export const SYSTEMS: readonly System[] = [
  BOPOMOFO,
  WADE_GILES,
  YALE,
  GWOYEU,
  IPA,
];

/**
 * The system a `--system` or `--from` name stands for.
 */
export function systemNamed(
  name: TranscriptionSource | undefined,
): System | undefined {
  return SYSTEMS.find((system) => system.name === name);
}

/**
 * Write a run of syllables in one system, each syllable in its tone's colour.
 */
export function writtenWith(
  syllables: readonly Syllable[],
  system: System,
  paint: Painter,
): string {
  return syllables
    .map((syllable) => paint(system.write(syllable), syllable.tone))
    .join(system.separator);
}

/**
 * Write a run of syllables in every system.
 */
function transcribed(
  reading: Reading,
  flags: Flags,
  paint: Painter,
): Transcribed {
  const { notation } = convertOptions(flags);
  const { syllables, isExact } = reading;
  return {
    pinyin: syllables
      .map((syllable) =>
        paint(writeSyllable(syllable, notation), syllable.tone),
      )
      .join(""),
    bopomofo: writtenWith(syllables, BOPOMOFO, paint),
    wadeGiles: writtenWith(syllables, WADE_GILES, paint),
    yale: writtenWith(syllables, YALE, paint),
    gwoyeu: writtenWith(syllables, GWOYEU, paint),
    ipa: writtenWith(syllables, IPA, paint),
    ...(isExact !== undefined && { isExact }),
  };
}

/**
 * Read Wade-Giles, keeping track of which candidates were spelled exactly.
 *
 * Always the loose reader, because the exact one is a strict subset of it and
 * the interesting case at a command line is the spelling that dropped its
 * marks. Which candidates needed repairing is shown rather than hidden — that
 * is the one thing a person looking at Wade-Giles wants to know.
 *
 * **A word gets one row and a syllable gets every candidate**, which is the
 * only honest way to show both. `chu` stands for four syllables and all four
 * fit on the screen; `maotsetung` splits five ways before any of its syllables
 * has been chosen, so what is shown is the reading
 * {@link readWadeGilesWord} settles on — 56.02% of markless words, by the
 * measurement in `docs/romanization/`.
 */
function fromWadeGiles(text: string): readonly Reading[] {
  const split = splitWadeGiles(text);
  if (split !== undefined && split.length > 1) {
    const word = readWadeGilesWord(text);
    return word === undefined
      ? /* c8 ignore next -- a run that splits always reads */ []
      : [
          {
            syllables: word,
            isExact: split.every(
              (spelling) => readWadeGiles(spelling).length > 0,
            ),
          },
        ];
  }
  const exact = new Set(
    readWadeGiles(text).map((syllable) => writeSyllable(syllable)),
  );
  return readWadeGilesLoosely(text).map((syllable) => ({
    syllables: [syllable],
    isExact: exact.has(writeSyllable(syllable)),
  }));
}

/**
 * The systems that read back as a plain list of candidates.
 *
 * Wade-Giles is not among them because it has a second, looser reader to run;
 * bopomofo is not because it needs no flag at all.
 */
const INDEXED_READERS = new Map<
  TranscriptionSource,
  (text: string) => readonly Syllable[]
>([
  ["yale", readYale],
  ["gwoyeu", readGwoyeu],
  ["ipa", readIpa],
]);

/**
 * Read whatever system the text is in, and say so.
 */
function transcriptions(text: string, flags: Flags): readonly Reading[] {
  const from = transcriptionSource(flags);
  if (from === "wade-giles") {
    return fromWadeGiles(text);
  }
  const reader = INDEXED_READERS.get(from);
  if (reader !== undefined) {
    return reader(text).map((syllable) => ({ syllables: [syllable] }));
  }
  // Bopomofo needs no flag to be recognised: it has a script of its own, so a
  // caller can only mean one thing by it. Wade-Giles and pinyin overlap almost
  // entirely, so those have to be declared.
  if (from === "bopomofo" || (from === "auto" && isBopomofo(text))) {
    const syllable = readBopomofo(text);
    return syllable === undefined ? [] : [{ syllables: [syllable] }];
  }
  const split = splitSyllables(text);
  const syllables = (split ?? []).flatMap((spelling) => {
    const syllable = readSyllable(spelling);
    /* c8 ignore next -- splitSyllables only emits syllables that read */
    return syllable === undefined ? [] : [syllable];
  });
  return syllables.length === 0 ? [] : [{ syllables }];
}

/**
 * How wide each of `transcribe`'s columns is when its cells are narrow.
 *
 * A floor rather than the width: a whole word is wider than a syllable, and
 * `mao-tsʻê-tung` is thirteen characters in a column sized for `ch'ü¹`. The
 * widths are kept as a floor so that a single syllable still lines up with the
 * next answer down when a file is piped through, and so that widening one row
 * does not move every example in the docs.
 */
const TRANSCRIBE_WIDTHS: readonly number[] = [12, 10, 12, 12, 10, 10, 12, 0];

/**
 * Lay rows of cells out in columns, each as wide as it needs to be.
 */
function laidOut(rows: readonly (readonly string[])[]): readonly string[] {
  const widths = TRANSCRIBE_WIDTHS.map((floor, at) =>
    Math.max(
      floor,
      ...rows.map((row) => {
        // A cell needs one space after it at least, which is what the floor
        // gives the widest syllable already. Only a cell that does not fit
        // widens the column, and then it takes two — so a single syllable is
        // laid out exactly as it was before words could arrive.
        const width = visibleLength(row[at] ?? "");
        return width + 1 > floor ? width + 2 : 0;
      }),
    ),
  );
  return rows.map((row) =>
    row
      .map((cell, at) => column(cell, widths[at] ?? 0))
      .join("")
      .trimEnd(),
  );
}

/**
 * Write pinyin in every other system, and read any of them back.
 *
 * Not `romanize`, for two reasons: bopomofo has a script of its own and IPA is
 * a transcription rather than a spelling, so half the columns are not
 * romanisations — and the input is pinyin, which already is one. *Comparison of
 * Standard Chinese transcription systems*, the syllabary these tables are
 * checked against, is the source of the word as well as of the columns.
 *
 * Needs no dictionary, for the same reason `syllable` does: a transcription is
 * a mapping over syllables and there is nothing to look up. Several rows come
 * back where Wade-Giles is ambiguous, which is most of it once the apostrophes
 * and diacritics have been dropped.
 */
const TRANSCRIBE: Command = {
  name: "transcribe",
  summary: "pinyin to bopomofo, Wade-Giles, Yale, GR and IPA, and back",
  argument: "<text...>",
  flags: ["notation", "from"],
  needsDictionary: false,
  run: (input) =>
    input.texts.map((text) => {
      const found = transcriptions(text, input.flags);
      if (found.length === 0) {
        return {
          lines: [`${text}  not readable`],
          data: { text, read: false },
        };
      }
      return {
        lines: laidOut(
          found.map((reading, index) => {
            const one = transcribed(reading, input.flags, input.paint);
            return [
              index === 0 ? text : "",
              one.pinyin,
              one.bopomofo,
              one.wadeGiles,
              one.yale,
              one.gwoyeu,
              one.ipa,
              one.isExact === false ? "marks restored" : "",
            ];
          }),
        ),
        data: {
          text,
          read: true,
          readings: found.map((reading) =>
            transcribed(reading, input.flags, PLAIN),
          ),
        },
      };
    }),
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
