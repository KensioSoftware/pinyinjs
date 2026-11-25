/**
 * Recutting a run's words for 分词连写.
 *
 * Grouping rewrites word boundaries and never the readings behind them, so the
 * syllables — and the confidence beside them — survive it in order, and are
 * simply cut in different places.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { applyGrouping, GROUPING_RULES } from "../orthography/grouping.js";
import type { GroupingContext } from "../orthography/rule.js";
import { toCharacters } from "../script/characters.js";
import { matchesAt } from "./hint-lattice.js";
import type { ResolvedHints } from "./hints.js";
import type { TextRun } from "./runs.js";
import type { DecodedWord, ScoredWord } from "./word.js";

/**
 * The words a Han run decodes to, with 分词连写 applied.
 *
 * Grouping rewrites word boundaries and never the readings behind them, so the
 * syllables — and the confidence beside them — survive it in order. The
 * context is the words of the runs this one reads on from, which the rules
 * read and leave as they are.
 */
export function wordsOf(
  decoded: readonly ScoredWord[],
  dictionary: Dictionary,
  isGrouped: boolean,
  context?: GroupingContext,
): readonly ScoredWord[] {
  return isGrouped
    ? regroup(
        decoded,
        applyGrouping(
          decoded.map((scored) => scored.word),
          dictionary,
          GROUPING_RULES,
          context,
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

/**
 * The positions in a run whose reading a caller asserted.
 */
export function hintedIn(
  within: ResolvedHints | undefined,
  run: TextRun | undefined,
): ReadonlySet<number> {
  return within === undefined || run === undefined
    ? new Set()
    : hintedPositions(within, toCharacters(run.text));
}

/**
 * The positions in a run whose reading a caller asserted.
 *
 * Every positional hint, and every character of each place a word hint's
 * characters stand. Grouping rules that write a reading of their own leave
 * these alone.
 */
function hintedPositions(
  hints: ResolvedHints,
  characters: readonly string[],
): ReadonlySet<number> {
  const hinted = new Set(hints.at.keys());
  for (const hint of hints.words) {
    for (let at = 0; at < characters.length; at++) {
      if (matchesAt(hint, characters, at)) {
        for (let index = 0; index < hint.characters.length; index++) {
          hinted.add(at + index);
        }
      }
    }
  }
  return hinted;
}
