/**
 * Writing a conversion as ruby annotation.
 *
 * The pinyin sits above the characters rather than beside them, so the pieces
 * are regrouped against the text they annotate.
 */
import { escape, type HtmlOptions, toHtml, writePieces } from "./html.js";
import { type ConvertedPiece, convertPieces } from "../decode/convert.js";
import type { Dictionary } from "../dictionary/dictionary.js";

/**
 * What the characters being annotated declare themselves to be.
 *
 * The mirror of {@link languageTag}: inside an annotation the base is hanzi and
 * only the reading is pinyin, so on an English page the two need different tags
 * and neither can be left to inherit.
 *
 * **`zh`, with no script subtag, and that is deliberate.** `Hans` or `Hant`
 * would be better for font selection, and neither can be known here. The
 * conversion's locale does not settle it — script and locale are separate axes,
 * and a mainland edition of a classical text is 繁體 read as `zh-CN` — and
 * detecting it from the characters needs the script tables, which load
 * separately from the dictionary precisely so that converting does not pay for
 * them. A tag that is merely unspecific is worth more than one that is wrong,
 * so a caller who knows the script should wrap the output and say so there.
 */
export const BASE_TAG = "zh";

/**
 * One base and everything read off it.
 */
export interface Annotation {
  /** The characters, or undefined for text that reads as nothing. */
  readonly source: string | undefined;
  readonly pieces: readonly ConvertedPiece[];
}

/**
 * Gather pieces into the bases they are readings of.
 *
 * A piece naming characters opens a group and every piece after it that names
 * none reads on into the same one, which is how 玩儿 keeps `wánr` over both
 * characters and 95% keeps `bǎifēnzhījiǔshíwǔ` over all three. Pieces writing
 * no reading at all — the spaces between words, and runs that were never Han —
 * are their own groups, with nothing to annotate.
 */
export function annotationsOf(pieces: readonly ConvertedPiece[]): Annotation[] {
  const groups: Annotation[] = [];
  for (const [at, piece] of pieces.entries()) {
    const open = groups.at(-1);
    if (open?.source !== undefined && continues(piece, pieces[at + 1])) {
      groups[groups.length - 1] = {
        source: open.source,
        pieces: [...open.pieces, piece],
      };
      continue;
    }
    groups.push({ source: piece.source, pieces: [piece] });
  }
  return groups;
}

/**
 * Whether a piece belongs to the annotation the group before it opened.
 *
 * Three kinds do:
 *
 * - A **syllable naming no characters** is reading on into the ones already
 *   named, which is 儿化 and every syllable of a read number after the first.
 * - A **separator that is not a space** is a mark *inside* one orthographic
 *   word rather than a gap between two — the hyphen of `gāngān-jìngjìng`, the
 *   only one GB/T 16159 writes — so it belongs beside the syllables it divides.
 * - A **space with more of the same reading after it**. 1988 is read
 *   `yī jiǔ bā bā`, four syllables over one base, and the spaces between them
 *   are inside that reading rather than between two of them.
 *
 * That last one is why this needs the piece after it. A space is written the
 * same way whether it separates two words or two syllables of one number, and
 * what tells them apart is whether what follows is still reading the same
 * characters. Told apart wrongly, the reading escapes its own annotation:
 * 1988年 came out as `1988` over `yī` with `jiǔ bā bā` loose beside it.
 *
 * A space between two words is the case that does not continue, and dropping it
 * is the point: the hanzi it annotates has no space in it, and each base is
 * already its own group on the page.
 */
function continues(
  piece: ConvertedPiece,
  next: ConvertedPiece | undefined,
): boolean {
  if (piece.syllable !== undefined) {
    return piece.source === undefined;
  }
  if (piece.source !== undefined) {
    return false;
  }
  return (
    piece.text.trim() !== "" ||
    (next?.syllable !== undefined && next.source === undefined)
  );
}

/**
 * Mark up one base and its reading.
 */
function writeAnnotation(annotation: Annotation, options: HtmlOptions): string {
  const { lang = true } = options;
  const { source, pieces } = annotation;
  if (pieces.every((piece) => piece.syllable === undefined)) {
    // Nothing is read here. Either it is source text that simply has no
    // reading — punctuation, a Latin word — and is written as the author wrote
    // it, or it is pinyin orthography with no source behind it at all: the
    // space between two words, and the hyphen in `gāngān-jìngjìng`. Writing
    // those into the hanzi would annotate 干干净净 as 干干-净净.
    return source === undefined ? "" : escape(source);
  }
  if (source === undefined) {
    // A reading whose piece never named what it reads. Nothing a conversion
    // builds looks like this — every group is opened by a piece carrying its
    // characters — but {@link toAnnotatedHtml} takes pieces from the caller,
    // and there is no base to hang an annotation on, so it is written as the
    // plain markup it would have got from {@link toHtml}.
    return writePieces(pieces, options);
  }

  const reading = writePieces(pieces, options);
  // The tag goes on the <ruby> rather than around the base, and the syllables
  // inside the <rt> override it with their own. `<rb>` would be the obvious
  // place for it and is not an element any more: the WHATWG parser drops it,
  // leaving the base as bare text, so writing one would mean emitting markup
  // that no browser keeps.
  const opening = lang ? `<ruby lang="${BASE_TAG}">` : "<ruby>";
  return `${opening}${escape(source)}<rp>(</rp><rt>${reading}</rt><rp>)</rp></ruby>`;
}

/**
 * Mark up a converted text as hanzi with its reading above, syllable by
 * syllable.
 *
 * The output every other mode cannot give: `convert` and {@link toHtml} write
 * the pinyin *instead of* the hanzi, and a learner's text, a subtitle and a
 * dictionary entry all want both at once. The markup is `<ruby>`, which every
 * current browser lays out natively and which degrades to parentheses through
 * `<rp>` where it is not supported.
 *
 * ```html
 * <ruby lang="zh">银<rp>(</rp><rt><span …>yín</span></rt><rp>)</rp></ruby>
 * ```
 *
 * Each `<rt>` holds whatever {@link toHtml} would have written for those
 * syllables, so tone classes and uncertainty marking work inside an annotation
 * exactly as they do outside one.
 *
 * **A base is not always one character.** 玩儿 is two characters and the one
 * syllable `wánr`, and a read number reverses on the way — 95% is
 * `bǎifēnzhījiǔshíwǔ` — so both are annotated whole. Splitting them per
 * character is what everything that emits ruby from a pinyin library gets
 * wrong, and it is why {@link ConvertedPiece.source} exists.
 */
export function toAnnotatedHtml(
  pieces: readonly ConvertedPiece[],
  options: HtmlOptions = {},
): string {
  return annotationsOf(pieces)
    .map((annotation) => writeAnnotation(annotation, options))
    .join("");
}

/**
 * Convert hanzi to pinyin as HTML, hanzi and reading together.
 *
 * {@link toAnnotatedHtml} applied to a fresh conversion; see it for what the
 * markup is and why a base is not always one character.
 */
export function convertToAnnotatedHtml(
  dictionary: Dictionary,
  text: string,
  options: HtmlOptions = {},
): string {
  return toAnnotatedHtml(convertPieces(dictionary, text, options), options);
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
