import type { Syllable } from "../syllable/syllable.js";
import { isBu, isCounting, isYi, yiToneBefore } from "./sandhi-tones.js";
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
 * How the syllables group, for third-tone sandhi to read.
 *
 * One entry per word: its syllable count, or the counts of the constituents it
 * divides into. 老板 很 好 is `[2, 1, 1]` and 纸老虎 is `[[1, 2]]`.
 *
 * Sandhi's domain is the prosodic foot rather than the word, and the foot is
 * built from structure — which is why this is worth carrying. See
 * {@link applyThirdTone} for what is done with it.
 */
export type SandhiGrouping = readonly (number | readonly number[])[];

/**
 * Where sandhi may apply, as the index of the syllable that would lower.
 *
 * Every junction is between adjacent syllables — words and their constituents
 * cover the reading end to end — so one index says all of it, and the three
 * lists are the three passes {@link applyThirdTone} makes.
 */
interface SandhiJunctions {
  /** Inside a constituent. */
  readonly inner: readonly number[];
  /** Between the constituents of a word. */
  readonly parts: readonly number[];
  /** Between a single-syllable word and the word after it. */
  readonly words: readonly number[];
}

/**
 * Read a grouping as the junctions it puts in the syllable array.
 *
 * The whole array is treated as one undivided word where no grouping is given,
 * or where the one given does not account for exactly the syllables there are —
 * a grouping that does not fit is describing some other text, and guessing
 * which syllables it meant would be worse than ignoring it.
 */
function junctionsOf(
  length: number,
  grouping?: SandhiGrouping,
): SandhiJunctions {
  const undivided: SandhiJunctions = {
    inner: Array.from({ length: Math.max(length - 1, 0) }, (_, at) => at),
    parts: [],
    words: [],
  };
  if (grouping === undefined) {
    return undivided;
  }

  const inner: number[] = [];
  const parts: number[] = [];
  const words: number[] = [];
  let at = 0;
  for (const [index, word] of grouping.entries()) {
    const divisions = typeof word === "number" ? [word] : word;
    const from = at;
    for (const [division, size] of divisions.entries()) {
      for (let step = 1; step < size; step++) {
        inner.push(at + step - 1);
      }
      at += size;
      // The junction closing a word's last constituent is the one *around* the
      // word rather than one inside it.
      if (division < divisions.length - 1) {
        parts.push(at - 1);
      }
    }
    if (at - from === 1 && index < grouping.length - 1) {
      words.push(at - 1);
    }
  }
  return at === length ? { inner, parts, words } : undivided;
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
 * 不 assimilates to whatever follows it and needs nothing but the syllables.
 * Third-tone sandhi is not like that — its domain is the foot rather than the
 * syllable string — so `grouping` says where the words and their parts are.
 * Without one the whole array is taken for a single word, which is what a
 * caller holding nothing but a reading has. 一 sits between the two: the tone it
 * takes is settled by the syllables, and whether it takes one at all is a
 * question about the 汉字, so `characters` carries them where the caller has
 * them. See {@link isCounting}.
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

  for (const [at, syllable] of applied.entries()) {
    const following = applied[at + 1];

    if (yiBu && isYi(syllable) && syllable.tone === 1) {
      // A 一 that is not counting keeps its citation tone, so it is left
      // exactly as the dictionary stored it.
      if (isCounting(applied, at, characters)) {
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
    }
  }

  return applied;
}
