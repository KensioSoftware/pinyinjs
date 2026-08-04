import { isUncertain } from "../decode/confidence.js";
import {
  convert,
  convertGreedily,
  convertPieces,
  type ConvertedPiece,
} from "../decode/convert.js";
import { applySandhi } from "../decode/sandhi.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { convertToHtml } from "../format/html.js";
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
  convertOptions,
  CONVERT_FLAGS,
  type DictionaryChoice,
  type Flags,
  type FlagName,
  htmlOptions,
  UsageError,
} from "./arguments.js";

/**
 * What a command is given to work with.
 */
export interface CommandInput {
  /** The words, phrases or texts to act on, one per line of output. */
  readonly texts: readonly string[];
  readonly flags: Flags;
  /** Loaded for the commands that declare they need one. */
  readonly dictionary: Dictionary | undefined;
  readonly choice: DictionaryChoice;
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
  readonly run: (input: CommandInput) => readonly string[];
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
 */
function column(text: string, width: number): string {
  return text.padEnd(width);
}

/**
 * How settled a decoded syllable was, in one word.
 */
function stateOf(piece: ConvertedPiece): string {
  const { confidence } = piece;
  if (confidence === undefined || confidence.isLocked) {
    return "locked";
  }
  return isUncertain(confidence) ? "guess" : "word";
}

/**
 * What a decode rejected, written out with what rejecting it saved.
 */
function alternativesOf(piece: ConvertedPiece, flags: Flags): string {
  const notation = convertOptions(flags).notation;
  return (piece.confidence?.alternatives ?? [])
    .map((alternative) => {
      const written = alternative.reading
        .map((syllable) => writeSyllable(syllable, notation))
        .join("");
      return `${written} +${alternative.cost.toFixed(1)}`;
    })
    .join("  ");
}

/**
 * Convert each text, one line in and one line out.
 */
const CONVERT: Command = {
  name: "convert",
  summary: "hanzi to pinyin",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS, "greedy"],
  needsDictionary: true,
  run: (input) => {
    const decode = input.flags.greedy === true ? convertGreedily : convert;
    const options = convertOptions(input.flags);
    return input.texts.map((text) =>
      decode(dictionaryOf(input), text, options),
    );
  },
};

/**
 * Convert each text to HTML, one element per syllable.
 */
const HTML: Command = {
  name: "html",
  summary: "hanzi to pinyin as HTML, one element per syllable",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS, "no-tone-classes", "no-uncertain"],
  needsDictionary: true,
  run: (input) => {
    const options = htmlOptions(input.flags);
    return input.texts.map((text) =>
      convertToHtml(dictionaryOf(input), text, options),
    );
  },
};

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
    const lines: string[] = [];

    for (const text of input.texts) {
      const pieces = convertPieces(dictionary, text, options);
      lines.push(
        `${text}  ${pieces.map((piece) => piece.text).join("")}`,
        ...pieces
          .filter((piece) => piece.syllable !== undefined)
          .map((piece) =>
            `  ${column(piece.text, 8)}${column(stateOf(piece), 8)}${alternativesOf(piece, input.flags)}`.trimEnd(),
          ),
      );
    }
    return lines;
  },
};

/**
 * A reading written out, syllable by syllable.
 */
function written(reading: readonly Syllable[]): string {
  return reading.map((syllable) => writeSyllable(syllable)).join(" ");
}

/**
 * What the dictionary holds for a word.
 */
function entryLines(dictionary: Dictionary, word: string): readonly string[] {
  const entry = dictionary.lookup(word);
  if (entry === undefined) {
    return [`${word}  not in the dictionary`];
  }

  const tags = [
    entry.partOfSpeech === "" ? "" : entry.partOfSpeech,
    entry.isProperNoun ? "proper noun" : "",
  ].filter((tag) => tag !== "");

  const readings = dictionary.readingsOf(word);
  return [
    `${word}  ${written(entry.reading)}${tags.length > 0 ? `  ${tags.join(", ")}` : ""}`,
    ...(entry.taiwanReading === undefined
      ? []
      : [`  zh-TW  ${written(entry.taiwanReading)}`]),
    ...(readings.length > 1
      ? [
          `  also   ${readings
            .slice(1)
            .map((reading) => written(reading))
            .join(", ")}`,
        ]
      : []),
  ];
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
    input.texts.flatMap((word) => entryLines(dictionaryOf(input), word)),
};

/**
 * One written syllable, taken apart.
 */
function syllableLine(spelling: string): string {
  const syllable = readSyllable(spelling);
  /* c8 ignore next 3 -- splitSyllables only ever emits syllables that read */
  if (syllable === undefined) {
    return `  ${column(spelling, 10)}not a syllable`;
  }
  const parts = [
    `${syllable.initial === "" ? "∅" : syllable.initial} + ${syllable.final}`,
    syllable.tone === undefined ? "no tone" : `tone ${String(syllable.tone)}`,
    ...(syllable.erhua === true ? ["儿化"] : []),
  ];
  const notations = [
    writeSyllable(syllable),
    writeSyllable(syllable, "numbers"),
    writeSyllable(syllable, "superscript"),
  ].join("  ");
  const isAttested = DICTIONARY_SYLLABLES.has(
    writeSyllableSpelling({ ...syllable, erhua: false }),
  );
  return `  ${column(spelling, 10)}${column(parts.join(", "), 22)}${column(notations, 22)}${isAttested ? "" : "not attested"}`.trimEnd();
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
    input.texts.flatMap((text) => {
      const split = splitSyllables(text);
      if (split === undefined) {
        return [`${text}  not readable as pinyin`];
      }
      return [
        `${text}  ${split.join(" ")}`,
        ...split.map((spelling) => syllableLine(spelling)),
      ];
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
      const word = readWord(text);
      if (word === undefined) {
        return `${text}  not readable as pinyin`;
      }
      const sandhied = applySandhi(word, options)
        .map((syllable) => writeSyllable(syllable))
        .join(" ");
      return `${text}  ${sandhied}`;
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
  run: (input) => [
    `tier       ${input.choice.tier}`,
    `data       ${input.choice.directory ?? "the artifacts that shipped"}`,
    `keys       ${dictionaryOf(input).size.toLocaleString("en-GB")}`,
    `syllables  ${String(ATTESTED_SYLLABLES.length)} attested, ${String(DICTIONARY_SYLLABLES.size)} spellings in the inventory`,
  ],
};

/**
 * Every subcommand, in the order the help lists them.
 */
export const COMMANDS: readonly Command[] = [
  CONVERT,
  HTML,
  EXPLAIN,
  LOOKUP,
  SYLLABLE,
  SANDHI,
  INFO,
];

/**
 * The command of a given name.
 */
export function commandNamed(name: string): Command | undefined {
  return COMMANDS.find((command) => command.name === name);
}
