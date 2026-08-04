import type { Syllable } from "../syllable/syllable.js";
import {
  cutPoints,
  type Lattice,
  type LatticeEdge,
  READING_CHARGE,
} from "./lattice.js";
import {
  isSettled,
  type ReadingProjection,
  type ReadingUnit,
  settledUnits,
  unitKey,
  unitsOf,
} from "./locking.js";
import { type CostOf, readingCost, shortestPath } from "./viterbi.js";

/**
 * A reading the decode considered at a position and did not take.
 *
 * The span is carried because a rejected reading need not cover the same
 * characters as the one that won: 玩儿 read as `wánr` competes with 玩 `wán`
 * followed by 儿 `ér`, and those are claims about different stretches.
 */
export interface ReadingAlternative {
  readonly from: number;
  readonly to: number;
  readonly reading: readonly Syllable[];
  /**
   * How much more the cheapest decode taking this reading would have cost.
   *
   * In the reading decode's own units, where a step of one is one frequency
   * bucket. Zero means a tie: another reading was available for the same price
   * and the decode had nothing to separate them by.
   */
  readonly cost: number;
}

/**
 * How settled one decoded reading was.
 */
export interface ReadingConfidence {
  /**
   * Whether the reading projection locked this reading before any scoring.
   *
   * A locked reading is not a confident guess but the only reading on offer:
   * every path through the lattice agrees on it, so no cost model could have
   * changed it. Locked implies no alternatives.
   */
  readonly isLocked: boolean;
  /** What the decode rejected, cheapest first. */
  readonly alternatives: readonly ReadingAlternative[];
}

/**
 * A decoded reading unit together with what choosing it rejected.
 */
export interface ScoredUnit extends ReadingUnit, ReadingConfidence {}

/**
 * Whether a reading was settled by something weaker than dictionary evidence.
 *
 * The reading decode charges {@link READING_CHARGE} per edge, which is the
 * price of one more word boundary, so a rival costing less than that was
 * available without breaking any dictionary word apart: the decode picked
 * between readings of the same stretch on the strength of a prior — the order
 * `readingsOf` happens to list them in — and nothing more. A dearer rival could
 * only be had by rejecting a word the dictionary attests.
 *
 * **Measured** against the CPP dataset's 20,139 hand-labelled polyphones: a
 * reading this reports uncertain is wrong 27.2% of the time, against 4.5% for
 * one backed by a word and 1.5% for a locked one. It lands on 18.7% of the
 * syllables of everyday text and 13.2% of encyclopedic text — see ROADMAP.md.
 */
export function isUncertain(confidence: ReadingConfidence): boolean {
  return (confidence.alternatives[0]?.cost ?? Infinity) < READING_CHARGE;
}

/**
 * One distinct reading claimed in a stretch, and what claiming it costs.
 */
interface ScoredClaim {
  readonly unit: ReadingUnit;
  readonly cost: number;
}

/**
 * Every distinct reading claimed in a stretch, and the stretch's own best cost.
 */
interface ScoredStretch {
  readonly claims: ReadonlyMap<string, ScoredClaim>;
  readonly best: number;
}

/**
 * The edges leaving one position.
 */
function edgesAt(lattice: Lattice, at: number): readonly LatticeEdge[] {
  /* c8 ignore next -- at is always a position of the run */
  return lattice.edges[at] ?? [];
}

/**
 * Every edge lying wholly inside a stretch.
 */
function edgesInside(
  lattice: Lattice,
  from: number,
  to: number,
): readonly LatticeEdge[] {
  const inside: LatticeEdge[] = [];
  for (let at = from; at < to; at++) {
    inside.push(...edgesAt(lattice, at).filter((edge) => edge.to <= to));
  }
  return inside;
}

/**
 * Cheapest cost of reaching each position in a stretch from its start.
 */
