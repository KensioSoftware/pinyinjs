import { type ParseArgsConfig, parseArgs } from "node:util";

import type { ConvertOptions } from "../decode/convert.js";
import type { Tier } from "../dictionary/tiers.js";
import type { HtmlOptions } from "../format/html.js";
import type { ApostropheStyle } from "../orthography/apostrophe.js";
import type { CapitalStyle } from "../orthography/capitals.js";
import type { PunctuationStyle } from "../orthography/punctuation.js";
import type { Locale } from "../script/script.js";
import type { ToneNotation } from "../syllable/syllable.js";

/**
 * Every flag the CLI accepts.
 *
 * One table rather than one per command, because the parser needs the whole set
 * up front; a command's own list is what rejects a flag it has no use for.
 * Negated forms are spelled out, since `parseArgs` has no `--no-` convention of
 * its own.
 */
const FLAGS = {
  data: { type: "string" },
  tier: { type: "string" },
  notation: { type: "string", short: "n" },
  locale: { type: "string", short: "l" },
  apostrophe: { type: "string" },
  capitals: { type: "string" },
  punctuation: { type: "string" },
  "no-grouping": { type: "boolean" },
  "keep-numbers": { type: "boolean" },
  "third-tone": { type: "boolean" },
  "no-sandhi": { type: "boolean" },
  greedy: { type: "boolean" },
  digits: { type: "boolean" },
  yao: { type: "boolean" },
  "no-liang": { type: "boolean" },
  percent: { type: "boolean" },
  from: { type: "string" },
  "no-tone-classes": { type: "boolean" },
  "no-uncertain": { type: "boolean" },
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
 * The flags a parse produced, before any command has looked at them.
 */
export type Flags = Partial<Record<FlagName, string | boolean>>;

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
 * Something the command line asked for that cannot be done.
 *
 * Thrown rather than exited on, so that the caller decides what a mistake at
 * the command line is worth.
 */
export class UsageError extends Error {}

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

/**
 * Read a flag that takes a value, checking it against what the library accepts.
 */
function chosen<Value extends string>(
  flags: Flags,
  name: FlagName,
  allowed: readonly Value[],
): Value | undefined {
  const given = flags[name];
  if (given === undefined) {
    return undefined;
  }
  const value = String(given);
  const found = allowed.find((candidate) => candidate === value);
  if (found === undefined) {
    throw new UsageError(
      `--${name} must be one of ${allowed.join(", ")}, not ${value}`,
    );
  }
  return found;
}

const NOTATIONS: readonly ToneNotation[] = [
  "marks",
  "numbers",
  "superscript",
  "none",
];

const LOCALES: readonly Locale[] = ["zh-CN", "zh-TW"];

const APOSTROPHES: readonly ApostropheStyle[] = ["always", "standard", "never"];

const CAPITALS: readonly CapitalStyle[] = ["auto", "proper", "none"];

const PUNCTUATION: readonly PunctuationStyle[] = ["latin", "keep"];

const TIERS: readonly Tier[] = ["core", "standard", "full"];

/**
 * Which system the text handed to `romanize` is written in.
 *
 * `auto` reads bopomofo as bopomofo and everything else as pinyin, which is as
 * far as detection can honestly go: bopomofo has a script of its own, while
 * `chi` is a well-formed spelling in both pinyin and Wade-Giles and means
 * different syllables in each.
 */
export type RomanizationSource =
  "auto" | "pinyin" | "wade-giles" | "bopomofo" | "yale" | "ipa";

const SOURCES: readonly RomanizationSource[] = [
  "auto",
  "pinyin",
  "wade-giles",
  "bopomofo",
  "yale",
  "ipa",
];

/**
 * Read the `--from` flag.
 */
export function romanizationSource(flags: Flags): RomanizationSource {
  return chosen(flags, "from", SOURCES) ?? "auto";
}

/**
 * Which dictionary a run should read.
 */
export interface DictionaryChoice {
  readonly tier: Tier;
  /** Where the artifacts are, or undefined for the ones that shipped. */
  readonly directory: string | undefined;
}

/**
 * Read the dictionary flags.
 */
export function dictionaryChoice(flags: Flags): DictionaryChoice {
  const directory = flags.data;
  return {
    tier: chosen(flags, "tier", TIERS) ?? "full",
    directory: directory === undefined ? undefined : String(directory),
  };
}

/**
 * Turn the conversion flags into the options the library takes.
 *
 * Only the flags actually given are passed on, so that the library's defaults
 * stay the CLI's defaults and there is one place they are written down.
 */
export function convertOptions(flags: Flags): ConvertOptions {
  const sandhi = {
    ...(flags["no-sandhi"] === true && { yiBu: false }),
    ...(flags["third-tone"] === true && { thirdTone: true }),
  };
  const notation = chosen(flags, "notation", NOTATIONS);
  const locale = chosen(flags, "locale", LOCALES);
  const apostrophe = chosen(flags, "apostrophe", APOSTROPHES);
  const capitals = chosen(flags, "capitals", CAPITALS);
  const punctuation = chosen(flags, "punctuation", PUNCTUATION);

  return {
    ...(flags["keep-numbers"] === true && { numbers: "keep" as const }),
    ...(notation !== undefined && { notation }),
    ...(locale !== undefined && { locale }),
    ...(apostrophe !== undefined && { apostrophe }),
    ...(capitals !== undefined && { capitals }),
    ...(punctuation !== undefined && { punctuation }),
    ...(flags["no-grouping"] === true && { grouping: false }),
    ...(Object.keys(sandhi).length > 0 && { sandhi }),
  };
}

/**
 * The same, plus the two flags that only mean anything in HTML.
 */
export function htmlOptions(flags: Flags): HtmlOptions {
  return {
    ...convertOptions(flags),
    ...(flags["no-tone-classes"] === true && { toneClasses: false }),
    ...(flags["no-uncertain"] === true && { markUncertain: false }),
  };
}
