/**
 * The syllables a conversion wrote, and what stands between them.
 *
 * The first half of reducing an answer to something comparable: a list of
 * pieces becomes a list of syllables, each knowing where in the text it came
 * from and whether a word began there. Nothing here weighs anything — that is
 * `reading-tolerance.ts`, which decides what a learner may have written
 * instead.
 */
import type { ConvertedPiece } from "../decode/convert.js";
import type { Syllable } from "../syllable/syllable.js";
import { toCharacters } from "../script/characters.js";

/**
 * A piece of a conversion that writes a syllable.
 */
export type ReadingPiece = ConvertedPiece & { readonly syllable: Syllable };

/**
 * What a conversion writes between one syllable and the one before it.
 *
 * `hyphen` is its own answer rather than a kind of break because it is one:
 * 干干净净 is `gāngān-jìngjìng`, a single orthographic word with a boundary
 * inside it, which is why {@link import("../syllable/split.js").splitSyllables}
 * reads a hyphen as a syllable boundary and not a word one.
 */
export type Junction = "join" | "hyphen" | "break";

/**
 * One syllable of a conversion, with where it is and what precedes it.
 */
export interface ReadingSyllable {
  readonly piece: ReadingPiece;
  readonly at: number;
  readonly junction: Junction;
}

/**
 * Where each piece's source characters start, in code points.
 *
 * Read off the sources rather than tracked through the conversion, which works
 * because every character of the text is named by exactly one piece — a piece
 * naming none is either pinyin orthography the source has no trace of, such as
 * the space between two words, or a syllable reading on into the characters the
 * piece before it named.
 */
export function sourcePositions(
  pieces: readonly ConvertedPiece[],
): readonly number[] {
  const positions: number[] = [];
  let at = 0;
  for (const piece of pieces) {
    positions.push(at);
    at += toCharacters(piece.source ?? "").length;
  }
  return positions;
}

/**
 * What a piece written between two syllables makes of the join.
 *
 * Only a hyphen written where the syllables would otherwise have run together
 * is 分词连写's internal boundary; anything else — a space, punctuation, a
 * stretch that was never Han — separates two words.
 */
export function junctionOver(text: string, held: Junction): Junction {
  return text === "-" && held === "join" ? "hyphen" : "break";
}

/**
 * The syllables a conversion writes, with their positions and what joins them.
 *
 * A conversion writes its syllables as adjacent pieces within a word — the
 * 隔音符号 is part of a syllable's own spelling rather than a piece of its own —
 * so anything standing between two of them is a boundary, and the hyphen of
 * 分词连写 is the one that is not a word boundary.
 */
export function readingSyllables(
  pieces: readonly ConvertedPiece[],
): readonly ReadingSyllable[] {
  const positions = sourcePositions(pieces);
  const syllables: ReadingSyllable[] = [];
  // The first syllable of a text begins a word, whatever comes before it.
  let junction: Junction = "break";

  for (const [at, piece] of pieces.entries()) {
    if (piece.syllable === undefined) {
      junction = junctionOver(piece.text, junction);
      continue;
    }
    syllables.push({
      piece: { ...piece, syllable: piece.syllable },
      /* c8 ignore next -- one position is recorded for each piece there is */
      at: positions[at] ?? 0,
      junction,
    });
    junction = "join";
  }
  return syllables;
}
