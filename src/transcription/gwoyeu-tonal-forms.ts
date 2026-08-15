/**
 * The tonal rules: how Gwoyeu Romatzyh spells a tone into the syllable itself.
 *
 * This is what makes GR the system it is, and unlike the spelling tables it is
 * all string work — given a basic form and a tone, produce the form carrying
 * it. `gwoyeu.ts` builds the basic form and hands it here.
 */
import type { Initial } from "../syllable/phonology.js";
import { firstTone, secondTone, swapped } from "./gwoyeu-first-second.js";

/**
 * A tone that GR spells, which is the four contour tones.
 *
 * The neutral tone is the dot and has no spelling of its own, and an unwritten
 * tone has nothing to write.
 */
export type ContourTone = 1 | 2 | 3 | 4;
import { isVowel, MAIN_VOWELS, vowelSpan } from "./gwoyeu-vowels.js";
/**
 * Tone 3, where the swap does not apply: double the main vowel.
 *
 * The main vowel is the one a pinyin tone mark would sit on — a, then o or e,
 * then the last vowel there is — so 請 qǐng is `chiing` and 給 gěi is `geei`.
 */
function doubled(form: string): string {
  const [start, end] = vowelSpan(form);
  const rime = form.slice(start, end + 1);
  const main = MAIN_VOWELS.map((vowel) => rime.indexOf(vowel)).find(
    (at) => at !== -1,
  );
  const at = start + (main ?? rime.length - 1);
  return `${form.slice(0, at + 1)}${form.slice(at, at + 1)}${form.slice(at + 1)}`;
}

/**
 * Tone 3: i/u to e/o beside a vowel, or the main vowel doubled.
 */
function thirdTone(form: string): string {
  return swapped(form) ?? doubled(form);
}

/**
 * Tone 4: change or double the last letter, or add `-h`.
 *
 * The `⇏iw` clause is why 去 qù is `chiuh` and not `chiw`: the u of `iu` is the
 * ü rather than the second half of a diphthong, and turning it into a w would
 * say the wrong thing about the vowel.
 */
export function fourthTone(form: string): string {
  const last = form.slice(-1);
  const before = form.slice(-2, -1);
  if (last === "i" && isVowel(before)) {
    return `${form.slice(0, -1)}y`;
  }
  if (last === "u" && isVowel(before) && before !== "i") {
    return `${form.slice(0, -1)}w`;
  }
  if (form.endsWith("ng")) {
    return `${form.slice(0, -2)}nq`;
  }
  if (last === "n" || last === "l") {
    return `${form}${last}`;
  }
  return `${form}h`;
}

/**
 * Put the y- or w- on a syllable that has no initial, in tones 3 and 4.
 *
 * **This is the one place where the published rules needed amending, and the
 * amendment is a correction of one word.** They say that a basic form starting
 * i- or u- has that letter *replaced* by y- or w- (tone 4), or changed to e- or
 * o- with a y- or w- added (tone 3). Applied literally that deletes a vowel the
 * attested spellings keep: 一 yī's basic form is `i`, and tone 4 comes out `yh`
 * where the source has `yih`. Nine cells of the syllabary fail that way, all of
 * them a rime that is bare or closed by a consonant — `yii`, `yih`, `wuu`,
 * `wuh`, `yiin`, `yinn`, `yiing`, `yinq`, `yuh`.
 *
 * The rime table of *Spelling in Gwoyeu Romatzyh* says what actually happens,
 * and it is one rule rather than two: **the letter replaced is a medial**, so
 * it goes only when a different vowel follows it. `iuh` has a u after the i and
 * becomes `yuh`; `ih` has an h and becomes `yih`; `ii` has the same vowel
 * doubled, which is not a following vowel at all, and becomes `yii`. Tone 3
 * needs no separate clause once that is said, because its own swap has already
 * eaten the medial wherever there was one.
 */
export function zeroInitial(form: string, basic: string): string {
  const onset = basic.slice(0, 1);
  if (onset !== "i" && onset !== "u") {
    return form;
  }
  const glide = onset === "i" ? "y" : "w";
  const next = form[1];
  const isMedial =
    form.slice(0, 1) === onset && isVowel(next) && next !== onset;
  return `${glide}${isMedial ? form.slice(1) : form}`;
}

/**
 * Apply the tonal rules to a basic form, which is the whole of them.
 */
export function tonalForm(
  basic: string,
  initial: Initial,
  tone: ContourTone,
): string {
  if (tone === 1) {
    return firstTone(basic, initial);
  }
  if (tone === 2) {
    return secondTone(basic, initial);
  }
  const changed = tone === 3 ? thirdTone(basic) : fourthTone(basic);
  return initial === "" ? zeroInitial(changed, basic) : changed;
}
