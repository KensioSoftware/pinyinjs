import type { ConvertOptions } from "../decode/convert.js";

export {
  htmlOptions,
  scriptFrom,
  scriptTarget,
  slugOptions,
} from "./format-options.js";
import type { CheckOptions } from "../grade/check.js";
import type { Tier } from "../dictionary/tiers.js";
import type { Flags } from "./flags.js";
import {
  APOSTROPHES,
  CAPITALS,
  chosen,
  LOCALES,
  NOTATIONS,
  PUNCTUATION,
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
