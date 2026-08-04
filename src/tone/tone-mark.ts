import { NEUTRAL_TONE, type Tone } from "./tone.js";

/**
 * Combining diacritics that write tones 1 to 4, indexed by tone number minus
 * one.
 *
 * Working with combining marks rather than a table of precomposed letters means
 * the same code handles ü, ê and the syllabic consonants of 呣 and 嗯 without
 * special cases, since Unicode composes what it can and leaves the rest
 * decomposed.
 */
const toneDiacritics = [
  "̄", // combining macron, tone 1
  "́", // combining acute accent, tone 2
  "̌", // combining caron, tone 3
  "̀", // combining grave accent, tone 4
] as const;

/**
 * Matches any tone diacritic in decomposed text.
 *
 * Deliberately excludes the diaeresis of ü (U+0308), which marks the vowel
 * itself rather than its tone.
 */
const toneDiacriticPattern = /[̀́̌̄]/gu;

/**
 * Vowels that take the tone mark ahead of any other, in priority order.
 */
const preferredToneVowels = ["a", "o", "e"] as const;

/**
 * Vowels that carry the tone mark only when no {@link preferredToneVowels} are
 * present.
 */
const secondaryToneVowels = "iuüê";

/**
 * Matches the consonants that carry the tone mark in syllables with no vowel at
 * all, such as 呣 (ḿ) and 嗯 (ňg).
 */
const syllabicConsonantPattern = /[mn]/u;

/**
 * Remove any tone diacritics, leaving the plain syllable.
 *
 * The diaeresis of ü is preserved, so ǚ becomes ü rather than u.
 */
export function stripToneMarks(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(toneDiacriticPattern, "")
    .normalize("NFC");
}

/**
 * How each tone is written raised.
 *
 * Used by pinyin's `superscript` notation and by Wade-Giles, which writes its
 * tone as a raised digit and nothing else. The neutral tone is written ⁵ rather
 * than left off, so that superscript is exactly the numeric notation set higher
 * and the two round-trip alike.
 */
export const SUPERSCRIPT_TONES: ReadonlyMap<Tone, string> = new Map([
  [1, "¹"],
  [2, "²"],
  [3, "³"],
  [4, "⁴"],
  [NEUTRAL_TONE, "⁵"],
]);

/**
 * The plain digit each raised digit stands for.
 *
 * Zero is included because a tone may be written 0 for neutral, and a notation
 * that can be written should be readable back.
 */
const superscriptDigits = new Map<string, string>([
  ["⁰", "0"],
  ["¹", "1"],
  ["²", "2"],
  ["³", "3"],
  ["⁴", "4"],
  ["⁵", "5"],
]);

/**
 * Rewrite raised tone digits as plain ones, so that input takes either.
 */
export function normaliseSuperscript(text: string): string {
  return text.replaceAll(
    /[⁰¹²³⁴⁵]/gu,
    /* c8 ignore next -- the pattern only matches what the map holds */
    (digit) => superscriptDigits.get(digit) ?? digit,
  );
}

/**
 * Read the tone written by the diacritics in a tone-marked syllable.
 *
 * Returns undefined when no tone is written, which is *not* the same as the
 * neutral tone: `de` in 我的 wǒ de is neutral, whereas the `bei` someone typed
 * for 北 has no tone written at all. A syllable on its own cannot tell the two
 * apart — that depends on whether the surrounding text marks tones — so this
 * reports what is written and leaves the reading of it to the caller.
 */
export function toneFromMarks(text: string): Tone | undefined {
  const decomposed = text.normalize("NFD");
  for (const [index, diacritic] of toneDiacritics.entries()) {
    if (decomposed.includes(diacritic)) {
      return (index + 1) as Tone;
    }
  }
  return undefined;
}

/**
 * Find the character that should carry the tone mark, as an index into the NFC
 * form of a toneless syllable.
 *
 * The standard places the mark on a, else on o or e, else on the last remaining
 * vowel. That last clause is what puts the mark on the u of iu and the i of ui.
 * Returns -1 when nothing in the text can carry a mark.
 */
function toneMarkTargetIndex(toneless: string): number {
  const lowerCase = toneless.toLowerCase();

  for (const vowel of preferredToneVowels) {
    const index = lowerCase.indexOf(vowel);
    if (index !== -1) {
      return index;
    }
  }

  for (let index = lowerCase.length - 1; index >= 0; index--) {
    const character = lowerCase[index];
    if (character !== undefined && secondaryToneVowels.includes(character)) {
      return index;
    }
  }

  return lowerCase.search(syllabicConsonantPattern);
}

/**
 * Write a tone onto a toneless syllable as a diacritic.
 *
 * Any tone marks already present are replaced. The neutral tone adds no mark,
 * as does an undefined tone — the two are written alike even though they mean
 * different things — and text with nothing that can carry a mark is returned
 * unchanged.
 */
export function applyToneMark(
  syllable: string,
  tone: Tone | undefined,
): string {
  const toneless = stripToneMarks(syllable).normalize("NFC");
  if (tone === undefined || tone === NEUTRAL_TONE) {
    return toneless;
  }

  const targetIndex = toneMarkTargetIndex(toneless);
  if (targetIndex === -1) {
    return toneless;
  }

  const diacritic = toneDiacritics[tone - 1];
  /* c8 ignore next 3 -- unreachable: every non-neutral Tone indexes the table */
  if (diacritic === undefined) {
    return toneless;
  }

  return `${toneless.slice(0, targetIndex + 1)}${diacritic}${toneless.slice(
    targetIndex + 1,
  )}`.normalize("NFC");
}
