import type { Dictionary } from "../dictionary/dictionary.js";
import type { Lattice, LatticeEdge } from "./lattice.js";

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
 * The word ending at a position, longest first, or undefined.
 *
 * What a rule needs when it asks about the word *before* an edge. The decode
 * has not run yet, so there is no settled answer; the longest dictionary word
 * ending here is the closest thing available, and it is what the decode will
 * usually choose, since the reading charge prefers fewer words.
 */
export function wordEndingAt(
  context: EdgeContext,
  at: number,
  longest = 4,
): string | undefined {
  for (let length = longest; length > 0; length--) {
    const from = at - length;
    if (from < 0) {
      continue;
    }
    const text = context.characters.slice(from, at).join("");
    if (context.dictionary.lookup(text) !== undefined) {
      return text;
    }
  }
  return undefined;
}

/**
 * The word starting at a position, longest first, or undefined.
 */
export function wordStartingAt(
  context: EdgeContext,
  at: number,
  longest = 4,
): string | undefined {
  for (let length = longest; length > 0; length--) {
    // Nothing starts at the end of a run, which is where a 得 closing a
    // sentence asks from.
    const text = context.characters.slice(at, at + length).join("");
    if (text !== "" && context.dictionary.lookup(text) !== undefined) {
      return text;
    }
  }
  return undefined;
}

/**
 * The part of speech the dictionary gives a word, or the empty string.
 */
export function tagOf(context: EdgeContext, word: string | undefined): string {
  return word === undefined
    ? ""
    : (context.dictionary.lookup(word)?.partOfSpeech ?? "");
}

/**
 * What follows a 教 that is teaching where no object does: aspect and the
 * complement marker, which only a verb takes.
 *
 * 他教了三年书, 他教过我英语, 她教书教得很快乐. Matched as characters rather
 * than through their tags, because what the dictionary has starting at a 得 is
 * as likely to be 得很 as the particle itself.
 */
export const ASPECT = new Set(["了", "过", "過", "着", "著", "得"]);

/**
 * The tag prefix jieba gives a particle, which nothing teaching can follow.
 */
export const PARTICLE_TAG = "u";

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
