import { isUncertain } from "../decode/confidence.js";
import {
  convert,
  convertGreedily,
  convertPieces,
  type ConvertedPiece,
} from "../decode/convert.js";
import { applySandhi, type SandhiOptions } from "../decode/sandhi.js";
import { toCharacters } from "../script/characters.js";
import {
  numeralHanzi,
  type NumeralOptions,
  percentHanzi,
  readNumeralHanzi,
} from "../numerals/numerals.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { convertToHtml } from "../format/html.js";
import {
  isBopomofo,
  readBopomofo,
  writeBopomofoWord,
} from "../romanization/bopomofo.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  writeWadeGilesWord,
} from "../romanization/wade-giles.js";
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
  romanizationSource,
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
 */
function column(text: string, width: number): string {
  return text.padEnd(width);
}

/**
 * A reading written out, syllable by syllable.
 */
function written(reading: readonly Syllable[]): string {
  return reading.map((syllable) => writeSyllable(syllable)).join(" ");
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
  flags: Flags,
): readonly { readonly reading: string; readonly cost: number }[] {
  const { notation } = convertOptions(flags);
  return (piece.confidence?.alternatives ?? []).map((alternative) => ({
    reading: alternative.reading
      .map((syllable) => writeSyllable(syllable, notation))
      .join(""),
    // Rounded because a cost is a sum of frequency buckets and a per-word
    // charge of 4.62, which lands on 24.620000000000005 often enough to be
    // worth not putting in front of anybody.
    cost: Math.round(alternative.cost * 100) / 100,
  }));
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
    return input.texts.map((text) => {
      const pinyin = decode(dictionaryOf(input), text, options);
      return { lines: [pinyin], data: { text, pinyin } };
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
  flags: [...CONVERT_FLAGS, "no-tone-classes", "no-uncertain"],
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
 * One decoded syllable, as `explain` reports it.
 */
function explainSyllable(
  piece: ConvertedPiece,
  flags: Flags,
): { readonly line: string; readonly data: unknown } {
  const state = stateOf(piece);
  const alternatives = alternativesOf(piece, flags);
  const beaten = alternatives
    .map(
      (alternative) => `${alternative.reading} +${alternative.cost.toFixed(1)}`,
    )
    .join("  ");

  return {
    line: `  ${column(piece.text, 8)}${column(state, 8)}${beaten}`.trimEnd(),
    data: {
      text: piece.text,
      state,
      ...(piece.syllable?.tone !== undefined && { tone: piece.syllable.tone }),
      alternatives,
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
        .map((piece) => explainSyllable(piece, input.flags));

      return {
        lines: [
          `${text}  ${pinyin}`,
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
function entryFound(dictionary: Dictionary, word: string): Reported {
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
      `${word}  ${written(entry.reading)}${tags.length > 0 ? `  ${tags.join(", ")}` : ""}`,
      ...(entry.taiwanReading === undefined
        ? []
        : [`  zh-TW  ${written(entry.taiwanReading)}`]),
      ...(others.length > 0
        ? [`  also   ${others.map((reading) => written(reading)).join(", ")}`]
        : []),
    ],
    data: {
      word,
      found: true,
      reading: written(entry.reading),
      partOfSpeech: entry.partOfSpeech,
      isProperNoun: entry.isProperNoun,
      ...(entry.taiwanReading !== undefined && {
        taiwanReading: written(entry.taiwanReading),
      }),
      otherReadings: others.map((reading) => written(reading)),
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
    input.texts.map((word) => entryFound(dictionaryOf(input), word)),
};

/**
 * One written syllable, taken apart.
 */
function syllableTaken(spelling: string): {
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
    line: `  ${column(spelling, 10)}${column(parts.join(", "), 22)}${column(
      Object.values(notations).join("  "),
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
      const taken = split.map((spelling) => syllableTaken(spelling));
      return {
        lines: [
          `${text}  ${split.join(" ")}`,
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
      const word = readWord(text);
      if (word === undefined) {
        return {
          lines: [`${text}  not readable as pinyin`],
          data: { text, read: false },
        };
      }
      const pinyin = written(applySandhi(word, options));
      return {
        lines: [`${text}  ${pinyin}`],
        data: { text, read: true, pinyin },
      };
    });
  },
};

/**
 * One syllable or word, in all three systems.
 */
interface Romanised {
  readonly pinyin: string;
  readonly bopomofo: string;
  readonly wadeGiles: string;
  /**
   * Whether the Wade-Giles this came from was spelled exactly.
   *
   * Undefined when the input was not Wade-Giles, since the question only
   * arises there.
   */
  readonly isExact?: boolean;
}

/**
 * Write a run of syllables in all three systems.
 */
function romanised(
  syllables: readonly Syllable[],
  flags: Flags,
  isExact?: boolean,
): Romanised {
  const { notation } = convertOptions(flags);
  return {
    pinyin: syllables
      .map((syllable) => writeSyllable(syllable, notation))
      .join(""),
    bopomofo: writeBopomofoWord(syllables),
    wadeGiles: writeWadeGilesWord(syllables),
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
 */
function fromWadeGiles(text: string, flags: Flags): readonly Romanised[] {
  const exact = new Set(
    readWadeGiles(text).map((syllable) => writeSyllable(syllable)),
  );
  return readWadeGilesLoosely(text).map((syllable) =>
    romanised([syllable], flags, exact.has(writeSyllable(syllable))),
  );
}

/**
 * Read whatever system the text is in, and say so.
 */
function romanisations(text: string, flags: Flags): readonly Romanised[] {
  const from = romanizationSource(flags);
  if (from === "wade-giles") {
    return fromWadeGiles(text, flags);
  }
  // Bopomofo needs no flag to be recognised: it has a script of its own, so a
  // caller can only mean one thing by it. Wade-Giles and pinyin overlap almost
  // entirely, so those have to be declared.
  if (from === "bopomofo" || (from === "auto" && isBopomofo(text))) {
    const syllable = readBopomofo(text);
    return syllable === undefined ? [] : [romanised([syllable], flags)];
  }
  const split = splitSyllables(text);
  const syllables = (split ?? []).flatMap((spelling) => {
    const syllable = readSyllable(spelling);
    /* c8 ignore next -- splitSyllables only emits syllables that read */
    return syllable === undefined ? [] : [syllable];
  });
  return syllables.length === 0 ? [] : [romanised(syllables, flags)];
}

/**
 * Write pinyin as bopomofo and Wade-Giles, and read either back.
 *
 * Needs no dictionary, for the same reason `syllable` does: a romanisation is
 * a mapping over syllables and there is nothing to look up. Several rows come
 * back where Wade-Giles is ambiguous, which is most of it once the apostrophes
 * and diacritics have been dropped.
 */
const ROMANIZE: Command = {
  name: "romanize",
  summary: "pinyin to bopomofo and Wade-Giles, and back",
  argument: "<text...>",
  flags: ["notation", "from"],
  needsDictionary: false,
  run: (input) =>
    input.texts.map((text) => {
      const found = romanisations(text, input.flags);
      if (found.length === 0) {
        return {
          lines: [`${text}  not readable`],
          data: { text, read: false },
        };
      }
      return {
        lines: found.map((one, index) =>
          `${column(index === 0 ? text : "", 12)}${column(one.pinyin, 10)}${column(
            one.bopomofo,
            12,
          )}${column(one.wadeGiles, 10)}${one.isExact === false ? "marks restored" : ""}`.trimEnd(),
        ),
        data: { text, read: true, readings: found },
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
      const pinyin = counted(hanzi, reading, options, sandhi)
        .map((syllable) => writeSyllable(syllable, notation))
        .join(" ");
      return {
        lines: [`${column(text, 12)}${column(hanzi, 18)}${pinyin}`],
        data: { text, hanzi, pinyin, style: options.style },
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
  EXPLAIN,
  LOOKUP,
  SYLLABLE,
  SANDHI,
  NUMBER,
  ROMANIZE,
  INFO,
];

/**
 * The command of a given name.
 */
export function commandNamed(name: string): Command | undefined {
  return COMMANDS.find((command) => command.name === name);
}
