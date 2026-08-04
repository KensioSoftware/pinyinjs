/**
 * Mandarin tone numbers as written in numeric pinyin notation.
 *
 * Tones 1 to 4 are the contour tones; tone 5 is the neutral tone (轻声).
 */
export const TONES = [1, 2, 3, 4, 5] as const;

/**
 * A Mandarin tone number, where 5 denotes the neutral tone (轻声).
 */
export type Tone = (typeof TONES)[number];

/**
 * The neutral tone (轻声).
 *
 * This package writes the neutral tone as 5. Other notations write it as 0 or
 * omit it; {@link toneFromNotation} accepts both conventions.
 */
export const NEUTRAL_TONE = 5 satisfies Tone;

/**
 * Narrow an arbitrary number to a {@link Tone}.
 */
export function isTone(value: number): value is Tone {
  return (TONES as readonly number[]).includes(value);
}

/**
 * Read a tone number written in either of the two common numeric conventions.
 *
 * Both 0 and 5 are accepted for the neutral tone and normalised to
 * {@link NEUTRAL_TONE}. Returns undefined for anything that is not a tone.
 */
export function toneFromNotation(value: number): Tone | undefined {
  if (value === 0) {
    return NEUTRAL_TONE;
  }
  return isTone(value) ? value : undefined;
}
