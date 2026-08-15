/**
 * Finding the vowels a tonal rule works on.
 *
 * Every GR tone rule reaches for the same three things — where the rime's
 * vowels start and end, whether a letter counts as a vowel, and which vowel
 * the doubling picks — so they are settled once here.
 */
import type { Initial } from "../syllable/phonology.js";

/**
 * The sonorant initials, which swap what the first two tones do.
 *
 * A syllable beginning l-, m-, n- or r- takes an `-h-` as its second letter in
 * the first tone and is left alone in the second: 媽 mā is `mha` and 麻 má is
 * `ma`. The reason is frequency rather than phonology — these initials carry
 * far more second tones than first ones — and it is the one place where the
 * basic form is not the first tone.
 */
export const SONORANT_INITIALS = new Set<Initial>(["l", "m", "n", "r"]);

/**
 * The letters that count as a vowel for the tonal rules.
 *
 * `y` is the empty rhyme and `è` is pinyin's ê; both are the whole of the rime
 * they appear in, so both take the doubling and the `-r` exactly as a vowel
 * does.
 */
export const VOWELS = "aeiouyè";

/**
 * The vowels a tone mark can sit on in pinyin, in the order the rule tries
 * them, which is what "the main vowel" means for the third tone's doubling.
 */
export const MAIN_VOWELS = ["a", "o", "e"] as const;

/**
 * Whether a letter is one the tonal rules treat as a vowel.
 *
 * Spelled out rather than written `VOWELS.includes(letter)` because
 * `"aeiouyè".includes("")` is true, and the letter before the first one of a
 * spelling is exactly that: the empty string. A rule asking "is the letter
 * before this one a vowel" would silently say yes at the start of every
 * syllable.
 */
export function isVowel(letter: string | undefined): boolean {
  return letter !== undefined && letter !== "" && VOWELS.includes(letter);
}

/**
 * Where the rime's vowels start and end.
 *
 * The five syllables with no vowel letter at all — the syllabic nasals 呣, 唔,
 * 嗯 and their aspirated pair — fall back to the last letter, so that the rules
 * asking for "the vowel" have something to work on. GR has no attested
 * spelling for any of them; see `docs/romanization/`.
 */
export function vowelSpan(form: string): readonly [number, number] {
  let start = 0;
  while (start < form.length && !isVowel(form[start])) {
    start += 1;
  }
  if (start === form.length) {
    return [form.length - 1, form.length - 1];
  }
  let end = start;
  while (isVowel(form[end + 1])) {
    end += 1;
  }
  return [start, end];
}
