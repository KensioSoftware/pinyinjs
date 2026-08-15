/**
 * The help for the flags every command takes.
 *
 * Laid out to the widest flag name so the descriptions line up, which is a
 * different table from the one a command's own flags are written into.
 */
import { FLAG_HELP, flagWritten } from "./flag-help.js";

/**
 * The global flags, listed under every command's help.
 *
 * Both spellings of the colour flags are listed rather than one being a quiet
 * alias: nobody should have to discover which of the two this command chose.
 */
export const GLOBAL_FLAG_HELP = [
  ["--data <dir>", "read the dictionary from this directory"],
  ["--tier <tier>", "core, standard or full (default)"],
  ["--colour, --color", "colour the tones, terminal or not"],
  ["--no-colour, --no-color", "leave the tones uncoloured"],
  ["--json", "write one JSON document per answer"],
  ["-h, --help", "show this help"],
  ["-v, --version", "show the version"],
] as const;

/**
 * How wide the flag column is, which is the longest flag written plus a gap.
 *
 * Derived for the same reason {@link COMMAND_WIDTH} is: it was a fixed 23, and
 * `--no-colour, --no-color` is exactly 23 characters long.
 */
export const FLAG_WIDTH =
  Math.max(
    ...GLOBAL_FLAG_HELP.map(([flag]) => flag.length),
    ...[...FLAG_HELP.keys()].map((name) => flagWritten(name).length),
  ) + 2;

export const GLOBAL_HELP: readonly string[] = GLOBAL_FLAG_HELP.map(
  ([flag, help]) => `  ${flag.padEnd(FLAG_WIDTH)}${help}`,
);

/**
 * A flag as the help lists it.
 */
export function flagLine(name: string): string {
  return `  ${flagWritten(name).padEnd(FLAG_WIDTH)}${FLAG_HELP.get(name) ?? ""}`;
}

/**
 * The help for one command.
 */
