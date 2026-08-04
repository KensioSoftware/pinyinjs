import type { Syllable } from "../syllable/syllable.js";
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
      applied[at] = { ...syllable, tone: yiToneBefore(following?.tone) };
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