function forwardCosts(
  lattice: Lattice,
  from: number,
  to: number,
  costOf: CostOf,
): readonly number[] {
  const best: number[] = Array.from({ length: to - from + 1 }, () => Infinity);
  best[0] = 0;

  for (let at = from; at < to; at++) {
    /* c8 ignore next 2 -- every position of the stretch is reached and in range */
    const sofar = best[at - from] ?? Infinity;
    for (const edge of edgesAt(lattice, at)) {
      /* c8 ignore next -- the target of an edge inside the stretch is in range */
      const rival = best[edge.to - from] ?? Infinity;
      if (edge.to <= to && sofar + costOf(edge) < rival) {
        best[edge.to - from] = sofar + costOf(edge);
      }
    }
  }

  return best;
}

/**
 * Cheapest cost of reaching the end of a stretch from each position in it.
 */
function backwardCosts(
  lattice: Lattice,
  from: number,
  to: number,
  costOf: CostOf,
): readonly number[] {
  const best: number[] = Array.from({ length: to - from + 1 }, () => Infinity);
  best[to - from] = 0;

  for (let at = to - 1; at >= from; at--) {
    let cheapest = Infinity;
    for (const edge of edgesAt(lattice, at)) {
      /* c8 ignore next -- the target of an edge inside the stretch is in range */
      const onwards = best[edge.to - from] ?? Infinity;
      if (edge.to <= to && costOf(edge) + onwards < cheapest) {
        cheapest = costOf(edge) + onwards;
      }
    }
    best[at - from] = cheapest;
  }

  return best;
}

/**
 * Price every distinct reading a stretch offers.
 *
 * A claim is priced by the cheapest path through the whole stretch that makes
 * it, which is what makes the figures comparable: a reading can be expensive
 * because it forces expensive readings around it as much as because it is
 * itself unlikely. One forward sweep and one backward sweep give that for every
 * edge at once, which is the same work the decode already does in one
 * direction.
 */
function scoreClaims(
  lattice: Lattice,
  from: number,
  to: number,
  costOf: CostOf,
): ScoredStretch {
  const forward = forwardCosts(lattice, from, to, costOf);
  const backward = backwardCosts(lattice, from, to, costOf);
  const claims = new Map<string, ScoredClaim>();

  for (const edge of edgesInside(lattice, from, to)) {
    /* c8 ignore next 2 -- both ends of an edge in the stretch are in range */
    const through =
      (forward[edge.from - from] ?? Infinity) +
      costOf(edge) +
      (backward[edge.to - from] ?? Infinity);
    for (const unit of unitsOf(edge)) {
      const key = unitKey(unit);
      const held = claims.get(key);
      if (held === undefined || through < held.cost) {
        claims.set(key, { unit, cost: through });
      }
    }
  }

  /* c8 ignore next -- every position of a stretch is reachable from its start */
  return { claims, best: forward[to - from] ?? Infinity };
}

/**
 * What a unit beat: the claims overlapping its span, other than its own.
 */
function alternativesTo(
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
function scoreStretch(
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

/**
 * Decode the run's readings, keeping what each choice rejected.
 *
 * The decode `decodeReadings` runs, kept for its losers as well as its winner.
 * ALGORITHM.md asks for per-syllable confidence on the grounds that greedy
 * matching cannot tell you when it is guessing; this is where the guessing is
 * visible, because the information is in the lattice and is thrown away the
 * moment the shortest path is read back.
 *
 * A settled stretch is still skipped, and costs nothing extra here. Every
 * position in it locked, so there was never anything to reject.
 */
export function scoreReadings(
  lattice: Lattice,
  projection: ReadingProjection,
): readonly ScoredUnit[] {
  const cuts = cutPoints(lattice);
  const units: ScoredUnit[] = [];

  for (const [index, from] of cuts.entries()) {
    const to = cuts[index + 1];
    if (to === undefined) {
      break;
    }
    if (isSettled(projection, from, to)) {
      units.push(
        ...settledUnits(projection, from, to).map((unit) => ({
          ...unit,
          isLocked: true,
          alternatives: [],
        })),
      );
      continue;
    }
    units.push(...scoreStretch(lattice, projection, from, to));
  }

  return units;
}
