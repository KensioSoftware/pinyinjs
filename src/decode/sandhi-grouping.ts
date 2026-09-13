/**
 * How the syllables group, and the two things sandhi reads out of a grouping.
 *
 * Third-tone sandhi wants the junctions, since its domain is the prosodic foot
 * and a foot is built from structure. 一 wants the word ends, since a 一 that
 * closes a longer word counts nothing after it. Both are answered here so that
 * `sandhi.ts` holds the rules rather than the bookkeeping.
 */

/**
 * How the syllables group, for sandhi to read.
 *
 * One entry per word: its syllable count, or the counts of the constituents it
 * divides into. 老板 很 好 is `[2, 1, 1]` and 纸老虎 is `[[1, 2]]`.
 *
 * Third-tone sandhi's domain is the prosodic foot rather than the word, and the
 * foot is built from structure — which is why this is worth carrying. See
 * {@link import("./sandhi.js").applySandhi}.
 */
export type SandhiGrouping = readonly (number | readonly number[])[];

/**
 * Where sandhi may apply, as the index of the syllable that would lower.
 *
 * Every junction is between adjacent syllables — words and their constituents
 * cover the reading end to end — so one index says all of it, and the three
 * lists are the three passes third-tone sandhi makes.
 */
export interface SandhiJunctions {
  /** Inside a constituent. */
  readonly inner: readonly number[];
  /** Between the constituents of a word. */
  readonly parts: readonly number[];
  /** Between a single-syllable word and the word after it. */
  readonly words: readonly number[];
}

/**
 * The syllable counts one grouping entry holds, as a flat list of its parts.
 */
function partsOf(word: number | readonly number[]): readonly number[] {
  return typeof word === "number" ? [word] : word;
}

/**
 * Read a grouping as the junctions it puts in the syllable array.
 *
 * The whole array is treated as one undivided word where no grouping is given,
 * or where the one given does not account for exactly the syllables there are —
 * a grouping that does not fit is describing some other text, and guessing
 * which syllables it meant would be worse than ignoring it.
 */
export function junctionsOf(
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
    const divisions = partsOf(word);
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
 * Where a word of more than one syllable ends, as indices into the array.
 *
 * Empty without a grouping, and empty for a grouping that does not fit, which
 * is the judgement {@link junctionsOf} makes and for the same reason.
 *
 * A one-syllable word is deliberately not an ending here. 一 on its own is a
 * word and it counts the word after it: see
 * {@link import("./sandhi.js").applySandhi}.
 */
export function endingsOf(
  length: number,
  grouping?: SandhiGrouping,
): ReadonlySet<number> {
  const endings = new Set<number>();
  if (grouping === undefined) {
    return endings;
  }

  let at = 0;
  for (const word of grouping) {
    const size = partsOf(word).reduce((total, part) => total + part, 0);
    at += size;
    if (size > 1) {
      endings.add(at - 1);
    }
  }
  return at === length ? endings : new Set();
}
