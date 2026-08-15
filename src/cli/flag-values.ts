/**
 * Reading a single typed value out of the flags.
 *
 * Every option a command takes is one of these underneath: a value from a
 * fixed list, a number, or a name from a fixed list with its own meaning.
 * The refusal when a flag names something that does not exist lives here too.
 */
import type { ColourDepth } from "./colour.js";
import type { Tier } from "../dictionary/tiers.js";
import type { SlugSyllables, SlugTones, SlugUmlaut } from "../format/slug.js";
import type { ApostropheStyle } from "../orthography/apostrophe.js";
import type { CapitalStyle } from "../orthography/capitals.js";
import type { PunctuationStyle } from "../orthography/punctuation.js";
import type { Locale } from "../script/script.js";
import type { ToneNotation } from "../syllable/syllable.js";
import type { FlagName, Flags } from "./flags.js";
import { UsageError } from "./usage-error.js";

/**
 * Read a flag that takes a value, checking it against what the library accepts.
 */
export function chosen<Value extends string>(
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

export const NOTATIONS: readonly ToneNotation[] = [
  "marks",
  "numbers",
  "superscript",
  "none",
];

/**
 * Read a flag that takes a whole number, which every one of them is a count of.
 */
export function counted(flags: Flags, name: FlagName): number | undefined {
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

export const LOCALES: readonly Locale[] = ["zh-CN", "zh-TW"];

export const APOSTROPHES: readonly ApostropheStyle[] = [
  "always",
  "standard",
  "never",
];

export const CAPITALS: readonly CapitalStyle[] = ["auto", "proper", "none"];

export const PUNCTUATION: readonly PunctuationStyle[] = ["latin", "keep"];

export const SLUG_TONES: readonly SlugTones[] = ["numbers", "none"];

export const SLUG_SYLLABLES: readonly SlugSyllables[] = ["join", "separate"];

export const SLUG_UMLAUTS: readonly SlugUmlaut[] = ["v", "u"];

export const TIERS: readonly Tier[] = ["core", "standard", "full"];

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

export const SOURCES: readonly TranscriptionSource[] = [
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
export const SYSTEMS_WRITTEN: readonly TranscriptionSource[] = [
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
