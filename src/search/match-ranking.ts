/**
 * Choosing between the places a query matched.
 *
 * The walk in `match-search.ts` answers *where* and *how* the query reads; this
 * answers *which of those is the match*. The two are separate because they weigh
 * different things: the walk scores a reading against the query as it goes, and
 * this scores a finished path against the haystack it lies in — how the text is
 * actually read, whether the match starts a word, how early it falls.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import type { Syllable } from "../syllable/syllable.js";
import { readQueryChunks } from "./query.js";
import {
  CONTEXT_READING,
  contextOf,
  EARLINESS,
  type MatchRange,
  type Path,
  rangesOf,
  type Step,
  WORD_START,
} from "./match-scoring.js";

/**
 * What a query matched, and how well.
 */
export interface PinyinMatch {
  /**
   * The stretches of the haystack the query spelled, in order.
   *
   * Usually one. There is more than one where the query ran over something
   * with no reading of its own: 北京·大学 is matched by `bjdx` as two ranges
   * with the separator between them left out, so that highlighting them marks
   * what was matched rather than what lay between.
   */
  readonly ranges: readonly MatchRange[];
  /**
   * How good the match is, where higher is better.
   *
   * For ordering the haystacks one query matched — sort descending and the
   * best is first. Comparable within a query and not across queries: what it
   * weighs is described at {@link CONTEXT_READING}, and none of it is a
   * probability.
   */
  readonly score: number;
}

/**
 * How much of a match was written the way the text is actually read.
 *
 * Asked of what the query wrote rather than of the reading the search happened
 * to take it by: 西 is stored with a neutral-toned `xi` and a first-tone `xī`,
 * and a query writing `xi` has picked neither of them over the other. What it
 * has done is write something the settled reading can account for, which is the
 * question — and the one `yx` over 银行 answers differently from `yh`.
 */
function agreementOf(
  query: string,
  steps: readonly Step[],
  preferred: readonly (Syllable | undefined)[],
): number {
  let comparable = 0;
  let agreeing = 0;
  for (const step of steps) {
    const settled = preferred[step.at];
    if (!step.isRead || settled === undefined) {
      continue;
    }
    comparable++;
    const written = readQueryChunks(query, step.from, settled);
    if (written.some((chunk) => chunk.next === step.next)) {
      agreeing++;
    }
  }
  return comparable === 0 ? 0 : agreeing / comparable;
}

/**
 * The best of the paths a query read, or undefined where it read none.
 */
export function bestMatch(
  dictionary: Dictionary,
  haystack: string,
  query: string,
  found: readonly Path[],
): PinyinMatch | undefined {
  const context = contextOf(dictionary, haystack);
  let best: PinyinMatch | undefined;
  for (const path of found) {
    const ranges = rangesOf(path.steps);
    /* c8 ignore next 3 -- a match always starts on a character it read */
    if (ranges[0] === undefined) {
      continue;
    }
    const start = ranges[0].at;
    const score =
      CONTEXT_READING * agreementOf(query, path.steps, context.preferred) +
      (context.wordStarts.has(start) ? WORD_START : 0) +
      EARLINESS / (1 + start);
    // Strictly better, so that two matches worth the same keep the earlier.
    if (best === undefined || score > best.score) {
      best = { ranges, score };
    }
  }
  return best;
}
