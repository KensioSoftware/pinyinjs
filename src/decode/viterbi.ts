import type { Lattice, LatticeEdge } from "./lattice.js";

/**
 * Which of an edge's two costs a decode is scoring by.
 */
export type CostOf = (edge: LatticeEdge) => number;

/**
 * Score by the spacing cost: a quantised `−log P(word)`.
 */
export const spacingCost: CostOf = (edge) => edge.cost;

/**
 * Score by the reading cost, which prices dictionary evidence above frequency.
 */
export const readingCost: CostOf = (edge) => edge.readingCost;

/**
 * How a decode reached one position: the total so far and the edge that got it
 * there.
 */
interface Arrival {
  readonly total: number;
  readonly edge: LatticeEdge | undefined;
}

const UNREACHED: Arrival = { total: Infinity, edge: undefined };

/**
 * Relax every edge leaving a position, given how that position was reached.
 *
 * An edge running past the end of the stretch is skipped rather than rejected,
 * which is what makes a decode of part of a lattice mean anything.
 */
function relax(
  lattice: Lattice,
  reached: Arrival[],
  at: number,
  bounds: { readonly from: number; readonly to: number },
  costOf: CostOf,
): void {
  const { from, to } = bounds;
  /* c8 ignore next -- every position between the bounds has been reached */
  const sofar = (reached[at - from] ?? UNREACHED).total;
  /* c8 ignore next -- at is always a position of the run */
  const leaving = lattice.edges[at] ?? [];
  for (const edge of leaving) {
    const total = sofar + costOf(edge);
    /* c8 ignore next -- the target of an edge inside the stretch is in range */
    const rival = (reached[edge.to - from] ?? UNREACHED).total;
    if (edge.to <= to && total < rival) {
      reached[edge.to - from] = { total, edge };
    }
  }
}

/**
 * Cheapest path through part of a lattice, as the edges it takes.
 *
 * Shortest path over a DAG whose nodes are already in topological order, so one
 * forward sweep settles it: every edge is relaxed once, and the path is read
 * back by following the recorded predecessors. Stage 3 of ALGORITHM.md.
 *
 * `from` and `to` must be cut points of the lattice, since only then is the
 * stretch between them independent of everything outside it.
 */
export function shortestPath(
  lattice: Lattice,
  from: number,
  to: number,
  costOf: CostOf,
): readonly LatticeEdge[] {
  const reached: Arrival[] = Array.from(
    { length: to - from + 1 },
    () => UNREACHED,
  );
  reached[0] = { total: 0, edge: undefined };

  for (let at = from; at < to; at++) {
    relax(lattice, reached, at, { from, to }, costOf);
  }

  const path: LatticeEdge[] = [];
  let at = to;
  while (at > from) {
    /* c8 ignore next -- the loop condition keeps the index in range */
    const { edge } = reached[at - from] ?? UNREACHED;
    /* c8 ignore next 3 -- every position has a single-character edge leaving it */
    if (edge === undefined) {
      break;
    }
    path.push(edge);
    at = edge.from;
  }

  return path.toReversed();
}
