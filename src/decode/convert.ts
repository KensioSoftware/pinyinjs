/**
 * Converting hanzi to pinyin, in every form a caller may want it.
 *
 * Six entry points over one pipeline, differing only in which decoder runs and
 * whether the answer is joined back into a string. The pipeline itself is
 * `convert-pipeline.ts`.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { convertWith } from "./convert-pipeline.js";
import type { ConvertedPiece, ConvertOptions } from "./pieces.js";
import { GREEDY, LATTICE, SCORED } from "./decoders.js";

export {
  type ConvertedPiece,
  type ConvertOptions,
  type NumberStyle,
  sourcesOf,
} from "./pieces.js";

/**
 * Convert hanzi to pinyin with the lattice decoder.
 *
 * The recommended path. Builds every candidate reading of each Han run, locks
 * the positions that read the same way whichever candidates are chosen, and
 * scores only what is left — see {@link decodeRun} and ALGORITHM.md. GB/T 16159
 * orthography is then applied over the decoded words rather than over the
 * output string.
 */
export function convert(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  return joinPieces(convertWith(LATTICE, dictionary, text, options));
}

/**
 * Convert hanzi to pinyin, syllable by syllable, with confidence beside each.
 *
 * The same conversion {@link convert} performs and the same text once joined,
 * kept in pieces so that each syllable can be rendered on its own terms.
 * Everything the decode rejected is reported with it — see
 * {@link import("./confidence.js").ReadingConfidence} — which is what an
 * output format needs to show a reader where it was guessing.
 *
 * Costs a second sweep of the lattice, which is why it is not what
 * {@link convert} runs.
 */
export function convertPieces(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(SCORED, dictionary, text, options);
}

/**
 * The same pieces, without asking the lattice what it rejected.
 *
 * Internal, and not in `src/index.ts`: it exists for `slug`, which needs the
 * syllables and the word boundaries but has nothing to say about confidence,
 * and would otherwise pay {@link convertPieces}'s second sweep on every title
 * it is handed. An output format that shows a reader anything about the decode
 * wants {@link convertPieces} instead.
 */
export function convertPiecesUnscored(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(LATTICE, dictionary, text, options);
}

/**
 * Join a conversion's pieces back into the text they spell.
 */
export function joinPieces(pieces: readonly ConvertedPiece[]): string {
  return pieces.map((piece) => piece.text).join("");
}

/**
 * Convert hanzi to pinyin with the greedy baseline decoder.
 *
 * **The baseline, kept to measure against.** See {@link decodeGreedily} for why
 * this is not the intended algorithm, and ALGORITHM.md for what replaces it.
 * Use {@link convert} instead.
 */
export function convertGreedily(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  return joinPieces(convertWith(GREEDY, dictionary, text, options));
}

/**
 * The same, kept in pieces.
 *
 * {@link convertPieces} for the baseline, so that a caller rendering each
 * syllable — colouring its tone — can still ask for the comparison. The pieces
 * carry no confidence, because the greedy decode cannot say what it rejected.
 */
export function convertPiecesGreedily(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(GREEDY, dictionary, text, options);
}
