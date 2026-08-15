/**
 * The options for the commands that write a text out in some other form.
 *
 * Slugs, HTML and script conversion each take a shape of their own, and none
 * of them is what the conversion itself is given.
 */
import { convertOptions } from "./options.js";
import { type ScriptTarget, SCRIPT_TARGETS } from "../decode/script.js";
import type { HtmlOptions } from "../format/html.js";
import type { SlugOptions } from "../format/slug.js";
import { type Script, SCRIPTS } from "../script/script.js";
import type { Flags } from "./flags.js";
import {
  chosen,
  counted,
  LOCALES,
  SLUG_SYLLABLES,
  SLUG_TONES,
  SLUG_UMLAUTS,
} from "./flag-values.js";

export {
  colourDepth,
  type TranscriptionSource,
  transcriptionSource,
  transcriptionSystem,
} from "./flag-values.js";

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
