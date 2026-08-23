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
 * The 汉字 either side of a run that the decode should see and not report.
 *
 * What a run would have been written with had the digits around it been spelled
 * out. Both sides are the same kind of claim about the same text, so they travel
 * together even where the exported signatures keep them apart.
 */
export interface DecodeContext {
  /** 汉字 standing in front of the run. */
  readonly before: string;
  /** 汉字 standing after it. */
  readonly after: string;
}

/**
 * A lattice to decode over, and where in it the run itself lies.
 */
export interface RunLattice {
  readonly lattice: Lattice;
  /** Where the run starts, past whatever context stands in front of it. */
  readonly at: number;
  /** Where the run ends, before whatever context stands after it. */
  readonly to: number;
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
 * The lattice a run decodes over, with whatever context stands around it.
 *
 * Each side is dropped where a reading would hold it to the run, and only that
 * side: a run whose trailing context is joined still gets the leading one, which
 * is what it would have had before there was any context to give.
 */
export function runLattice(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[],
  context: DecodeContext,
  hints: ResolvedHints | undefined,
): RunLattice {
  const length = toCharacters(run).length;
  const build = (before: string, after: string): RunLattice => {
    const at = toCharacters(before).length;
    // The context is decoded with the run, so every hint position moves along
    // with it. Shifting a copy keeps the caller's positions relative to the run
    // they were given for.
    return {
      lattice: ruledLattice(
        dictionary,
        before + run + after,
        rules,
        hints === undefined ? undefined : shiftHints(hints, at),
      ),
      at,
      to: at + length,
    };
  };

  const { before, after } = context;
  const held = build(before, after);
  const isLeadJoined = before !== "" && isJoinedAt(held.lattice, held.at);
  const isTailJoined = after !== "" && isJoinedAt(held.lattice, held.to);
  if (!isLeadJoined && !isTailJoined) {
    return held;
  }
  return build(isLeadJoined ? "" : before, isTailJoined ? "" : after);
}
