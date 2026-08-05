import { type Syllable, writeSyllableSpelling } from "../syllable/syllable.js";
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";

/**
 * How much of the sandhi to apply.
 */
export interface SandhiOptions {
  /**
   * Whether 一 and 不 take their contextual tones.
   *
   * On by default: these are written in standard orthography, so 不是 is `bú
   * shì` on the page, not `bù shì`.
   */
  readonly yiBu?: boolean;
  /**
   * Whether a third tone before another third tone is written as a second.
   *
   * **Off by default, deliberately.** 你好 is written `nǐ hǎo` even though it is
   * said `ní hǎo`: standard orthography writes the underlying tones, and a
   * learner wants to see them. Available for callers transcribing speech.
   */
  readonly thirdTone?: boolean;
}

/**
 * Whether a syllable is 一, which is the only thing spelled `yi` that sandhis.
 */
function isYi(syllable: Syllable): boolean {
  return syllable.initial === "" && syllable.final === "i";
}

/**
 * Whether a syllable is 不.
 */
function isBu(syllable: Syllable): boolean {
  return syllable.initial === "b" && syllable.final === "u";
}

/**
 * The tone 一 takes before a given following tone.
 *
 * Fourth tone flattens it to second; anything else raises it to fourth. Before
 * a neutral tone or at the end of a phrase it keeps its citation first tone,
 * since there is nothing to assimilate to.
 */
function yiToneBefore(following: Tone | undefined): Tone {
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
const NUMERAL_WORDS = new Set(["shi", "bai", "qian", "wan"]);

/**
 * The words that carry a number on past a 一, so that it is still counting.
 *
 * 一百一十's second 一 counts the ten it is followed by and takes the sandhi;
 * 二十一's does not, because nothing numeric comes after it.
 */
const CONTINUES_NUMBER = new Set([...NUMERAL_WORDS, "ling"]);

/**
 * The ordinal prefix 第.
 */
const ORDINAL_PREFIX = "di";

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
function isCounting(syllables: readonly Syllable[], at: number): boolean {
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

/**
 * Apply the tone sandhi that standard orthography writes.
 *
 * The dictionary stores underlying tones — 一 is always `yī` and 不 always `bù`
 * there, because upstream bakes sandhi in inconsistently and a baked-in tone
 * cannot be switched off or applied across a word boundary. This is where the
 * contextual tone is put back, over the whole syllable array rather than within
 * a word, which is what lets 不 in one word assimilate to a tone in the next.
 *
 * Never operates on a string. The old project patched output text with regexes,
 * which is what made its rules order-dependent and untestable.
 */
export function applySandhi(
  syllables: readonly Syllable[],
  options: SandhiOptions = {},
): readonly Syllable[] {
  const { yiBu = true, thirdTone = false } = options;
  const applied = [...syllables];

  for (const [at, syllable] of applied.entries()) {
    const following = applied[at + 1];

    if (yiBu && isYi(syllable) && syllable.tone === 1) {
      // A 一 that is not counting keeps its citation tone, so it is left
      // exactly as the dictionary stored it.
      if (isCounting(applied, at)) {
        applied[at] = { ...syllable, tone: yiToneBefore(following?.tone) };
      }
      continue;
    }
    // 不 flattens to second tone before a fourth, and is otherwise unchanged.
    if (
      yiBu &&
      isBu(syllable) &&
      syllable.tone === 4 &&
      following?.tone === 4
    ) {
      applied[at] = { ...syllable, tone: 2 };
      continue;
    }
    // Third-tone sandhi reads left to right off the *underlying* tones, so the
    // following syllable is checked before it may itself have been rewritten.
    if (thirdTone && syllable.tone === 3 && syllables[at + 1]?.tone === 3) {
      applied[at] = { ...syllable, tone: 2 };
    }
  }

  return applied;
}
