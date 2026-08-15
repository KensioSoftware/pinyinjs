/**
 * Cutting a lattice down to one run and lining the edges back up.
 *
 * A run is decoded on its own, so its edges are shifted to start at zero and
 * shifted back afterwards.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { allEdges, type Lattice } from "./lattice.js";
import type { EdgeRule } from "./rules.js";
import { toCharacters } from "../script/characters.js";
import { shiftHints, type ResolvedHints } from "./hints.js";
import { ruledLattice } from "./run-lattice.js";

/**
 * A lattice to decode over, and where in it the run itself starts.
 */
export interface RunLattice {
  readonly lattice: Lattice;
  readonly at: number;
}

/**
 * Whether any reading in the lattice would hold the two sides of a join
 * together.
 *
 * A reading of one syllable per character can be cut anywhere; anything else —
 * 儿化, a character with no reading — is a single claim about its whole span,
 * so a claim spanning the join cannot be reported for the run alone. 1点儿事
 * is that case: 一点儿 is one `yìdiǎnr` over the 一 the context supplied and
 * the 点儿 the run did.
 */
export function isJoinedAt(lattice: Lattice, at: number): boolean {
  return allEdges(lattice).some(
    (edge) =>
      edge.from < at &&
      edge.to > at &&
      edge.reading.length !== edge.to - edge.from,
  );
}

/**
 * The lattice a run decodes over, with whatever context stands in front of it.
 *
 * The context is dropped where a reading would hold it to the run, leaving the
 * run decoded on its own, which is what it would have been before there was any
 * context to give.
 */
export function runLattice(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[],
  before: string,
  hints: ResolvedHints | undefined,
): RunLattice {
  const alone = (): RunLattice => ({
    lattice: ruledLattice(dictionary, run, rules, hints),
    at: 0,
  });
  if (before === "") {
    return alone();
  }
  const held = toCharacters(before).length;
  // The context is decoded with the run, so every hint position moves along
  // with it. Shifting a copy keeps the caller's positions relative to the run
  // they were given for.
  const lattice = ruledLattice(
    dictionary,
    before + run,
    rules,
    hints === undefined ? undefined : shiftHints(hints, held),
  );
  const at = held;
  return isJoinedAt(lattice, at) ? alone() : { lattice, at };
}
