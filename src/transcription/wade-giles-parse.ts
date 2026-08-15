/**
 * Getting a written Wade-Giles syllable into the shape the indexes are keyed by.
 *
 * Everything a spelling has to be put through before it can be looked up: the
 * apostrophes normalised, the 儿化 suffix and the tone digit taken off, and — for
 * the loose reading — the question of whether what was written is some spelling
 * with its marks dropped. None of it consults the inventory, which is what keeps
 * it separate from the reading itself.
 */
import { normaliseSuperscript } from "../tone/tone-mark.js";
import { type Tone, toneFromNotation } from "../tone/tone.js";
import { DROPPED_MARKS, withoutMarks } from "./wade-giles-index.js";
import {
  APOSTROPHE,
  APOSTROPHES,
  ERHUA_SUFFIX,
} from "./wade-giles-spelling.js";

/**
 * Take a trailing tone digit off, raised or on the line.
 */
export function splitTone(text: string): readonly [string, Tone | undefined] {
  const found = /^(.*?)([0-5])$/u.exec(normaliseSuperscript(text));
  const digit = found?.[2];
  if (found === null || digit === undefined) {
    return [text, undefined];
  }
  return [found[1] ?? "", toneFromNotation(Number(digit))];
}

/**
 * Normalise a written syllable to the shape the exact index is keyed by.
 */
export function normalise(text: string): string {
  return text
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replaceAll(APOSTROPHES, () => APOSTROPHE);
}

/**
 * Whether `written` is `spelling` with some of its marks dropped.
 *
 * Dropped, and never added: a text that wrote `chʻu` did not mean `chü`, and
 * only a text that wrote `chu` could have meant either. Allowing for a mark
 * that should not be there would double the candidate lists to catch a mistake
 * nobody makes, since the marks are dropped by not being typed rather than by
 * being typed wrongly.
 *
 * Per mark rather than all or nothing, because that is how they come off:
 * `chʻu` has kept its apostrophe and lost a diaeresis it may or may not have
 * had, so it is 出 chū or 去 qù but not 朱 zhū.
 */
export function isMarksDropped(spelling: string, written: string): boolean {
  let at = 0;
  for (const character of spelling) {
    const dropped = DROPPED_MARKS.get(character);
    if (written[at] === character) {
      at += 1;
    } else if (dropped !== undefined && written.startsWith(dropped, at)) {
      at += dropped.length;
    } else {
      return false;
    }
  }
  return at === written.length;
}

/**
 * Take the 儿化 suffix off a normalised spelling.
 *
 * Done before the tone digit is read rather than after, because the digit is
 * written in front of the suffix: `wan²-'rh` is a second-tone 玩 carrying it.
 *
 * Read loosely the apostrophe may have fallen off, so `-rh` is a suffix too;
 * read exactly it is not, and neither is `-êrh` under either reading. That is
 * the point of the reduced form: 女儿 nǚ'ér is `nü³-êrh²`, two syllables, and
 * a suffix spelled the same way would make the two indistinguishable.
 */
export function splitErhua(
  spelling: string,
  isLoose: boolean,
): readonly [string, boolean] {
  const suffixes = isLoose
    ? [ERHUA_SUFFIX, withoutMarks(ERHUA_SUFFIX)]
    : [ERHUA_SUFFIX];
  const suffix = suffixes.find((one) => spelling.endsWith(one));
  return suffix === undefined
    ? [spelling, false]
    : [spelling.slice(0, -suffix.length), true];
}
