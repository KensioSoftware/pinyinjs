/**
 * The ways a typist may write a reading the dictionary stores one way.
 *
 * A stored reading is `yin2 hang2`: syllables separated, tones as digits, ü
 * written as ü. A query for it is whatever a keyboard makes easy. This module
 * holds the whole span between the two, so that the lookup itself can ask one
 * question — does this query spell this reading? — and nothing else.
 */
import { applyToneMark } from "../tone/tone-mark.js";
import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { TONES } from "../tone/tone.js";

/**
 * What a query may write between syllables, all of which mean nothing here.
 *
 * The same set the matcher accepts, minus its meaning: `match` treats a written
 * boundary as evidence, because a haystack it is filtering can be read more than
 * one way. A reverse index is asked for one reading and answers with the words
 * that have it, so `yin hang` and `yinhang` are the same question.
 */
export const SEPARATORS = /[\s'’‘-]+/gu;

/**
 * A tone written as a digit, which is the last character of a syllable.
 */
const TONE_DIGIT = /^[0-5]$/u;

/**
 * Every tone a syllable that wrote none could be standing for.
 */
const TONE_DIGITS = ["1", "2", "3", "4", "5"];

/**
 * The umlaut the readings are written with, and the letter a keyboard has.
 */
const UMLAUT = "ü";

const PLAIN_U = "u";

/**
 * The 儿化 suffix, which is the one letter a reading key keeps and a query may
 * leave off.
 */
export const ERHUA = "r";

/**
 * Every way a typist may write one syllable of a stored reading.
 *
 * `shi4` is written `shi`, `shi4` or `shì`; `lü4` adds `lu` and `lu4`, since ü
 * is not on the keyboard; and an 儿化 `wanr2` adds the whole set again with the
 * r left off, because 玩儿 is `wanr` to one typist and `wan` to another.
 *
 * The r comes off only where the syllable really is 儿化. 儿 itself is `er2`,
 * and letting that shed its r would answer `e` with 儿.
 */
function writingsOf(token: string): readonly string[] {
  const digit = token.slice(-1);
  const toned = TONE_DIGIT.test(digit);
  const spelling = toned ? token.slice(0, -1) : token;
  const syllable = readSyllable(token);
  // A reading with no tone written cannot contradict one, so a query is free to
  // write any. Every reading the shipped artifacts hold has a tone digit on it,
  // so this is a case a hand-built dictionary reaches rather than a real one.
  const tones = toned ? [digit] : TONE_DIGITS;

  const written = new Set<string>();
  const add = (form: string): void => {
    const plain = form.replaceAll(UMLAUT, PLAIN_U);
    written.add(form);
    written.add(plain);
    for (const tone of tones) {
      written.add(`${form}${tone}`);
      written.add(`${plain}${tone}`);
    }
    if (!toned) {
      for (const tone of TONES) {
        written.add(applyToneMark(form, tone));
      }
    }
  };
  add(spelling);
  if (syllable !== undefined) {
    written.add(writeSyllable(syllable, "marks"));
    if (syllable.erhua === true) {
      add(spelling.slice(0, -ERHUA.length));
      written.add(writeSyllable({ ...syllable, erhua: false }, "marks"));
    }
  }
  return [...written];
}

/**
 * Whether a query spells a reading, syllable by syllable.
 *
 * Walked as a set of positions the query can have been read up to rather than
 * one cursor, because a syllable can be written more than one way and the ways
 * are different lengths: `wanr2` is `wan` or `wanr`, and only what follows says
 * which was meant.
 */
export function spells(
  query: string,
  reading: string,
  writings: Map<string, readonly string[]>,
): boolean {
  let reached = new Set<number>([0]);
  for (const token of reading.split(" ")) {
    let forms = writings.get(token);
    if (forms === undefined) {
      forms = writingsOf(token);
      writings.set(token, forms);
    }
    const next = new Set<number>();
    for (const at of reached) {
      for (const form of forms) {
        if (query.startsWith(form, at)) {
          next.add(at + form.length);
        }
      }
    }
    if (next.size === 0) {
      return false;
    }
    reached = next;
  }
  return reached.has(query.length);
}
