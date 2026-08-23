/**
 * Decoding a Han run into words: the two entry points a caller reaches for.
 *
 * The sweeps over the lattice itself are in `lattice-decode.ts`, and are
 * re-exported here so that the decoder's parts stay one import away.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { scoreReadings, type ScoredUnit } from "./confidence.js";
import type { ResolvedHints } from "./hints.js";
import { decodeReadings } from "./lattice-decode.js";
import { projectReadings } from "./locking.js";
import { READING_RULES } from "./reading-rules.js";
import type { EdgeRule } from "./rules.js";
import type { DecodedWord, ScoredWord } from "./word.js";

export { decodeReadings, decodeSpacing } from "./lattice-decode.js";

import { runGroups, runLattice, wordFrom } from "./run-lattice.js";
export function decodeRun(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[] = READING_RULES,
  before = "",
  hints?: ResolvedHints,
  after = "",
): readonly DecodedWord[] {
  const held = runLattice(dictionary, run, rules, { before, after }, hints);
  const { lattice } = held;
  const units = decodeReadings(lattice, projectReadings(lattice));
  return runGroups(held, units).map((group) =>
    wordFrom(dictionary, lattice, group),
  );
}

/**
 * Decode a Han run, keeping what each reading was chosen over.
 *
 * The same decode as {@link decodeRun}, and the same words, with the losing
 * candidates kept rather than discarded. Separate because the extra sweep is
 * only worth running for a caller that will use the answer — rendering
 * uncertain readings differently, or reporting them.
 *
 * `before` and `after` are the context {@link decodeRun} takes, and mean the
 * same here: they are decoded with the run and reported with neither words nor
 * confidence of their own.
 */
export function decodeRunScored(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[] = READING_RULES,
  before = "",
  hints?: ResolvedHints,
  after = "",
): readonly ScoredWord[] {
  const held = runLattice(dictionary, run, rules, { before, after }, hints);
  const { lattice } = held;
  const units = scoreReadings(lattice, projectReadings(lattice));

  return runGroups<ScoredUnit>(held, units).map((group) => ({
    word: wordFrom(dictionary, lattice, group),
    confidence: group.flatMap((unit) =>
      unit.reading.map(() => ({
        isLocked: unit.isLocked,
        alternatives: unit.alternatives,
      })),
    ),
  }));
}
