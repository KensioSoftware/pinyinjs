/**
 * What a lattice is made of, and what each edge costs it.
 *
 * The costs are the whole of the decode's judgement in four numbers, so they
 * sit together and are stated once.
 */
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
export const LONGEST_WORD = 16;

/**
 * What each step down a character's list of readings adds to the edge cost.
 *
 * A character's readings arrive most likely first, and nothing else in the data
 * says how much more likely. One frequency bucket per step is the smallest
 * separation that still ranks them, and it keeps a rare reading of a common
 * character from outbidding a real dictionary word.
 */
export const ALTERNATE_PENALTY = 1;

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
export const READING_CHARGE = 16;

/**
 * What an edge covering a character no dictionary entry knows costs.
 *
 * Above the worst cost a real entry can carry, so that any known reading is
 * preferred to none.
 */
export const UNKNOWN_COST = 32;
