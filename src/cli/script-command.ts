/**
 * 简体 ↔ 繁體 conversion, at the command line.
 */
import { isUncertainChoice, toScriptPieces } from "../decode/script.js";
import type { ScriptTables } from "../script/conversion.js";
import {
  SCRIPT_FLAGS,
  scriptFrom,
  scriptTarget,
  UsageError,
} from "./arguments.js";
import { type Command, type CommandInput, dictionaryOf } from "./command.js";

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
export const SCRIPT: Command = {
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
