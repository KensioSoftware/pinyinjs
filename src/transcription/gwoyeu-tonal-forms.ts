/**
 * The tonal rules: how Gwoyeu Romatzyh spells a tone into the syllable itself.
 *
 * This is what makes GR the system it is, and unlike the spelling tables it is
 * all string work — given a basic form and a tone, produce the form carrying
 * it. `gwoyeu.ts` builds the basic form and hands it here.
 */
import type { Initial } from "../syllable/phonology.js";

/**
 * A tone that GR spells, which is the four contour tones.
 *
 * The neutral tone is the dot and has no spelling of its own, and an unwritten
 * tone has nothing to write.
 */
export type ContourTone = 1 | 2 | 3 | 4;

/**
 * The sonorant initials, which swap what the first two tones do.
 *
 * A syllable beginning l-, m-, n- or r- takes an `-h-` as its second letter in
 * the first tone and is left alone in the second: 媽 mā is `mha` and 麻 má is
 * `ma`. The reason is frequency rather than phonology — these initials carry
 * far more second tones than first ones — and it is the one place where the
 * basic form is not the first tone.
 */
const SONORANT_INITIALS = new Set<Initial>(["l", "m", "n", "r"]);

/**
 * The letters that count as a vowel for the tonal rules.
 *
 * `y` is the empty rhyme and `è` is pinyin's ê; both are the whole of the rime
 * they appear in, so both take the doubling and the `-r` exactly as a vowel
 * does.
 */
const VOWELS = "aeiouyè";

/**
 * The vowels a tone mark can sit on in pinyin, in the order the rule tries
 * them, which is what "the main vowel" means for the third tone's doubling.
 */
const MAIN_VOWELS = ["a", "o", "e"] as const;

/**
 * Whether a letter is one the tonal rules treat as a vowel.
 *
 * Spelled out rather than written `VOWELS.includes(letter)` because
 * `"aeiouyè".includes("")` is true, and the letter before the first one of a
 * spelling is exactly that: the empty string. A rule asking "is the letter
 * before this one a vowel" would silently say yes at the start of every
 * syllable.
 */
function isVowel(letter: string | undefined): boolean {
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
function vowelSpan(form: string): readonly [number, number] {
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

/**
 * Tone 1: the basic form, with `-h-` inserted after a sonorant initial.
 */
function firstTone(form: string, initial: Initial): string {
  return SONORANT_INITIALS.has(initial)
    ? `${form.slice(0, 1)}h${form.slice(1)}`
    : form;
}

/**
 * The i or u a glide can be written on, turned into y or w.
 *
 * The rule is `NiV → NyV` and `NuV → NwV`, where N is a non-vowel or nothing at
 * all: the i or u has to be the medial rather than part of a diphthong, which
 * is what the "not preceded by a vowel" test says. The `+ -i if final` clause
 * covers the rimes that are nothing but the medial — `i` becomes `yi` and not
 * a bare `y`.
 */
function glided(form: string): string | undefined {
  for (const [letter, glide] of [
    ["i", "y"],
    ["u", "w"],
  ] as const) {
    const at = form.indexOf(letter);
    if (at !== -1 && !isVowel(form[at - 1])) {
      const rest = form.slice(at + 1);
      return `${form.slice(0, at)}${glide}${rest === "" ? letter : rest}`;
    }
  }
  return undefined;
}

/**
 * Tone 2: i/u to y/w, or an `-r` after the vowels.
 */
function secondTone(form: string, initial: Initial): string {
  if (SONORANT_INITIALS.has(initial)) {
    return form;
  }
  const glide = glided(form);
  if (glide !== undefined) {
    return glide;
  }
  const [, end] = vowelSpan(form);
  return `${form.slice(0, end + 1)}r${form.slice(end + 1)}`;
}

/**
 * The i or u a third tone can be swapped for e or o.
 *
 * `Vi`/`iV` becomes `Ve`/`eV` and `Vu`/`uV` becomes `Vo`/`oV`, so the letter
 * has to sit beside a vowel; where both an i and a u are available it is
 * whichever comes *first* that changes, which is why 交 jiǎo is `jeau` and not
 * `jiao`. The swap is abandoned where it would produce `ee` or `oo`, both of
 * which are the doubling below and would collide with it.
 */
function swapped(form: string): string | undefined {
  const found = (
    [
      ["i", "e"],
      ["u", "o"],
    ] as const
  )
    .map(([letter, swap]) => [form.indexOf(letter), swap] as const)
    .filter(([at]) => at !== -1)
    .toSorted((one, other) => one[0] - other[0])[0];
  if (found === undefined) {
    return undefined;
  }
  const [at, swap] = found;
  const before = form[at - 1];
  const after = form[at + 1];
  const isBeside = isVowel(before) || isVowel(after);
  const isDoubles = before === swap || after === swap;
  return isBeside && !isDoubles
    ? `${form.slice(0, at)}${swap}${form.slice(at + 1)}`
    : undefined;
}

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
