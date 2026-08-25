/**
 * One syllable of a conversion, as the element that carries it.
 *
 * The classes, the language tag and the attribute naming what the decode
 * rejected all hang off a single syllable, so they are decided in one place and
 * `html.ts` is left with the run.
 */
import { isUncertain, type ReadingConfidence } from "../decode/confidence.js";
import type { ConvertedPiece } from "../decode/convert.js";
import { READING_CHARGE } from "../decode/lattice.js";
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import { escape, type HtmlOptions } from "./html.js";
import { languageTag } from "./language-tag.js";
import { capitalised, isCapitalised, isPinyinMark } from "./transcribed.js";

/**
 * The class every syllable carries, whatever else it carries.
 */
const SYLLABLE_CLASS = "py-syllable";

const UNCERTAIN_CLASS = "py-uncertain";

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
 * How one syllable is written, in pinyin or in the system that replaces it.
 *
 * The capital comes from the pinyin the conversion settled rather than from the
 * syllable, for the reason {@link isCapitalised} gives, and only the systems
 * that write capitals at all take it.
 */
function readingOf(
  piece: ConvertedPiece,
  syllable: Syllable,
  options: HtmlOptions,
): string {
  const { transcription } = options;
  if (transcription === undefined) {
    return piece.text;
  }
  const written = transcription.write(syllable, options.notation !== "none");
  return transcription.capitals && isCapitalised(piece.text)
    ? capitalised(written)
    : written;
}

/**
 * Mark up one piece of a conversion.
 *
 * A piece that is pinyin's own mark writes nothing where a transcription is
 * asked for, since {@link writePieces} puts the system's own join in its place.
 */
export function writePiece(
  piece: ConvertedPiece,
  options: HtmlOptions,
): string {
  const { toneClasses = true, markUncertain = true, lang = true } = options;
  if (piece.syllable === undefined) {
    return options.transcription !== undefined && isPinyinMark(piece)
      ? ""
      : escape(piece.text);
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

  const attributes = [`class="${classes.join(" ")}"`];
  if (lang) {
    attributes.push(
      `lang="${languageTag(options.locale, options.transcription)}"`,
    );
  }
  if (alternatives.length > 0) {
    attributes.push(`data-alternatives="${escape(alternatives.join(" "))}"`);
  }
  const reading = readingOf(piece, piece.syllable, options);
  return `<span ${attributes.join(" ")}>${escape(reading)}</span>`;
}
