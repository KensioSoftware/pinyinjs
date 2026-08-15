/**
 * Every flag the CLI takes, and which command takes which.
 *
 * Declarative on purpose: the parser, the help table and each command's own
 * list all read from here, so this sits underneath all three rather than
 * beside any of them.
 */
import type { ParseArgsConfig } from "node:util";

/**
 * Every flag the CLI accepts.
 *
 * One table rather than one per command, because the parser needs the whole set
 * up front; a command's own list is what rejects a flag it has no use for.
 * Negated forms are spelled out, since `parseArgs` has no `--no-` convention of
 * its own.
 */
export const FLAGS = {
  data: { type: "string" },
  tier: { type: "string" },
  notation: { type: "string", short: "n" },
  locale: { type: "string", short: "l" },
  apostrophe: { type: "string" },
  capitals: { type: "string" },
  punctuation: { type: "string" },
  "no-grouping": { type: "boolean" },
  "keep-numbers": { type: "boolean" },
  "read-numbers": { type: "boolean" },
  "third-tone": { type: "boolean" },
  "no-sandhi": { type: "boolean" },
  tones: { type: "string" },
  "require-tones": { type: "boolean" },
  "require-spacing": { type: "boolean" },
  separator: { type: "string" },
  syllables: { type: "string" },
  umlaut: { type: "string" },
  query: { type: "string" },
  hash: { type: "boolean" },
  "hash-length": { type: "string" },
  "max-length": { type: "string" },
  fallback: { type: "string" },
  greedy: { type: "boolean" },
  digits: { type: "boolean" },
  yao: { type: "boolean" },
  "no-liang": { type: "boolean" },
  percent: { type: "boolean" },
  from: { type: "string" },
  to: { type: "string" },
  "from-script": { type: "string" },
  system: { type: "string" },
  "no-tone-classes": { type: "boolean" },
  "no-uncertain": { type: "boolean" },
  "no-lang": { type: "boolean" },
  colour: { type: "boolean" },
  color: { type: "boolean" },
  "no-colour": { type: "boolean" },
  "no-color": { type: "boolean" },
  json: { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const satisfies NonNullable<ParseArgsConfig["options"]>;

/**
 * A flag's name as it is written on the command line.
 */
export type FlagName = keyof typeof FLAGS;

/**
 * Flags every command takes, whatever else it takes.
 */
export const GLOBAL_FLAGS: readonly FlagName[] = [
  "data",
  "tier",
  "colour",
  "color",
  "no-colour",
  "no-color",
  "json",
  "help",
  "version",
];

/**
 * The flags that map onto `ConvertOptions`, and so belong to every command that
 * converts anything.
 */
export const CONVERT_FLAGS: readonly FlagName[] = [
  "notation",
  "locale",
  "apostrophe",
  "capitals",
  "punctuation",
  "no-grouping",
  "keep-numbers",
  "third-tone",
  "no-sandhi",
];

/**
 * The flags `check` takes, beyond the conversion ones.
 *
 * Positive rather than negated — `--require-tones` rather than `--no-tones` —
 * because both dimensions default to lenient, and a flag naming what it turns
 * on is the one that reads the way the library's own option does.
 */
export const CHECK_FLAGS: readonly FlagName[] = [
  "require-tones",
  "require-spacing",
];

/**
 * The flags `slug` takes, beyond the global ones.
 *
 * It shares the reading flags with the conversion commands and none of the
 * writing ones: a slug settles its own notation, capitals, apostrophes and
 * spacing, and a `--capitals` that changed nothing would be worse than an
 * error. `--read-numbers` rather than `--keep-numbers` because a slug keeps
 * digits by default, which is the one place it departs from `convert`.
 */
export const SLUG_FLAGS: readonly FlagName[] = [
  "tones",
  "separator",
  "syllables",
  "umlaut",
  "hash",
  "hash-length",
  "max-length",
  "fallback",
  "read-numbers",
  "locale",
  "third-tone",
  "no-sandhi",
];

/**
 * The flags `match` takes, beyond the global ones.
 *
 * The query is a flag rather than the first argument, so that the texts stay
 * where every other command has them: `match` reads a list to filter from
 * standard input, and a command line whose first positional meant something
 * else could not be piped into.
 */
export const MATCH_FLAGS: readonly FlagName[] = ["query"];

/**
 * The flags `script` takes, beyond the global ones.
 *
 * `--from-script` rather than `--from` because `--from` already means the
 * transcription a text is written in, and one flag name cannot carry two
 * meanings in one help table.
 */
export const SCRIPT_FLAGS: readonly FlagName[] = ["to", "from-script"];

/**
 * The flags a parse produced, before any command has looked at them.
 */
export type Flags = Partial<Record<FlagName, string | boolean>>;
