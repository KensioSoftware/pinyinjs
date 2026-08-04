import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";

/**
 * One candidate reading of one stretch of characters.
 *
 * An edge runs from character position `from` to position `to`, exclusive, and
 * carries the syllables that stretch is read as. The reading is *not* required
 * to have one syllable per character: 玩儿 covers two characters and reads as
 * the single syllable `wánr`, which is the case that stops the lattice being a
 * simple per-character grid.
 */
export interface LatticeEdge {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly reading: readonly Syllable[];
  /** What this edge costs the spacing decode: a quantised `−log P(word)`. */
  readonly cost: number;
  /** What this edge costs the reading decode. See {@link READING_CHARGE}. */
  readonly readingCost: number;
  readonly isProperNoun: boolean;
  readonly partOfSpeech: string;
  /** Whether a dictionary entry backs this edge, rather than a fallback. */
  readonly isKnown: boolean;
}

/**
 * Every candidate reading of a Han run, as a DAG over character positions.
 */
export interface Lattice {
  readonly characters: readonly string[];
  /** Edges leaving each position, indexed by that position. */
  readonly edges: readonly (readonly LatticeEdge[])[];
}

/**
 * How far ahead a match is looked for.
 *
 * The prefix check stops a scan long before this in practice; it is a guard
 * against pathological input, not a real limit.
 */
const LONGEST_WORD = 16;

/**
 * What each step down a character's list of readings adds to the edge cost.
 *
 * A character's readings arrive most likely first, and nothing else in the data
 * says how much more likely. One frequency bucket per step is the smallest
 * separation that still ranks them, and it keeps a rare reading of a common
 * character from outbidding a real dictionary word.
 */
const ALTERNATE_PENALTY = 1;

/**
 * What every edge costs the reading decode on top of its word cost.
 *
 * The two decodes want different things, which is the asymmetry ALGORITHM.md
 * builds on. Spacing asks which segmentation the corpus makes likeliest, and
 * `−log P(word)` answers it. Readings ask something else: 地气 is rarer than 地
 * followed by 气, so the unigram model is right to split it and the reading
 * that falls out — `de qì` — is still wrong, because the dictionary states
 * outright that those two characters together read `dì qì`. A stored reading is
 * evidence about the characters; a character's default reading is only a prior.
 *
 * So the reading decode charges per *edge* heavily enough that dictionary
 * evidence outranks frequency: at 16 an attested word always beats splitting it
 * into characters, however common those characters are, since the worst word
 * costs `15 + 16` and the best two-character split costs `0 + 16` twice. Word
 * frequency survives as the tiebreak between paths covering the same span with
 * the same number of words. That ordering — fewest words first, frequency
 * second — is the one ALGORITHM.md already gives its data-free fallback tier.
 */
const READING_CHARGE = 16;

/**
 * What an edge covering a character no dictionary entry knows costs.
 *
 * Above the worst cost a real entry can carry, so that any known reading is
 * preferred to none.
 */
const UNKNOWN_COST = 32;

/**
 * The edges leaving a position that come from multi-character dictionary words.
 *
 * Walks one character at a time and stops as soon as the dictionary reports
 * that nothing begins with what has been collected, which is what keeps the
 * scan linear in practice rather than quadratic in the longest key.
 */
function wordEdgesAt(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): readonly LatticeEdge[] {
  const edges: LatticeEdge[] = [];
  let candidate = "";

  for (
    let length = 0;
    length < LONGEST_WORD && at + length < characters.length;
    length++
  ) {
    /* c8 ignore next -- the loop condition keeps the index in range */
    candidate += characters[at + length] ?? "";
    if (!dictionary.hasPrefix(candidate)) {
      break;
    }
    const entry = length === 0 ? undefined : dictionary.lookup(candidate);
    if (entry !== undefined) {
      edges.push({
        from: at,
        to: at + length + 1,
        text: candidate,
        reading: entry.reading,
        cost: entry.cost,
        readingCost: entry.cost + READING_CHARGE,
        isProperNoun: entry.isProperNoun,
        partOfSpeech: entry.partOfSpeech,
        isKnown: true,
      });
    }
  }

  return edges;
}

/**
 * The single-character edges leaving a position, one per known reading.
 *
 * Always present, whatever words also start here. Two things depend on that:
 * every position has an outgoing edge, so the lattice is always traversable;
 * and a polyphone offers all of its readings at every position, so scoring has
 * something to choose between rather than only what the word list happens to
 * cover.
 */
function characterEdgesAt(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): readonly LatticeEdge[] {
  /* c8 ignore next -- callers only ask about positions inside the run */
  const character = characters[at] ?? "";
  const entry = dictionary.lookup(character);

  if (entry === undefined) {
    // A character with no entry at all: keep it, unread, so that the text still
    // round-trips and the failure is visible rather than silent.
    return [
      {
        from: at,
        to: at + 1,
        text: character,
        reading: [],
        cost: UNKNOWN_COST,
        readingCost: UNKNOWN_COST + READING_CHARGE,
        isProperNoun: false,
        partOfSpeech: "",
        isKnown: false,
      },
    ];
  }

  return dictionary.readingsOf(character).map((reading, rank) => ({
    from: at,
    to: at + 1,
    text: character,
    reading,
    cost: entry.cost + rank * ALTERNATE_PENALTY,
    readingCost: entry.cost + rank * ALTERNATE_PENALTY + READING_CHARGE,
    isProperNoun: entry.isProperNoun,
    partOfSpeech: entry.partOfSpeech,
    isKnown: true,
  }));
}

/**
 * Build the lattice of every way a Han run could be read.
 *
 * Stage 1 of the pipeline in ALGORITHM.md. Where the greedy baseline commits to
 * the longest match at each position and never revisits it, this keeps every
 * candidate so that later stages can compare them — which is the whole point,
 * since a greedy choice that is locally right can be globally wrong.
 */
export function buildLattice(dictionary: Dictionary, run: string): Lattice {
  const characters = toCharacters(run);
  const edges: (readonly LatticeEdge[])[] = [];

  for (let at = 0; at < characters.length; at++) {
    edges.push([
      ...wordEdgesAt(dictionary, characters, at),
      ...characterEdgesAt(dictionary, characters, at),
    ]);
  }

  return { characters, edges };
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
