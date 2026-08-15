/**
 * What a reading was chosen over, and how settled that choice was.
 *
 * A stretch is uncertain exactly where some rival reading of the same
 * characters costs nearly as little as the one taken.
 */
import type { Lattice } from "./lattice.js";
import type { ReadingAlternative, ScoredUnit } from "./confidence.js";
import {
  type ReadingProjection,
  type ReadingUnit,
  unitKey,
  unitsOf,
} from "./locking.js";
import { readingCost, shortestPath } from "./viterbi.js";
import { scoreClaims, type ScoredStretch } from "./lattice-costs.js";

export function alternativesTo(
  stretch: ScoredStretch,
  unit: ReadingUnit,
): readonly ReadingAlternative[] {
  const key = unitKey(unit);
  return [...stretch.claims.values()]
    .filter(
      (claim) =>
        unitKey(claim.unit) !== key &&
        claim.unit.from < unit.to &&
        unit.from < claim.unit.to,
    )
    .map((claim) => ({
      from: claim.unit.from,
      to: claim.unit.to,
      reading: claim.unit.reading,
      cost: claim.cost - stretch.best,
    }))
    .toSorted((left, right) => left.cost - right.cost);
}

/**
 * Decode one stretch's readings, keeping what the cheapest path rejected.
 */
export function scoreStretch(
  lattice: Lattice,
  projection: ReadingProjection,
  from: number,
  to: number,
): readonly ScoredUnit[] {
  const stretch = scoreClaims(lattice, from, to, readingCost);
  return shortestPath(lattice, from, to, readingCost)
    .flatMap((edge) => unitsOf(edge))
    .map((unit) => ({
      ...unit,
      isLocked: projection.locked[unit.from] !== undefined,
      alternatives: alternativesTo(stretch, unit),
    }));
}
