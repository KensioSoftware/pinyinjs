import { type ParseArgsConfig, parseArgs } from "node:util";

import type { ConvertOptions } from "../decode/convert.js";
import type { CheckOptions } from "../grade/check.js";
import { type ScriptTarget, SCRIPT_TARGETS } from "../decode/script.js";
import type { ColourDepth } from "./colour.js";
import type { Tier } from "../dictionary/tiers.js";
import type { HtmlOptions } from "../format/html.js";
import type {
  SlugOptions,
  SlugSyllables,
  SlugTones,
  SlugUmlaut,
} from "../format/slug.js";
import type { ApostropheStyle } from "../orthography/apostrophe.js";
import type { CapitalStyle } from "../orthography/capitals.js";
import type { PunctuationStyle } from "../orthography/punctuation.js";
import { type Script, SCRIPTS } from "../script/script.js";
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

/**
 * Read a flag that takes a whole number, which every one of them is a count of.
 */
function counted(flags: Flags, name: FlagName): number | undefined {
  const given = flags[name];
  if (given === undefined) {
    return undefined;
  }
  const value = Number(String(given));
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new UsageError(
      `--${name} must be a whole number, not ${String(given)}`,
    );
  }
  return value;
}

const LOCALES: readonly Locale[] = ["zh-CN", "zh-TW"];

const APOSTROPHES: readonly ApostropheStyle[] = ["always", "standard", "never"];

const CAPITALS: readonly CapitalStyle[] = ["auto", "proper", "none"];

const PUNCTUATION: readonly PunctuationStyle[] = ["latin", "keep"];

const SLUG_TONES: readonly SlugTones[] = ["numbers", "none"];

const SLUG_SYLLABLES: readonly SlugSyllables[] = ["join", "separate"];

const SLUG_UMLAUTS: readonly SlugUmlaut[] = ["v", "u"];

const TIERS: readonly Tier[] = ["core", "standard", "full"];

/**
 * Which system the text handed to `transcribe` is written in.
 *
 * `auto` reads bopomofo as bopomofo and everything else as pinyin, which is as
 * far as detection can honestly go: bopomofo has a script of its own, while
 * `chi` is a well-formed spelling in both pinyin and Wade-Giles and means
 * different syllables in each.
 */
export type TranscriptionSource =
  | "auto"
  | "pinyin"
  | "wade-giles"
  | "bopomofo"
  | "yale"
  | "gwoyeu"
  | "ipa";

const SOURCES: readonly TranscriptionSource[] = [
  "auto",
  "pinyin",
  "wade-giles",
  "bopomofo",
  "yale",
  "gwoyeu",
  "ipa",
];

/**
 * Read the `--from` flag.
 */
export function transcriptionSource(flags: Flags): TranscriptionSource {
  return chosen(flags, "from", SOURCES) ?? "auto";
}

/**
 * Which system a conversion should be written in.
 *
 * `pinyin` is not a value: writing pinyin is what `convert` does with no flag
 * at all, and offering a name for the default would suggest the others are
 * alternatives to it rather than things it is put through afterwards.
 */
const SYSTEMS_WRITTEN: readonly TranscriptionSource[] = [
  "bopomofo",
  "wade-giles",
  "yale",
  "gwoyeu",
  "ipa",
];

/**
 * Read the `--system` flag.
 */
export function transcriptionSystem(
  flags: Flags,
): TranscriptionSource | undefined {
  return chosen(flags, "system", SYSTEMS_WRITTEN);
}

/**
 * How much colour a run should write, given what the terminal offered.
 *
 * `--colour` and `--no-colour` force it either way, and `--color` is accepted
 * as a spelling because every other tool spells it that way and nobody should
 * have to discover which this one chose.
 *
 * **`--json` is never coloured**, whatever the flags say: the option is about
 * the plain output, and the JSON already carries the tone as a number for a
 * caller that will do its own rendering.
 *
 * Forcing colour where the environment offered none — into a pipe, or past
 * `NO_COLOR` — gets the sixteen every terminal has, because nothing is known
 * about where that output is going.
 */
export function colourDepth(flags: Flags, offered: ColourDepth): ColourDepth {
  if (flags.json === true) {
    return 0;
  }
  if (flags["no-colour"] === true || flags["no-color"] === true) {
    return 0;
  }
  if (flags.colour === true || flags.color === true) {
    return offered === 0 ? 16 : offered;
  }
  return offered;
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
 * Turn the checking flags into the options the library takes.
 *
 * Every conversion flag goes through too, since a check grades against a
 * conversion and `--locale` or `--third-tone` changes what the answer is.
 */
export function checkOptions(flags: Flags): CheckOptions {
  return {
    ...convertOptions(flags),
    ...(flags["require-tones"] === true && { tones: "required" as const }),
    ...(flags["require-spacing"] === true && { spacing: "required" as const }),
  };
}

/**
 * Turn the slug flags into the options the library takes.
 *
 * `--hash-length` implies `--hash`, because asking how long the hash should be
 * and not getting one is not a reading anybody intends.
 */
export function slugOptions(flags: Flags): SlugOptions {
  const sandhi = {
    ...(flags["no-sandhi"] === true && { yiBu: false }),
    ...(flags["third-tone"] === true && { thirdTone: true }),
  };
  const tones = chosen(flags, "tones", SLUG_TONES);
  const syllables = chosen(flags, "syllables", SLUG_SYLLABLES);
  const umlaut = chosen(flags, "umlaut", SLUG_UMLAUTS);
  const locale = chosen(flags, "locale", LOCALES);
  const separator = flags.separator;
  const fallback = flags.fallback;
  const hashLength = counted(flags, "hash-length");
  const maxLength = counted(flags, "max-length");

  return {
    ...(flags["read-numbers"] === true && { numbers: "read" as const }),
    ...(tones !== undefined && { tones }),
    ...(syllables !== undefined && { syllables }),
    ...(umlaut !== undefined && { umlaut }),
    ...(locale !== undefined && { locale }),
    ...(separator !== undefined && { separator: String(separator) }),
    ...(fallback !== undefined && { fallback: String(fallback) }),
    ...(hashLength === undefined
      ? flags.hash === true && { hash: true }
      : { hash: hashLength }),
    ...(maxLength !== undefined && { maxLength }),
    ...(Object.keys(sandhi).length > 0 && { sandhi }),
  };
}

/**
 * The same, plus the three flags that only mean anything in HTML.
 */
export function htmlOptions(flags: Flags): HtmlOptions {
  return {
    ...convertOptions(flags),
    ...(flags["no-tone-classes"] === true && { toneClasses: false }),
    ...(flags["no-uncertain"] === true && { markUncertain: false }),
    ...(flags["no-lang"] === true && { lang: false }),
  };
}

/**
 * Which orthography `script` was asked to write. `zh-Hans` by default.
 */
export function scriptTarget(flags: Flags): ScriptTarget {
  return chosen(flags, "to", SCRIPT_TARGETS) ?? "zh-Hans";
}

/**
 * The script the text was declared to be in, where the caller named one.
 *
 * Detection settles it otherwise, and gets it right for anything longer than a
 * word or two. Naming it matters for text short enough to be script-neutral.
 */
export function scriptFrom(flags: Flags): Script | undefined {
  return chosen(flags, "from-script", SCRIPTS);
}
