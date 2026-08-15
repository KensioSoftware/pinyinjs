/**
 * What the lattice cost, forwards and backwards.
 *
 * The two sweeps a confidence score is read off: the cheapest way into every
 * position and the cheapest way out of it. An edge is uncertain exactly where
 * some rival edge over the same characters costs nearly as little.
 */
import type { ReadingUnit } from "./locking.js";
import type { Lattice, LatticeEdge } from "./lattice.js";
import { unitKey, unitsOf } from "./locking.js";
import type { CostOf } from "./viterbi.js";

/**
 * One distinct reading claimed in a stretch, and what claiming it costs.
 */
export interface ScoredClaim {
  readonly unit: ReadingUnit;
  readonly cost: number;
}

/**
 * Every distinct reading claimed in a stretch, and the stretch's own best cost.
 */
export interface ScoredStretch {
  readonly claims: ReadonlyMap<string, ScoredClaim>;
  readonly best: number;
}

/**
 * The edges leaving one position.
 */
export function edgesAt(lattice: Lattice, at: number): readonly LatticeEdge[] {
  /* c8 ignore next -- at is always a position of the run */
  return lattice.edges[at] ?? [];
}

/**
 * Every edge lying wholly inside a stretch.
 */
export function edgesInside(
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
export function forwardCosts(
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
export function backwardCosts(
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
export function scoreClaims(
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
