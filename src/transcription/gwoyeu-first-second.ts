/**
 * The first and second tone rules, the two that reach for a glide.
 *
 * Both work on the rime's vowels rather than the syllable as a whole, and the
 * sonorant initials swap what the two of them do.
 */
import type { Initial } from "../syllable/phonology.js";
import { isVowel, SONORANT_INITIALS, vowelSpan } from "./gwoyeu-vowels.js";

/**
 * Tone 1: the basic form, with `-h-` inserted after a sonorant initial.
 */
export function firstTone(form: string, initial: Initial): string {
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
export function glided(form: string): string | undefined {
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
export function secondTone(form: string, initial: Initial): string {
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
export function swapped(form: string): string | undefined {
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
