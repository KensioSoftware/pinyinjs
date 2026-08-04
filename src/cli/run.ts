import type { Dictionary } from "../dictionary/dictionary.js";
import {
  checkFlags,
  type DictionaryChoice,
  dictionaryChoice,
  GLOBAL_FLAGS,
  parseArguments,
  UsageError,
} from "./arguments.js";
import { type Command, commandNamed } from "./commands.js";
import { commandHelp, generalHelp } from "./help.js";

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
}

/**
 * What a run produced.
 */
export interface CliResult {
  readonly output: readonly string[];
  readonly errors: readonly string[];
  /** The exit status: 0 for a run that did what it was asked. */
  readonly status: number;
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
async function inputFor(
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

/**
 * Run one command, having settled what it is and what it should act on.
 */
async function runCommand(
  command: Command,
  texts: readonly string[],
  flags: Parameters<typeof dictionaryChoice>[0],
  environment: CliEnvironment,
): Promise<CliResult> {
  const choice = dictionaryChoice(flags);
  const dictionary = command.needsDictionary
    ? await environment.loadDictionary(choice)
    : undefined;

  return {
    output: command.run({ texts, flags, dictionary, choice }),
    errors: [],
    status: 0,
  };
}

/**
 * Run the CLI over one command line.
 *
 * Returns what to write rather than writing it, and a status rather than
 * exiting, so that every path through it is testable.
 */
export async function runCli(
  argv: readonly string[],
  environment: CliEnvironment,
): Promise<CliResult> {
  try {
    const { command: name, texts, flags } = parseArguments(argv);

    if (flags.version === true) {
      return { output: [environment.version], errors: [], status: 0 };
    }
    if (name === "") {
      return { output: [...generalHelp()], errors: [], status: 0 };
    }

    const command = commandNamed(name);
    if (command === undefined) {
      throw new UsageError(`there is no ${name} command`);
    }
    if (flags.help === true) {
      return { output: [...commandHelp(command)], errors: [], status: 0 };
    }
    checkFlags(flags, [...command.flags, ...GLOBAL_FLAGS], command.name);

    return await runCommand(
      command,
      await inputFor(command, texts, environment),
      flags,
      environment,
    );
  } catch (error) {
    if (error instanceof UsageError) {
      return {
        output: [],
        errors: [error.message, "", "Run pinyinjs --help for what it takes."],
        status: 1,
      };
    }
    throw error;
  }
}
