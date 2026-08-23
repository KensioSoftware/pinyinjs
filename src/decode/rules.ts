import type { Dictionary } from "../dictionary/dictionary.js";
import type { Lattice, LatticeEdge } from "./lattice.js";

export {
  ASPECT,
  PARTICLE_TAG,
  tagOf,
  wordEndingAt,
  wordsEndingAt,
  wordStartingAt,
  wordsStartingAt,
} from "./edge-context.js";

/**
 * What a rule can say about one edge.
 *
 * `forbid` takes the edge out of the lattice; `force` takes every *rival* out,
 * meaning every other edge covering exactly the same characters. Forcing settles
 * how a stretch is read without saying anything about how it is segmented, so
 * the words that overlap it are left to the decode.
 */
export type EdgeVerdict = "keep" | "forbid" | "force";

/**
 * What a rule is given to judge an edge by.
 *
 * The characters of the whole run rather than of the edge, because the
 * interesting rules are about context: 得 is `de` after a verb and `děi` before
 * one, and neither is visible from the character on its own.
 */
export interface EdgeContext {
  readonly dictionary: Dictionary;
  readonly characters: readonly string[];
  readonly edge: LatticeEdge;
}

/**
 * One typed rule over the lattice's edges — stage 4 of ALGORITHM.md.
 *
 * The old project tweaked its output string with regexes, so its rules ran in
 * an order nobody chose and could not be tested apart from each other. A rule
 * here is a function from one edge to one verdict: it can be read on its own,
 * tested on its own, and measured on its own.
 */
export interface EdgeRule {
  readonly name: string;
  readonly verdictFor: (context: EdgeContext) => EdgeVerdict;
}

/**
 * Whether every position can still be left, and the end still reached.
 *
 * A rule that forbids an edge can strand a stretch of the run — that is the one
 * way a rule can do real damage, since a lattice with no path through it has no
 * decode at all. Checked rather than reasoned about, because the rules are meant
 * to be extensible and somebody else's rule is not this file's to trust.
 */
function isTraversable(lattice: Lattice): boolean {
  const length = lattice.characters.length;
  const reaches = Array.from({ length: length + 1 }, () => false);
  reaches[length] = true;
  for (let at = length - 1; at >= 0; at--) {
    /* c8 ignore next 3 -- every index here is a position of the run itself */
    reaches[at] = (lattice.edges[at] ?? []).some(
      (edge) => reaches[edge.to] ?? false,
    );
  }
  /* c8 ignore next -- a run always has a position 0 */
  return reaches[0] ?? false;
}

/**
 * The verdict the first rule with an opinion gives an edge.
 */
function verdictFor(
  rules: readonly EdgeRule[],
  context: EdgeContext,
): EdgeVerdict {
  for (const rule of rules) {
    const verdict = rule.verdictFor(context);
    if (verdict !== "keep") {
      return verdict;
    }
  }
  return "keep";
}

/**
 * Forbid every edge a forced one covers the same characters as.
 *
 * All the edges leaving a position are given together, so covering the same
 * characters is a question about where they end. A forced edge never forbids
 * another forced one: two rules forcing the same span disagree, and the decode
 * choosing between the two readings is a better answer than neither.
 */
function forbidRivals(
  edges: readonly LatticeEdge[],
  forced: ReadonlySet<LatticeEdge>,
  forbidden: Set<LatticeEdge>,
): void {
  const settled = new Set(
    edges.filter((edge) => forced.has(edge)).map((edge) => edge.to),
  );
  for (const rival of edges) {
    if (settled.has(rival.to) && !forced.has(rival)) {
      forbidden.add(rival);
    }
  }
}

/**
 * Apply the rules to a lattice, returning the lattice they leave.
 *
 * Stage 4 of the pipeline: the rules run over the built lattice and before any
 * decoding, so what they change is what the decode gets to choose between
 * rather than what it has already chosen. Nothing is rewritten — an edge is
 * kept or it is not — which is what keeps a rule from inventing a reading no
 * source attests.
 *
 * The lattice is returned unchanged if the rules would leave the run with no
 * path through it.
 */
export function applyEdgeRules(
  lattice: Lattice,
  dictionary: Dictionary,
  rules: readonly EdgeRule[],
): Lattice {
  if (rules.length === 0) {
    return lattice;
  }
  const forbidden = new Set<LatticeEdge>();
  const forced = new Set<LatticeEdge>();

  for (const edges of lattice.edges) {
    for (const edge of edges) {
      const verdict = verdictFor(rules, {
        dictionary,
        characters: lattice.characters,
        edge,
      });
      if (verdict === "forbid") {
        forbidden.add(edge);
      } else if (verdict === "force") {
        forced.add(edge);
      }
    }
  }

  // Rivals are forbidden after every verdict is in, so that two rules forcing
  // the same span leave both readings standing rather than neither.
  for (const edges of lattice.edges) {
    forbidRivals(edges, forced, forbidden);
  }

  if (forbidden.size === 0) {
    return lattice;
  }
  const ruled: Lattice = {
    characters: lattice.characters,
    edges: lattice.edges.map((edges) =>
      edges.filter((edge) => !forbidden.has(edge)),
    ),
  };
  return isTraversable(ruled) ? ruled : lattice;
}
