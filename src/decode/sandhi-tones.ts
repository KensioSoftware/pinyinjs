/**
 * Which tone 一 and 不 take, and when a 一 is being counted rather than said.
 *
 * Both characters change tone by what follows them, and 一 additionally does
 * not change at all when it is a number being counted off.
 */
import { type Syllable, writeSyllableSpelling } from "../syllable/syllable.js";
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";

/**
 * Whether a syllable is 一, which is the only thing spelled `yi` that sandhis.
 */
export function isYi(syllable: Syllable): boolean {
  return syllable.initial === "" && syllable.final === "i";
}

/**
 * Whether a syllable is 不.
 */
export function isBu(syllable: Syllable): boolean {
  return syllable.initial === "b" && syllable.final === "u";
}

/**
 * The tone 一 takes before a given following tone.
 *
 * Fourth tone flattens it to second; anything else raises it to fourth. Before
 * a neutral tone or at the end of a phrase it keeps its citation first tone,
 * since there is nothing to assimilate to.
 */
export function yiToneBefore(following: Tone | undefined): Tone {
  if (following === undefined || following === NEUTRAL_TONE) {
    return 1;
  }
  return following === 4 ? 2 : 4;
}

/**
 * The numeral words a 一 can be the last digit of.
 *
 * Toneless, because what is being asked is which word it is rather than what
 * tone it is carrying, and 十 is `shí` in every context it appears in here.
 *
 * **亿 is deliberately absent**, and that is measured rather than assumed: no
 * 一 in 88,866 lines of Tatoeba and zh.wikipedia ends a number in 亿, while 意,
 * 议, 义 and 議 all read `yì`, all precede a 一 that really is counting, and
 * would all lose their sandhi for it — 11 conversions against nothing gained.
 * The other three stay, because a number can end 百一 or 千一 even though this
 * corpus has none, and the one thing they cost is 擺一個.
 */
export const NUMERAL_WORDS = new Set(["shi", "bai", "qian", "wan"]);

/**
 * The words that carry a number on past a 一, so that it is still counting.
 *
 * 一百一十's second 一 counts the ten it is followed by and takes the sandhi;
 * 二十一's does not, because nothing numeric comes after it.
 */
export const CONTINUES_NUMBER = new Set([...NUMERAL_WORDS, "ling"]);

/**
 * The ordinal prefix 第.
 */
export const ORDINAL_PREFIX = "di";

/**
 * Whether a 一 is counting something, which is the only time it takes sandhi.
 *
 * The rule 一 sandhi is usually stated with — fourth tone flattens it, anything
 * else raises it — is about the 一 that *counts*. Two shapes of 一 are not
 * counting and keep the citation tone, and both are standard:
 *
 * - **The last digit of a larger number.** 十一月 is `shíyīyuè` and 二十一岁 is
 *   `èrshíyī suì`. The signal is a numeral word before it with nothing numeric
 *   after, which is what leaves 一百一十's middle 一 alone: 十 follows it, so it
 *   is counting the ten.
 * - **An ordinal.** 第一个 is `dìyī gè`.
 *
 * **Read off the syllables rather than the characters**, because that is all
 * this pass has: `pinyinjs sandhi shíyī gè` never sees a hanzi. So it cannot
 * tell 十 from 时 or 第 from 地, and `docs/sandhi/` carries what that costs —
 * measured, not estimated.
 */
export function isCounting(
  syllables: readonly Syllable[],
  at: number,
): boolean {
  const spelt = (index: number): string => {
    const syllable = syllables[index];
    return syllable === undefined ? "" : writeSyllableSpelling(syllable);
  };
  const before = spelt(at - 1);
  if (before === ORDINAL_PREFIX) {
    return false;
  }
  return !NUMERAL_WORDS.has(before) || CONTINUES_NUMBER.has(spelt(at + 1));
}
