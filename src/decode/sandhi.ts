import type { Syllable } from "../syllable/syllable.js";
import {
  endingsOf,
  junctionsOf,
  type SandhiGrouping,
} from "./sandhi-grouping.js";
import { isBu, isCounting, isYi, yiToneBefore } from "./sandhi-tones.js";

export type { SandhiGrouping } from "./sandhi-grouping.js";

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
 * Lower a third tone to a second where the syllable after it is a third too.
 *
 * Reads the array as it stands, which is what makes the passes below cyclic:
 * a junction inside a word is settled before the junction around it is asked
 * about, so the outer one sees a tone the inner one may already have changed.
 */
function chain(applied: Syllable[], at: number): void {
  const syllable = applied[at];
  if (syllable?.tone === 3 && applied[at + 1]?.tone === 3) {
    applied[at] = { ...syllable, tone: 2 };
  }
}

/**
 * Write third tones as seconds, over the domains the grouping describes.
 *
 * The rule is usually stated as "a third tone before another third tone is
 * said as a second", and stated that way it is wrong as often as it is right:
 * 老保管 is `lǎo báoguǎn` rather than `láo báoguǎn`, and 這家銀行的行長很喜歡旅行
 * has `hángzhǎng hén xǐhuan` and not `hángzháng hén`. Sandhi's domain is the
 * prosodic foot, which is built out of structure, and a flat left-to-right scan
 * of the syllables cannot see any.
 *
 * Three passes, innermost first, each reading what the one before it left:
 *
 * 1. **Within a constituent.** Every third tone but the last becomes a second,
 *    which is the familiar rule and the only one that holds unconditionally.
 * 2. **Between the constituents of a word.** 展覽館 divides as 展覽 + 館, and
 *    the inner pass has already made 展 a second, so 覽 lowers against 館 to
 *    give `zhánlánguǎn`. 紙老虎 divides the other way, as 紙 + 老虎: 老 lowered
 *    against 虎 in the inner pass, so 紙 now sees a second tone and stays as it
 *    is — `zhǐláohǔ`. Same rule, opposite results, decided by where the word
 *    divides.
 * 3. **Between words, where the left one is a single syllable.** A monosyllable
 *    leans on the word after it and joins its foot, which is what lowers the 很
 *    of 很喜歡 and the 我 and 也 of 我也很好. Two full words do not form one foot,
 *    so 行長 keeps its 長 and 老闆 its 闆.
 *
 * What the third pass gives up is the monosyllable that leans **backwards**:
 * 保管好 is `báoguán hǎo`, its 好 a complement of the verb before it, and this
 * leaves it as `báoguǎn hǎo`. Telling that apart from 老闆很好 needs to know
 * which way the monosyllable attaches, which is a question about syntax rather
 * than about the words themselves.
 */
function applyThirdTone(
  syllables: readonly Syllable[],
  grouping?: SandhiGrouping,
): Syllable[] {
  const applied = [...syllables];
  const junctions = junctionsOf(syllables.length, grouping);

  for (const pass of [junctions.inner, junctions.parts, junctions.words]) {
    for (const at of pass) {
      chain(applied, at);
    }
  }

  return applied;
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
 * A caller holding nothing but a reading can still use this, and several do:
 * `pinyinjs sandhi bùshì` and the numeral reader both hand over syllables and
 * nothing else. `grouping` and `characters` are what a caller that knows more
 * says so with, and each one is read on its own, since a caller can have one
 * and not the other.
 *
 * `characters` holds one 汉字 per syllable, and is what tells 一 and 不 apart
 * from the syllables that merely sound like them — 医生 is `yīshēng` and 部队
 * is `bùduì`. Without it the pass falls back to the spellings, which is all
 * bare pinyin offers. See {@link isYi} and {@link isCounting}.
 *
 * `grouping` says where the words and their parts are. Third-tone sandhi needs
 * it because its domain is the prosodic foot rather than the syllable string,
 * and 一 needs the word ends out of it: a 一 that closes a longer word is not
 * counting the word after it. Without a grouping the whole array is taken for
 * a single word, which is all a bare reading says.
 *
 * 不 is the one rule that needs neither: it assimilates to whatever follows.
 *
 * Never operates on a string. The old project patched output text with regexes,
 * which is what made its rules order-dependent and untestable.
 */
export function applySandhi(
  syllables: readonly Syllable[],
  options: SandhiOptions = {},
  grouping?: SandhiGrouping,
  characters?: readonly (string | undefined)[],
): readonly Syllable[] {
  const { yiBu = true, thirdTone = false } = options;
  const applied = thirdTone
    ? applyThirdTone(syllables, grouping)
    : [...syllables];

  const endings = endingsOf(syllables.length, grouping);
  for (const [at, syllable] of applied.entries()) {
    const character = characters?.[at];
    const following = applied[at + 1];

    if (yiBu && isYi(syllable, character) && syllable.tone === 1) {
      // A 一 that is not counting keeps its citation tone, so it is left
      // exactly as the dictionary stored it.
      if (isCounting(applied, at, characters)) {
        // A 一 closing a longer word counts nothing, because what follows it
        // is outside the word: 唯一 is `wéiyī` whatever comes next, and so are
        // 之一, 统一 and 星期一. The 一 of 一个 is a word of its own, which is
        // why it still assimilates across the boundary.
        const counted = endings.has(at) ? undefined : following;
        applied[at] = { ...syllable, tone: yiToneBefore(counted?.tone) };
      }
      continue;
    }
    // 不 flattens to second tone before a fourth, and is otherwise unchanged.
    // Unlike 一 it keeps assimilating at the end of a word, since what it
    // negates is regularly in the next one: 决不会 is `juébú huì`.
    if (
      yiBu &&
      isBu(syllable, character) &&
      syllable.tone === 4 &&
      following?.tone === 4
    ) {
      applied[at] = { ...syllable, tone: 2 };
    }
  }

  return applied;
}
