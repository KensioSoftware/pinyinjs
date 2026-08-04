import { stripToneMarks } from "../tone/tone-mark.js";

/**
 * The vowels a syllable may not begin with unless something separates it.
 *
 * The complete trigger set for the 隔音符号 of GB/T 16159: `i`, `u` and `ü`
 * surface as `y` and `w` at the start of a syllable, so they cannot create a
 * boundary ambiguity and never need separating.
 */
export const SEPARABLE_VOWELS: readonly string[] = ["a", "o", "e"];

/**
 * Whether a written syllable begins with a, o or e.
 *
 * The one question both halves of the apostrophe rule ask: reading pinyin, it
 * says a syllable cannot start here without an apostrophe before it; writing
 * pinyin, it says one has to be put there. Tone marks are stripped first, so
 * `ān` and `an1` and `ǎo` all answer the same.
 */
export function isSeparableStart(spelling: string): boolean {
  const first = stripToneMarks(spelling).toLowerCase().slice(0, 1);
  return SEPARABLE_VOWELS.includes(first);
}
