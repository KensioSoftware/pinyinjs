import type { Dictionary } from "../dictionary/dictionary.js";
import { scoreReadings, type ScoredUnit } from "./confidence.js";
import type { ResolvedHints } from "./hints.js";
import { cutPoints, type Lattice } from "./lattice.js";
import {
  isSettled,
  projectReadings,
  type ReadingProjection,
  type ReadingUnit,
  settledUnits,
  unitsOf,
} from "./locking.js";
import { READING_RULES } from "./reading-rules.js";
import type { EdgeRule } from "./rules.js";
import { readingCost, shortestPath, spacingCost } from "./viterbi.js";
import type { DecodedWord, ScoredWord } from "./word.js";

/**
 * Decode the run's readings, scoring only where the readings are still open.
 *
 * The asymmetry ALGORITHM.md calls for. A stretch between two cut points whose
 * positions all locked reads the same way on every path, so its readings are
 * read off the locks and no shortest path is run over it at all. Only the
 * stretches with a genuine choice in them are decoded.
 */
export function decodeReadings(
  lattice: Lattice,
  projection: ReadingProjection,
): readonly ReadingUnit[] {
  const cuts = cutPoints(lattice);
  const units: ReadingUnit[] = [];

  for (const [index, from] of cuts.entries()) {
    const to = cuts[index + 1];
    if (to === undefined) {
      break;
    }
    if (isSettled(projection, from, to)) {
      units.push(...settledUnits(projection, from, to));
      continue;
    }
    for (const edge of shortestPath(lattice, from, to, readingCost)) {
      units.push(...unitsOf(edge));
    }
  }

  return units;
}

/**
 * Where a decode would put the word boundaries, as character positions.
 *
 * Run over the whole lattice rather than the open stretches, because spacing
 * stays ambiguous where readings do not: 研究生命起源 reads identically whether
 * it splits 研究生/命 or 研究/生命, so every position in it locks, and the
 * spacing question is still open.
 */
export function decodeSpacing(lattice: Lattice): readonly number[] {
  return shortestPath(lattice, 0, lattice.characters.length, spacingCost).map(
    (edge) => edge.from,
  );
}

import { runGroups, runLattice, wordFrom } from "./run-lattice.js";
export function decodeRun(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[] = READING_RULES,
  before = "",
  hints?: ResolvedHints,
): readonly DecodedWord[] {
  const held = runLattice(dictionary, run, rules, before, hints);
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
 * `before` is the context {@link decodeRun} takes, and means the same here: it
 * is decoded with the run and reported with neither words nor confidence of its
 * own.
 */
export function decodeRunScored(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[] = READING_RULES,
  before = "",
  hints?: ResolvedHints,
): readonly ScoredWord[] {
  const held = runLattice(dictionary, run, rules, before, hints);
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
