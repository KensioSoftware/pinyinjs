import { parseArgs } from "node:util";

import { FLAGS, type FlagName, type Flags } from "./flags.js";
import { UsageError } from "./usage-error.js";

export { UsageError } from "./usage-error.js";
export {
  checkOptions,
  colourDepth,
  convertOptions,
  type DictionaryChoice,
  dictionaryChoice,
  htmlOptions,
  scriptFrom,
  scriptTarget,
  slugOptions,
  type TranscriptionSource,
  transcriptionSource,
  transcriptionSystem,
} from "./options.js";

export {
  CHECK_FLAGS,
  CONVERT_FLAGS,
  type FlagName,
  type Flags,
  GLOBAL_FLAGS,
  MATCH_FLAGS,
  SCRIPT_FLAGS,
  SLUG_FLAGS,
} from "./flags.js";

/**
 * Read the `--query` flag, which `match` cannot do without.
 */
export function matchQuery(flags: Flags): string {
  const given = flags.query;
  if (given === undefined) {
    throw new UsageError("match needs --query <pinyin>");
  }
  return String(given);
}

/**
 * A command line that parsed.
 */
export interface ParsedArguments {
  /** The subcommand, or the empty string where none was given. */
  readonly command: string;
  /** What the command should act on. */
  readonly texts: readonly string[];
  readonly flags: Flags;
}

/**
 * Split a command line into its command, its arguments and its flags.
 */
export function parseArguments(argv: readonly string[]): ParsedArguments {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: FLAGS,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw new UsageError(
      error instanceof Error ? error.message : "could not read the arguments",
    );
  }

  const [command = "", ...texts] = parsed.positionals;
  return { command, texts, flags: parsed.values };
}

/**
 * Reject a flag the command has no use for.
 *
 * A flag that parses but does nothing is worse than one that fails: `convert
 * --no-uncertain` would look like it had been honoured.
 */
export function checkFlags(
  flags: Flags,
  allowed: readonly FlagName[],
  command: string,
): void {
  for (const name of Object.keys(flags)) {
    if (!allowed.includes(name as FlagName)) {
      throw new UsageError(`${command} does not take --${name}`);
    }
  }
}
