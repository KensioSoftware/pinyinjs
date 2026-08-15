import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import { applyHints, type ResolvedHints } from "./hints.js";
import type { Lattice, LatticeEdge } from "./lattice-types.js";

export {
  type Lattice,
  type LatticeEdge,
  READING_CHARGE,
  UNKNOWN_COST,
} from "./lattice-types.js";
import { characterEdgesAt, wordEdgesAt } from "./lattice-edges.js";

/**
 * Build the lattice of every way a Han run could be read.
 *
 * Stage 1 of the pipeline in ALGORITHM.md. Where the greedy baseline commits to
 * the longest match at each position and never revisits it, this keeps every
 * candidate so that later stages can compare them — which is the whole point,
 * since a greedy choice that is locally right can be globally wrong.
 */
export function buildLattice(
  dictionary: Dictionary,
  run: string,
  hints?: ResolvedHints,
): Lattice {
  const characters = toCharacters(run);
  const edges: (readonly LatticeEdge[])[] = [];

  for (let at = 0; at < characters.length; at++) {
    edges.push([
      ...wordEdgesAt(dictionary, characters, at),
      ...characterEdgesAt(dictionary, characters, at),
    ]);
  }

  const lattice = { characters, edges };
  return hints === undefined ? lattice : applyHints(lattice, hints);
}

/**
 * Every edge in the lattice, in no particular order.
 */
export function allEdges(lattice: Lattice): readonly LatticeEdge[] {
  return lattice.edges.flat();
}

/**
 * The positions no edge spans, which are the only places the run can be cut.
 *
 * A shortest path over a DAG decomposes exactly at these points: nothing before
 * one can influence anything after it, so decoding each stretch between them
 * separately gives the same answer as decoding the whole run at once. That is
 * what lets stage 3 skip the stretches whose readings are already settled.
 *
 * Both ends of the run are always cut points.
 */
export function cutPoints(lattice: Lattice): readonly number[] {
  const length = lattice.characters.length;
  const crossings = new Int32Array(length + 2);

  // A difference array: an edge marks the positions strictly inside it, so a
  // single-character edge cancels itself out and spans nothing.
  for (const edge of allEdges(lattice)) {
    /* c8 ignore next 2 -- every edge lies inside the run it was built from */
    crossings[edge.from + 1] = (crossings[edge.from + 1] ?? 0) + 1;
    crossings[edge.to] = (crossings[edge.to] ?? 0) - 1;
  }

  const cuts: number[] = [];
  let spanning = 0;
  for (let at = 0; at <= length; at++) {
    /* c8 ignore next -- the loop condition keeps the index in range */
    spanning += crossings[at] ?? 0;
    if (spanning === 0) {
      cuts.push(at);
    }
  }

  return cuts;
}
