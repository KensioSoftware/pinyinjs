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
 * So the reading decode charges per *edge*, and the charge is what a word is
 * worth against the frequencies around it. The whole frequency scale is 15
 * buckets wide, so a charge of 15 already makes the rarest possible word beat
 * the two commonest possible characters. This was 16 for most of the project's
 * life, and with `WORD_CHARGE` on top of it the real price of a word boundary
 * was 20.62 — five buckets past the point where frequency can say anything at
 * all. Every 那是 in the language read `nà shi` on the strength of one
 * colloquial CC-CEDICT entry no corpus has ever counted, and 都会, 过得, 得了
 * and 的哥 went the same way.
 *
 * At 6 the price is 10.62 and the arithmetic decides something. A word loses
 * its span to a two-character split when the two characters are more than
 * 25.62 buckets better than it, which needs a word nothing attests standing
 * against two characters near the top of the scale. An attested word survives
 * whatever is beside it, so 地气 is still `dì qì`.
 *
 * Measured over the 88,866 lines of Tatoeba and zh.wikipedia the stage-4 rules
 * were sized against, moving 16 to 6 changes 822 of 139,682 Han runs. The
 * changes are 那是 (303), 都 read `dū` (141), 得 read `dé` after a verb (98),
 * 为 read `wéi` where it means *for* (36), 一个 (27), and a tail of 了, 只, 中,
 * 说 and 的. Against them stand 21 老是, 11 等地 and 10 倒是, where the word
 * really was one word. On CPP's 20,139 hand-labelled polyphones it is 91.48%
 * either way, and the gold corpus does not move.
 *
 * Word frequency survives as the tiebreak between paths covering the same span
 * with the same number of words.
 */
export const READING_CHARGE = 6;

/**
 * What an edge covering a character no dictionary entry knows costs.
 *
 * Above the worst cost a real entry can carry, so that any known reading is
 * preferred to none.
 */
export const UNKNOWN_COST = 32;
