import { slug } from "../format/slug.js";
import {
  SCRIPT_FLAGS,
  scriptFrom,
  scriptTarget,
  SLUG_FLAGS,
  slugOptions,
  UsageError,
} from "./arguments.js";
import { isUncertainChoice, toScriptPieces } from "../decode/script.js";
import type { ScriptTables } from "../script/conversion.js";
import { type Command, type CommandInput, dictionaryOf } from "./command.js";
import { TRANSCRIBE } from "./transcribe-command.js";
import { EXPLAIN, LOOKUP, SANDHI, SYLLABLE } from "./inspect-commands.js";
import { CHECK, MATCH } from "./search-commands.js";
import { ANNOTATE, CONVERT, HTML, SEGMENT } from "./convert-commands.js";
import { INFO, NUMBER } from "./report-commands.js";

export type { Command, CommandInput, Reported } from "./command.js";
export {
  type System,
  SYSTEMS,
  systemNamed,
  writtenWith,
} from "./transcribe-command.js";

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
