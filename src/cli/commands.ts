/**
 * Every subcommand the CLI has, and how one is found by name.
 *
 * Only the list: each command lives in a module beside its subject, so that
 * adding one is a new file and a new line here rather than an edit to whatever
 * this file happened to have grown into.
 */
import type { Command } from "./command.js";
import { TRANSCRIBE } from "./transcribe-command.js";
import { SLUG } from "./slug-command.js";
import { SCRIPT } from "./script-command.js";
import { EXPLAIN } from "./explain-command.js";
import { LOOKUP, SANDHI } from "./lookup-commands.js";
import { SYLLABLE } from "./syllable-command.js";
import { CHECK } from "./check-command.js";
import { MATCH } from "./match-command.js";
import { CONVERT } from "./convert-command.js";
import { ANNOTATE, HTML } from "./html-commands.js";
import { SEGMENT } from "./segment-command.js";
import { INFO } from "./info-command.js";
import { NUMBER } from "./number-command.js";

export type { Command, CommandInput, Reported } from "./command.js";
export {
  type System,
  SYSTEMS,
  systemNamed,
  writtenWith,
} from "./transcribe-command.js";

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
