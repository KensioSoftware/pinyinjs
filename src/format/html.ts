import { isUncertain, type ReadingConfidence } from "../decode/confidence.js";
import { READING_CHARGE } from "../decode/lattice.js";
import {
  type ConvertedPiece,
  type ConvertOptions,
  convertPieces,
} from "../decode/convert.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { DEFAULT_LOCALE, type Locale } from "../script/script.js";
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
  /**
   * Whether each syllable declares what language it is in. Defaults to true.
   *
   * `lang="zh-Latn-CN-pinyin"`, or `zh-Latn-TW-pinyin` where the conversion
   * reads `zh-TW`. See {@link languageTag} for why that matters, and what to
   * do instead of turning it off.
   */
  readonly lang?: boolean;
}

/**
 * The class every syllable carries, whatever else it carries.
 */
const SYLLABLE_CLASS = "py-syllable";

const UNCERTAIN_CLASS = "py-uncertain";

/**
 * What a syllable declares itself to be, in the reading standard it was read in.
 *
 * A syllable element holds Mandarin written in the Latin alphabet, which is
 * neither the `zh` of the surrounding page nor the `en` of a page that quotes
 * it — and nothing about `yín` on its own says so. The tag is what a screen
 * reader consults before deciding how to pronounce it, and what a browser
 * consults for hyphenation and font selection; without one, `xíng` is read as
 * whatever the page around it claims to be, which is how pinyin ends up
 * spoken as English.
 *
 * The subtags are all registered and mean exactly this: `Latn` for the script,
 * the region for the reading standard, and the `pinyin` variant, whose prefix
 * in the IANA registry is `zh-Latn`. The region is the one distinction the
 * conversion itself makes — 垃圾 is `lājī` under `zh-CN` and `lèsè` under
 * `zh-TW` — so it is read off {@link ConvertOptions.locale} rather than
 * guessed at.
 *
 * Tone notation does not enter into it. `hang2` is pinyin spelt with a tone
 * number, not another romanisation, so it takes the same tag as `háng`.
 *
 * The cost is the tag repeated on every syllable, which is the price of
 * wrapping nothing around the whole conversion. A caller who would rather
 * declare it once can set `lang: false` and put the same tag on a wrapper of
 * their own, which is inherited by everything inside it.
 */
function languageTag(locale: Locale = DEFAULT_LOCALE): string {
  switch (locale) {
    case "zh-CN": {
      return "zh-Latn-CN-pinyin";
    }
    case "zh-TW": {
      return "zh-Latn-TW-pinyin";
    }
  }
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
  const { toneClasses = true, markUncertain = true, lang = true } = options;
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

  const attributes = [`class="${classes.join(" ")}"`];
  if (lang) {
    attributes.push(`lang="${languageTag(options.locale)}"`);
  }
  if (alternatives.length > 0) {
    attributes.push(`data-alternatives="${escape(alternatives.join(" "))}"`);
  }
  return `<span ${attributes.join(" ")}>${escape(piece.text)}</span>`;
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
const BASE_TAG = "zh";

/**
 * One base and everything read off it.
 */
interface Annotation {
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
function annotationsOf(pieces: readonly ConvertedPiece[]): Annotation[] {
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
    return pieces.map((piece) => writePiece(piece, options)).join("");
  }

  const reading = pieces.map((piece) => writePiece(piece, options)).join("");
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
