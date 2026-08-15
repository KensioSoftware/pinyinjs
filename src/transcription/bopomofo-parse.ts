/**
 * Reading a run of bopomofo symbols into the parts of a syllable.
 *
 * The tone mark is taken off first, since it sits after the symbols and the
 * neutral dot sits before them, and what is left is matched against the tables
 * a medial and a rhyme at a time.
 */
import type { Initial } from "../syllable/phonology.js";
import type { Medial, Rhyme } from "./bopomofo-symbols.js";
/**
 * Bopomofo (注音符號), in both directions.
 *
 * This is the easy half of romanisation interchange, and the reason is
 * [phonology.ts](../syllable/phonology.ts): a parsed syllable already holds the
 * underlying initial and final rather than the spelling, and bopomofo writes
 * exactly those. 就 is
 * `j` + `iou` and ㄐㄧㄡ; 军 is `j` + `ün` and ㄐㄩㄣ; 中 is `zh` + `ong` and
 * ㄓㄨㄥ. Nothing here undoes a pinyin spelling rule, because `readSyllable`
 * never applied one.
 *
 * So the mapping is compositional — an initial symbol, a medial symbol and a
 * rhyme symbol — and it is a bijection over the whole syllable inventory. The
 * three places it is not quite mechanical are recorded on the tables below.
 */
import { toCharacters } from "../script/characters.js";
import type { Tone } from "../tone/tone.js";
import { ERHUA_SYMBOL, TONES_BY_MARK } from "./bopomofo-symbols.js";

export {
  type BopomofoOptions,
  writeBopomofo,
  writeBopomofoWord,
} from "./bopomofo-symbols.js";
import {
  INITIALS_BY_SYMBOL,
  MEDIALS_BY_SYMBOL,
  RHYMES_BY_SYMBOL,
} from "./bopomofo-reverse.js";

/**
 * A syllable's symbols, taken off the front of the string in order.
 */
export interface Parsed {
  readonly initial: Initial;
  readonly medial: Medial;
  readonly rhyme: Rhyme;
  readonly hasErhua: boolean;
}

/**
 * Take the tone mark off, wherever it was written.
 *
 * Three positions, because bopomofo uses two of them and texts use the third.
 * The neutral dot belongs at the front and the other four at the back, in front
 * of a 儿化 ㄦ where there is one — ㄨㄢˊㄦ. A mark written after the ㄦ is not
 * standard and is read anyway, since it is what a text that treated the suffix
 * as part of the syllable would produce. A mark at each end is rejected rather
 * than resolved, which is the same call `readSyllable` makes about `běi3`.
 */
export function splitTone(
  text: string,
): readonly [string, Tone | undefined] | undefined {
  const leading = TONES_BY_MARK.get(text.slice(0, 1));
  if (leading !== undefined) {
    const rest = text.slice(1);
    return TONES_BY_MARK.has(rest.slice(-1)) ? undefined : [rest, leading];
  }
  const trailing = TONES_BY_MARK.get(text.slice(-1));
  if (trailing !== undefined) {
    return [text.slice(0, -1), trailing];
  }
  if (text.endsWith(ERHUA_SYMBOL)) {
    const marked = TONES_BY_MARK.get(text.slice(-2, -1));
    if (marked !== undefined) {
      return [`${text.slice(0, -2)}${ERHUA_SYMBOL}`, marked];
    }
  }
  return [text, undefined];
}

/**
 * Read the symbols of one syllable, in the order bopomofo writes them.
 *
 * `hasInitial` is what recovers the syllabic nasals on a second pass: ㄇ is an
 * initial letter, so 呣 m̄ parses as an m initial with nothing after it and has
 * to be retried as a rhyme standing alone. `readParts` in
 * [syllable.ts](../syllable/syllable.ts) retries n and ng the same way, for the
 * same reason.
 */
export function parseSymbols(
  text: string,
  hasInitial: boolean,
): Parsed | undefined {
  const symbols = toCharacters(text);
  let at = 0;

  const initial = hasInitial
    ? INITIALS_BY_SYMBOL.get(symbols[at] ?? "")
    : undefined;
  if (initial !== undefined) {
    at += 1;
  }
  const medial = MEDIALS_BY_SYMBOL.get(symbols[at] ?? "");
  if (medial !== undefined) {
    at += 1;
  }
  // ㄦ is the 儿化 suffix everywhere except at the very front of a syllable,
  // where it is the rhyme of 儿 ér itself. That is what separates ㄦ from ㄕㄦ:
  // 事儿 shìr writes no rhyme at all, so the ㄦ can only be the suffix, and
  // 二儿 èr with a suffix is ㄦㄦ.
  const isSuffix = at > 0 && symbols[at] === ERHUA_SYMBOL;
  const rhyme = isSuffix ? undefined : RHYMES_BY_SYMBOL.get(symbols[at] ?? "");
  if (rhyme !== undefined) {
    at += 1;
  }
  const hasErhua = at > 0 && symbols[at] === ERHUA_SYMBOL;
  if (hasErhua) {
    at += 1;
  }

  return at === symbols.length
    ? {
        initial: initial ?? "",
        medial: medial ?? "",
        rhyme: rhyme ?? "",
        hasErhua,
      }
    : undefined;
}
