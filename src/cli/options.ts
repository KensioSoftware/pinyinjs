import type { ConvertOptions } from "../decode/convert.js";
import type { CheckOptions } from "../grade/check.js";
import { type ScriptTarget, SCRIPT_TARGETS } from "../decode/script.js";
import type { Tier } from "../dictionary/tiers.js";
import type { HtmlOptions } from "../format/html.js";
import type { SlugOptions } from "../format/slug.js";
import { type Script, SCRIPTS } from "../script/script.js";
import type { Flags } from "./flags.js";
import {
  APOSTROPHES,
  CAPITALS,
  chosen,
  counted,
  LOCALES,
  NOTATIONS,
  PUNCTUATION,
  SLUG_SYLLABLES,
  SLUG_TONES,
  SLUG_UMLAUTS,
  TIERS,
} from "./flag-values.js";

export {
  colourDepth,
  type TranscriptionSource,
  transcriptionSource,
  transcriptionSystem,
} from "./flag-values.js";
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
