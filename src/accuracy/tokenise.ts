import { splitSyllables } from "../syllable/split.js";
import { stripToneMarks } from "../tone/tone-mark.js";

/**
 * A pinyin string broken down for scoring.
 */
export interface TokenisedPinyin {
  /** Every syllable in order, as written. */
  readonly syllables: readonly string[];
  /** Indices into {@link syllables} at which a written word begins. */
  readonly wordStarts: ReadonlySet<number>;
}

/**
 * Punctuation to discard before reading a word, so that `wánr.` reads as `wánr`.
 */
const TRAILING_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * Break a pinyin string into syllables, recording where its words begin.
 *
 * Words are whitespace-separated; syllables within a word are recovered by
 * {@link splitSyllables}. A word that cannot be read as pinyin contributes
 * itself as a single opaque syllable, so scoring degrades rather than throwing.
 */
export function tokenisePinyin(text: string): TokenisedPinyin {
  const syllables: string[] = [];
  const wordStarts = new Set<number>();

  for (const rawWord of text.split(/\s+/u)) {
    const word = rawWord.replaceAll(TRAILING_PUNCTUATION, "");
    if (word === "") {
      continue;
    }
    wordStarts.add(syllables.length);
    syllables.push(...(splitSyllables(word) ?? [word]));
  }

  return { syllables, wordStarts };
}

/**
 * Reduce a syllable to the form used when comparing readings.
 *
 * Case carries orthographic meaning rather than phonetic meaning, so it is
 * compared separately and folded away here.
 */
export function comparableSyllable(syllable: string): string {
  return syllable.toLowerCase().normalize("NFC");
}

/**
 * Reduce a syllable to the form used when comparing readings without their
 * tones.
 */
export function tonelessSyllable(syllable: string): string {
  return stripToneMarks(comparableSyllable(syllable)).replaceAll(
    /[0-5]$/gu,
    "",
  );
}
