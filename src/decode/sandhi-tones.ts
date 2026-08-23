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
 * The 汉字 {@link NUMERAL_WORDS} names, for a caller that has them.
 *
 * The spellings are ambiguous and the characters are not, which is the whole
 * point of carrying both. 是 is spelt `shi` and stands in front of a 一 in
 * 那是一条狗, 这是一个好主意 and several hundred sentences like them, and every
 * one of them lost its sandhi to a 十 that was never there. 时, 事, 使 and 试 do
 * the same.
 *
 * The 繁體 forms are here because a 繁體 text reaches this pass with 繁體
 * characters. 拾, 佰 and 仟 are the 大写 banking forms, which appear on cheques
 * and in contracts and count exactly as their everyday spellings do.
 */
export const NUMERAL_CHARACTERS = new Set([
  "十",
  "百",
  "千",
  "万",
  "萬",
  "拾",
  "佰",
  "仟",
]);

/**
 * The 汉字 {@link CONTINUES_NUMBER} names.
 */
export const CONTINUES_NUMBER_CHARACTERS = new Set([
  ...NUMERAL_CHARACTERS,
  "零",
  "〇",
]);

/**
 * The ordinal prefix as it is written.
 */
export const ORDINAL_CHARACTER = "第";

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
 * **Answered from the characters wherever the caller has them**, and from the
 * spellings where it does not. `pinyinjs sandhi shíyī gè` is handed nothing but
 * pinyin, so there the pass still cannot tell 十 from 时 or 第 from 地 and
 * `docs/sandhi/` carries what that costs. A conversion knows which 汉字 it read,
 * and passing them along is what stops 那是一条狗 losing its sandhi to the 是 in
 * front of the 一.
 *
 * The two sides are decided separately, because a run can know one and not the
 * other: a word whose reading has a different syllable count from its character
 * count has no character to offer for any one syllable.
 */
export function isCounting(
  syllables: readonly Syllable[],
  at: number,
  characters: readonly (string | undefined)[] = [],
): boolean {
  const spelt = (index: number): string => {
    const syllable = syllables[index];
    return syllable === undefined ? "" : writeSyllableSpelling(syllable);
  };
  const before = characters[at - 1];
  if (
    before === undefined
      ? spelt(at - 1) === ORDINAL_PREFIX
      : before === ORDINAL_CHARACTER
  ) {
    return false;
  }
  if (
    before === undefined
      ? !NUMERAL_WORDS.has(spelt(at - 1))
      : !NUMERAL_CHARACTERS.has(before)
  ) {
    return true;
  }
  const after = characters[at + 1];
  return after === undefined
    ? CONTINUES_NUMBER.has(spelt(at + 1))
    : CONTINUES_NUMBER_CHARACTERS.has(after);
}
