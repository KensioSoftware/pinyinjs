/**
 * What the two transcription paths agree about.
 *
 * `toTranscription` writes a string and `toHtml` writes markup, and both have
 * to put the capitals back and both have to decide what becomes of pinyin's own
 * orthography. Keeping the answers here is what stops the two from drifting.
 */
import type { ConvertedPiece } from "../decode/convert.js";

/**
 * Whether a piece was written with a capital.
 *
 * Read off the text the conversion produced rather than recomputed, because
 * capitalisation is settled by `convertPieces` against the whole sentence (a
 * proper noun, or the first word after a full stop) and none of that survives
 * in a bare syllable.
 */
export function isCapitalised(text: string): boolean {
  const first = /\p{L}/u.exec(text)?.[0];
  return first !== undefined && first !== first.toLowerCase();
}

/**
 * Put a capital back on a transcribed word.
 */
export function capitalised(text: string): string {
  // Not global: only the first letter of the word takes the capital.
  return text.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}

/**
 * Whether a piece is a mark pinyin writes and another system does not.
 *
 * The hyphen of `gāngān-jìngjìng` is the whole of it. GB/T 16159 puts it inside
 * one orthographic word, and every other system joins the syllables of a word
 * its own way. Wade-Giles hyphenates all of them, bopomofo spaces them, Yale
 * and Gwoyeu Romatzyh and the IPA run them together, so carrying pinyin's mark
 * across writes `ㄍㄢ ㄍㄢ-ㄐㄧㄥˋ ㄐㄧㄥˋ`, a hyphen in a script that has none.
 *
 * A piece naming no source is pinyin's own, which is the distinction
 * `sourcePiece` exists to draw. The space between two words is pinyin's too and
 * is kept, since every system puts one there.
 */
export function isPinyinMark(piece: ConvertedPiece): boolean {
  return (
    piece.syllable === undefined &&
    piece.source === undefined &&
    piece.text.trim() !== ""
  );
}
