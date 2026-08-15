/**
 * The CLI as one call: a command line in, lines and a status out.
 */
import {
  checkFlags,
  GLOBAL_FLAGS,
  parseArguments,
  UsageError,
} from "./arguments.js";
import { type CliEnvironment, inputFor } from "./cli-input.js";
import { commandNamed } from "./commands.js";
import { commandHelp, generalHelp } from "./help.js";
import { type CliResult, runCommand } from "./run-command.js";

export type { CliEnvironment } from "./cli-input.js";
export type { CliResult } from "./run-command.js";

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
