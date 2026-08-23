/**
 * Recutting a run's words for 分词连写.
 *
 * Grouping rewrites word boundaries and never the readings behind them, so the
 * syllables — and the confidence beside them — survive it in order, and are
 * simply cut in different places.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { applyGrouping } from "../orthography/grouping.js";
import type { DecodedWord, ScoredWord } from "./word.js";

/**
 * The words a Han run decodes to, with 分词连写 applied.
 *
 * Grouping rewrites word boundaries and never the readings behind them, so the
 * syllables — and the confidence beside them — survive it in order.
 */
export function wordsOf(
  decoded: readonly ScoredWord[],
  dictionary: Dictionary,
  isGrouped: boolean,
): readonly ScoredWord[] {
  return isGrouped
    ? regroup(
        decoded,
        applyGrouping(
          decoded.map((scored) => scored.word),
          dictionary,
        ),
      )
    : decoded;
}

/**
 * Redistribute the decode's per-syllable confidence over regrouped words.
 *
 * 分词连写 moves word boundaries — 看 and 了 become 看了 — without touching a
 * reading, so the run's syllables are the same syllables in the same order and
 * are simply cut in different places.
 */
function regroup(
  decoded: readonly ScoredWord[],
  grouped: readonly DecodedWord[],
): readonly ScoredWord[] {
  const confidence = decoded.flatMap((scored) => [...scored.confidence]);
  let at = 0;
  return grouped.map((word) => {
    const held = confidence.slice(at, at + word.reading.length);
    at += word.reading.length;
    return { word, confidence: held };
  });
}
