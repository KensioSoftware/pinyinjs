/**
 * What a script conversion is asked for and what it hands back.
 */
import type { Script } from "../script/script.js";

/**
 * A script and, for 繁體, a regional orthography, as a BCP-47 tag.
 *
 * BCP-47 rather than a shape of our own because these subtags already mean
 * exactly this, and callers recognise them. `zh-Hant` alone takes
 * {@link DEFAULT_REGION}, since there is no region-free 繁體 to fall back on —
 * see SCRIPTS-AND-LOCALES.md.
 */
export const SCRIPT_TARGETS = [
  "zh-Hans",
  "zh-Hant",
  "zh-Hant-TW",
  "zh-Hant-HK",
] as const;

/**
 * One of the orthographies {@link toScript} writes.
 */
export type ScriptTarget = (typeof SCRIPT_TARGETS)[number];

/**
 * How a script conversion should be carried out.
 */
export interface ScriptOptions {
  /** Which orthography to write. Defaults to `zh-Hans`. */
  readonly to?: ScriptTarget;
  /**
   * The script the text is written in. Detected when not given.
   *
   * Worth setting when the text is short enough that detection has nothing to
   * go on — a run of characters both scripts share settles nothing, and the
   * conversion then assumes the text needs converting.
   */
  readonly from?: Script;
}

/**
 * What settled one character's conversion, strongest first.
 *
 * - `locked` — the character has one form and there was nothing to decide.
 *   True of the great majority: simplification changed a minority of
 *   characters, and most of those are one-to-one.
 * - `word` — a word some source wrote in both scripts settled it. The strongest
 *   real evidence, because it was written rather than inferred.
 * - `reading` — the character had rival forms and the syllable it was decoded
 *   as picked between them. This is the evidence an orthographic converter does
 *   not have.
 * - `default` — rival forms existed and nothing separated them, so the
 *   commonest was taken. The only one of the four that is a guess.
 */
export const SCRIPT_EVIDENCE = [
  "locked",
  "word",
  "reading",
  "default",
] as const;

/**
 * What settled one character's conversion.
 */
export type ScriptEvidence = (typeof SCRIPT_EVIDENCE)[number];

/**
 * Why one character came out as it did.
 *
 * The same kind of claim `ReadingConfidence` makes about a syllable, and for
 * the same reason: a conversion that cannot say which characters it guessed at
 * is asking to be trusted further than it deserves. Nothing else in this space
 * reports it.
 */
export interface ScriptChoice {
  /** The character as it was written. */
  readonly from: string;
  /** The character as it was converted. */
  readonly to: string;
  readonly evidence: ScriptEvidence;
  /** The forms this character could also have taken. */
  readonly alternatives: readonly string[];
}

/**
 * A converted text, with an account of every character it was unsure about.
 */
export interface ScriptConversion {
  readonly text: string;
  readonly choices: readonly ScriptChoice[];
}
