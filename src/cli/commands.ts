import {
  convert,
  convertGreedily,
  convertPieces,
  convertPiecesGreedily,
} from "../decode/convert.js";
import { applySandhi, type SandhiOptions } from "../decode/sandhi.js";
import { segment } from "../decode/segment.js";
import { toCharacters } from "../script/characters.js";
import {
  numeralHanzi,
  type NumeralOptions,
  percentHanzi,
  readNumeralHanzi,
} from "../numerals/numerals.js";
import { convertToAnnotatedHtml, convertToHtml } from "../format/html.js";
import { slug } from "../format/slug.js";
import { toTranscription } from "../format/transcription.js";
import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
} from "../syllable/inventory.js";
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import {
  convertOptions,
  CONVERT_FLAGS,
  htmlOptions,
  SCRIPT_FLAGS,
  scriptFrom,
  scriptTarget,
  SLUG_FLAGS,
  slugOptions,
  transcriptionSystem,
  UsageError,
} from "./arguments.js";
import { PLAIN } from "./colour.js";
import { isUncertainChoice, toScriptPieces } from "../decode/script.js";
import type { ScriptTables } from "../script/conversion.js";
import {
  type Command,
  type CommandInput,
  column,
  dictionaryOf,
  paintedPieces,
  written,
} from "./command.js";
import { systemNamed, TRANSCRIBE } from "./transcribe-command.js";
import { EXPLAIN, LOOKUP, SANDHI, SYLLABLE } from "./inspect-commands.js";
import { CHECK, MATCH } from "./search-commands.js";

export type { Command, CommandInput, Reported } from "./command.js";
export {
  type System,
  SYSTEMS,
  systemNamed,
  writtenWith,
} from "./transcribe-command.js";

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
