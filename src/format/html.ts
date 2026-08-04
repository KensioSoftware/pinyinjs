import { isUncertain, type ReadingConfidence } from "../decode/confidence.js";
import { READING_CHARGE } from "../decode/lattice.js";
import {
  type ConvertedPiece,
  type ConvertOptions,
  convertPieces,
} from "../decode/convert.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { writeSyllable } from "../syllable/syllable.js";

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
   * rejected. See {@link isUncertain} for what qualifies and how often it is
   * wrong.
   */
  readonly markUncertain?: boolean;
}

/**
 * The class every syllable carries, whatever else it carries.
 */
const SYLLABLE_CLASS = "py-syllable";

const UNCERTAIN_CLASS = "py-uncertain";

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
function escape(text: string): string {
  return text.replaceAll(/[&<>"]/gu, (character) => {
    /* c8 ignore next -- the pattern only matches what the map holds */
    return ESCAPES.get(character) ?? character;
  });
}

/**
 * The readings a syllable was chosen over, as the reader would write them.
 *
 * Only the ones that made it uncertain: a rival dearer than
 * {@link READING_CHARGE} could only be taken by breaking a dictionary word
 * apart, so it was never really in the running and listing it would suggest
 * otherwise.
 */
function alternativesOf(
  confidence: ReadingConfidence,
  options: HtmlOptions,
): readonly string[] {
  const written = confidence.alternatives
    .filter((alternative) => alternative.cost < READING_CHARGE)
    .map((alternative) =>
      alternative.reading
        .map((syllable) => writeSyllable(syllable, options.notation))
        .join(""),
    );
  return [...new Set(written)];
}

/**
 * Mark up one piece of a conversion.
 */
function writePiece(piece: ConvertedPiece, options: HtmlOptions): string {
  const { toneClasses = true, markUncertain = true } = options;
  if (piece.syllable === undefined) {
    return escape(piece.text);
  }

  const classes = [SYLLABLE_CLASS];
  if (toneClasses && piece.syllable.tone !== undefined) {
    classes.push(`py-tone-${String(piece.syllable.tone)}`);
  }
  const alternatives =
    markUncertain &&
    piece.confidence !== undefined &&
    isUncertain(piece.confidence)
      ? alternativesOf(piece.confidence, options)
      : [];
  if (alternatives.length > 0) {
    classes.push(UNCERTAIN_CLASS);
  }

  const attributes =
    alternatives.length > 0
      ? ` data-alternatives="${escape(alternatives.join(" "))}"`
      : "";
  return `<span class="${classes.join(" ")}"${attributes}>${escape(piece.text)}</span>`;
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
  return pieces.map((piece) => writePiece(piece, options)).join("");
}

/**
 * Convert hanzi to pinyin as HTML, one element per syllable.
 *
 * What per-syllable confidence is for, and the reason ALGORITHM.md asks for it:
 * a reading the decode was guessing at can be *shown* to be a guess, which for
 * a learner is a feature rather than a diagnostic. No styling is imposed — the
 * classes are hooks, and the page decides whether a fourth tone is red and an
 * uncertain reading is dotted underneath.
 *
 * Nothing is wrapped around the whole conversion, and anything that is not Han
 * passes through escaped rather than marked up.
 */
export function convertToHtml(
  dictionary: Dictionary,
  text: string,
  options: HtmlOptions = {},
): string {
  return toHtml(convertPieces(dictionary, text, options), options);
}
