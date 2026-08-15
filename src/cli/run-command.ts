/**
 * Running one command, having settled what it is and what it acts on.
 *
 * The loads happen here rather than in `run.ts` because they are conditional on
 * the command: a command that converts no scripts never waits for the script
 * tables, and one that needs no dictionary never waits for that either.
 */
import { colourDepth, dictionaryChoice } from "./arguments.js";
import { painterFor } from "./colour.js";
import type { CliEnvironment } from "./cli-input.js";
import type { Command } from "./commands.js";

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
 * Run one command, having settled what it is and what it should act on.
 */
export async function runCommand(
  command: Command,
  texts: readonly string[],
  flags: Parameters<typeof dictionaryChoice>[0],
  environment: CliEnvironment,
): Promise<CliResult> {
  const choice = dictionaryChoice(flags);
  const dictionary = command.needsDictionary
    ? await environment.loadDictionary(choice)
    : undefined;
  const scriptTables =
    command.needsScriptTables === true
      ? await environment.loadScriptTables(choice)
      : undefined;
  const paint = painterFor(colourDepth(flags, environment.colours));

  const reported = command.run({
    texts,
    flags,
    dictionary,
    scriptTables,
    choice,
    paint,
  });

  return {
    // One JSON document per answer rather than one array for the run, so that
    // `jq` sees the same shape whether one text was converted or a file was.
    output:
      flags.json === true
        ? reported.map((answer) => JSON.stringify(answer.data))
        : reported.flatMap((answer) => [...answer.lines]),
    errors: [],
    status: 0,
  };
}
