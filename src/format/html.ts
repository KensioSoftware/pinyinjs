/**
 * A conversion as markup, and the options that decide what the markup carries.
 *
 * One element per syllable, which is what lets a page colour a tone or mark a
 * guess. What goes inside one of those elements is `syllable-span.ts` and the
 * ruby that puts the reading over the hanzi is `annotate.ts`.
 */
export {
  convertToAnnotatedHtml,
  convertToHtml,
  toAnnotatedHtml,
} from "./annotate.js";
import type { ConvertedPiece, ConvertOptions } from "../decode/convert.js";
import type { TranscriptionSystem } from "../transcription/systems.js";
import { writePiece } from "./syllable-span.js";

export { writePiece } from "./syllable-span.js";

/**
 * How a conversion is marked up.
 */
export interface HtmlOptions extends ConvertOptions {
  /**
   * Whether each syllable carries its tone as a class. Defaults to true.
   *
   * `py-tone-1` to `py-tone-5`, where 5 is the neutral tone. A syllable with no
   * tone written at all carries none of them.
   */
  readonly toneClasses?: boolean;
  /**
   * Whether readings the decode was guessing at are marked. Defaults to true.
   *
   * `py-uncertain`, plus a `data-alternatives` attribute listing what was
   * rejected. See `isUncertain` for what qualifies and how often it is wrong.
   */
  readonly markUncertain?: boolean;
  /**
   * Whether each syllable declares what language it is in. Defaults to true.
   *
   * `lang="zh-Latn-CN-pinyin"`, or `zh-Latn-TW-pinyin` where the conversion
   * reads `zh-TW`. See `languageTag` for why that matters, and what to do
   * instead of turning it off.
   */
  readonly lang?: boolean;
  /**
   * A system to write the reading in instead of pinyin.
   *
   * `BOPOMOFO`, `WADE_GILES`, `YALE`, `GWOYEU` or `IPA`, or a
   * {@link TranscriptionSystem} of the caller's own. Left out, the reading is
   * the pinyin the conversion wrote.
   *
   * The word segmentation is the conversion's either way and only the join
   * changes, which is the division `toTranscription` makes and for the same
   * reason. What a word is belongs to the language, and how its syllables are
   * run together belongs to the system. Everything else a syllable carries is
   * untouched, so tone classes, `py-uncertain` and `data-alternatives` mean
   * what they always did.
   */
  readonly transcription?: TranscriptionSystem;
}

/**
 * How each character that means something in markup is written as text.
 */
const ESCAPES = new Map<string, string>([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
]);

/**
 * Escape text for markup.
 *
 * Applied to everything, including the source's own text: a conversion passes
 * anything that is not Han through untouched, so `<script>` in the input
 * reaches the output as written. The apostrophe is deliberately not escaped:
 * every attribute here is double-quoted, and the 隔音符号 of `Xī'ān` is a
 * letter of the orthography that a reader should see as one.
 */
export function escape(text: string): string {
  return text.replaceAll(/[&<>"]/gu, (character) => {
    /* c8 ignore next -- the pattern only matches what the map holds */
    return ESCAPES.get(character) ?? character;
  });
}

/**
 * Mark up a run of pieces, with the system's join between two syllables.
 *
 * Pinyin needs none. Its syllables are run together and the marks that divide
 * them are pieces of their own. Every other system decides the join for itself,
 * and the join is what separates the five at this level, so it is written
 * between the spans rather than inside one. `<span>Pei³</span>-<span>ching¹
 * </span>` is one word in Wade-Giles and leaves each syllable its own element
 * to carry a tone class on.
 *
 * A piece that wrote nothing does not break the run, which is what carries the
 * join over pinyin's own hyphen: 干干净净 is four syllables of one word, and
 * the mark between the second and the third is dropped rather than counted as a
 * gap.
 */
export function writePieces(
  pieces: readonly ConvertedPiece[],
  options: HtmlOptions,
): string {
  const { transcription } = options;
  if (transcription === undefined) {
    return pieces.map((piece) => writePiece(piece, options)).join("");
  }
  const written: string[] = [];
  let isJoined = false;
  for (const piece of pieces) {
    const markup = writePiece(piece, options);
    if (piece.syllable !== undefined && isJoined) {
      written.push(transcription.separator);
    }
    written.push(markup);
    isJoined = piece.syllable !== undefined || (isJoined && markup === "");
  }
  return written.join("");
}

/**
 * Mark up a converted text, one element per syllable.
 *
 * Takes the pieces {@link convertPieces} produces, so that a caller can convert
 * once and render more than one way.
 */
export function toHtml(
  pieces: readonly ConvertedPiece[],
  options: HtmlOptions = {},
): string {
  return writePieces(pieces, options);
}
