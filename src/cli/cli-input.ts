/**
 * What the CLI needs from the world outside it, and what it reads through it.
 *
 * Everything Node-only lives behind {@link CliEnvironment}, so that a run can
 * be tested by handing it strings. The two functions here are the only part of
 * a run that touches the outside at all before a command starts.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import type { ScriptTables } from "../script/conversion.js";
import { type DictionaryChoice, UsageError } from "./arguments.js";
import type { ColourDepth } from "./colour.js";
import type { Command } from "./commands.js";

/**
 * What the CLI needs from the world outside it.
 *
 * Everything Node-only lives behind this, so that a run can be tested by
 * handing it strings.
 */
export interface CliEnvironment {
  readonly version: string;
  /** Standard input, or the empty string where there is none to read. */
  readonly readInput: () => Promise<string>;
  readonly loadDictionary: (choice: DictionaryChoice) => Promise<Dictionary>;
  /**
   * The script conversion tables, for the one command that converts scripts.
   *
   * Separate from the dictionary because the file is: nothing that converts
   * hanzi to pinyin should wait on 96 KB it will not read.
   */
  readonly loadScriptTables: (
    choice: DictionaryChoice,
  ) => Promise<ScriptTables>;
  /**
   * How much colour the output can carry, before any flag has its say.
   *
   * Here rather than sniffed inside a command, because a command reaching for
   * `process.stdout.isTTY` would put a decision in the one place the coverage
   * gate cannot see. An environment states the answer and a test can ask for
   * either one. `depthFrom` in `colour.ts` is how the Node adapter arrives at
   * it, and is a pure function for the same reason.
   */
  readonly colours: ColourDepth;
}

/**
 * The lines a command should act on: its arguments, or standard input.
 *
 * Input is split into lines so that every command works the same way whether it
 * was given arguments or piped a file, and so that `convert` writes one line
 * out for each line in rather than running a whole document together.
 */
async function textsFor(
  command: Command,
  given: readonly string[],
  environment: CliEnvironment,
): Promise<readonly string[]> {
  if (given.length > 0 || command.argument === "") {
    return given;
  }
  const piped = await environment.readInput();
  const lines = piped.split("\n");
  // A file ends with a newline, and that last empty line is not a text.
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

/**
 * What a command was asked to act on, or a usage error saying it was nothing.
 *
 * A command that silently prints nothing because standard input was a terminal
 * looks broken rather than misused.
 */
export async function inputFor(
  command: Command,
  given: readonly string[],
  environment: CliEnvironment,
): Promise<readonly string[]> {
  const texts = await textsFor(command, given, environment);
  if (texts.length === 0 && command.argument !== "") {
    throw new UsageError(
      `${command.name} needs ${command.argument}, or text on standard input`,
    );
  }
  return texts;
}
