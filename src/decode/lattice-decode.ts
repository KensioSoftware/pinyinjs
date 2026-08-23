/**
 * The two sweeps a decode makes over a whole lattice.
 *
 * Separate from `decode.ts` because the run-level entry points there build a
 * lattice from a run and cut it back down again, where these two take a lattice
 * as given and say nothing about where it came from.
 */
import { cutPoints, type Lattice } from "./lattice.js";
import {
  isSettled,
  type ReadingProjection,
  type ReadingUnit,
  settledUnits,
  unitsOf,
} from "./locking.js";
import { readingCost, shortestPath, spacingCost } from "./viterbi.js";

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
