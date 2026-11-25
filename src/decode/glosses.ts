/**
 * Han runs that read on from each other across a bracketed gloss.
 *
 * Sayings in Chinese Boost gloss their puns in brackets, as in
 * 贾(假)门贾(假)氏(事). The brackets split the Han into runs, and a run is
 * decoded and grouped on its own. The gloss is an aside, and the text either
 * side of it reads on as if it were not there: 门贾 runs on into 氏.
 */
import type { GroupingContext } from "../orthography/rule.js";
import type { TextRun } from "./runs.js";
import type { DecodedWord } from "./word.js";

/**
 * The brackets a gloss is written in, in both widths.
 */
const OPENING = new Set(["(", "（"]);
const CLOSING = new Set([")", "）"]);

/**
 * The index of the Han run after a run, across a gloss directly after it.
 *
 * That is an opening bracket, one Han run, a closing bracket and then Han,
 * with nothing else between.
 */
export function runAfterGloss(
  runs: readonly TextRun[],
  at: number,
): number | undefined {
  const isGlossed =
    runs[at]?.isHan === true &&
    OPENING.has(runs[at + 1]?.text ?? "") &&
    runs[at + 2]?.isHan === true &&
    CLOSING.has(runs[at + 3]?.text ?? "") &&
    runs[at + 4]?.isHan === true;
  return isGlossed ? at + 4 : undefined;
}

/**
 * The words either side of a run across a gloss, for the grouping rules.
 */
export function glossContext(
  runs: readonly TextRun[],
  words: readonly (readonly DecodedWord[])[],
  at: number,
): GroupingContext {
  const before = runAfterGloss(runs, at - 4) === at ? words[at - 4] : undefined;
  const after = runAfterGloss(runs, at);
  return {
    before: before ?? [],
    after: after === undefined ? [] : (words[after] ?? []),
  };
}
