import type { Dictionary } from "../dictionary/dictionary.js";
import { type ApostropheStyle, markWord } from "../orthography/apostrophe.js";
import {
  capitaliseSentenceParts,
  capitaliseWord,
  type CapitalStyle,
  isSentence,
} from "../orthography/capitals.js";
import { applyGrouping } from "../orthography/grouping.js";
import {
  type PunctuationStyle,
  toLatinPunctuationParts,
} from "../orthography/punctuation.js";
import type { Locale } from "../script/script.js";
import {
  type Syllable,
  type ToneNotation,
  writeSyllable,
} from "../syllable/syllable.js";
import type { ReadingConfidence } from "./confidence.js";
import { decodeRun, decodeRunScored } from "./decode.js";
import { decodeGreedily } from "./greedy.js";
import { splitRuns } from "./runs.js";
import { applySandhi, type SandhiOptions } from "./sandhi.js";
import type { DecodedWord, ScoredWord } from "./word.js";

/**
 * How a conversion should be carried out and written.
 */
export interface ConvertOptions {
  /** Which reading standard to use. Defaults to `zh-CN`. */
  readonly locale?: Locale;
  /** How tones are written. Defaults to diacritics. */
  readonly notation?: ToneNotation;
  /** Which tone sandhi to apply. */
  readonly sandhi?: SandhiOptions;
  /** When the 隔音符号 is written. Defaults to `always`. */
  readonly apostrophe?: ApostropheStyle;
  /** Which capitals are written. Defaults to `auto`. */
  readonly capitals?: CapitalStyle;
  /** Whether Chinese punctuation is rewritten. Defaults to `latin`. */
  readonly punctuation?: PunctuationStyle;
  /** Whether GB/T 16159 word grouping is applied. Defaults to true. */
  readonly grouping?: boolean;
}

/**
 * One piece of a conversion: a syllable, or the text between two of them.
 *
 * A conversion is assembled piece by piece and joined at the very end, so that
 * a caller wanting to render each syllable separately — colouring its tone,
 * marking it uncertain — is not left trying to find the syllables again in a
 * finished string. {@link convert} is this, joined.
 */
export interface ConvertedPiece {
  readonly text: string;
  /** The syllable this piece writes, or undefined where it writes none. */
  readonly syllable: Syllable | undefined;
  /**
   * How settled that syllable was, where the decode reported it.
   *
   * Only {@link convertPieces} fills this in, and only for a syllable the
   * lattice decoded: the greedy baseline cannot say what it rejected, and a
   * Taiwan reading that differs in length from its mainland form cannot be
   * lined up with it.
   */
  readonly confidence: ReadingConfidence | undefined;
}

/**
 * The orthographic choices a conversion has settled, rather than defaulted.
 */
interface Written {
  readonly notation: ToneNotation;
  readonly apostrophe: ApostropheStyle;
  readonly capitals: CapitalStyle;
}

/**
 * The reading a word takes in a locale.
 *
 * `zh-TW` is stored as a delta, so a word with no Taiwan reading simply reads
 * the same in both.
 */
function readingFor(
  dictionary: Dictionary,
  word: DecodedWord,
  locale: Locale,
): readonly Syllable[] {
  if (locale !== "zh-TW") {
    return word.reading;
  }
  return dictionary.lookup(word.text)?.taiwanReading ?? word.reading;
}

/**
 * Text that writes no syllable: a space, or a run that was never Han.
 */
function plainPiece(text: string): ConvertedPiece {
  return { text, syllable: undefined, confidence: undefined };
}

/**
 * Write one decoded word as one piece per syllable.
 *
 * Only proper nouns are capitalised here; a sentence capital is applied to the
 * whole conversion afterwards, since it belongs to whichever run happens to
 * start the sentence.
 */
function writeWord(
  reading: readonly Syllable[],
  confidence: readonly ReadingConfidence[],
  word: DecodedWord,
  written: Written,
): readonly ConvertedPiece[] {
  if (reading.length === 0) {
    return [plainPiece(word.text)];
  }
  // A tone number already ends its syllable, raised or not, so `xi1an1` cannot
  // be misread and the 隔音符号 would only be noise.
  const isNumbered =
    written.notation === "numbers" || written.notation === "superscript";
  const spellings = markWord(
    reading.map((syllable) => writeSyllable(syllable, written.notation)),
    isNumbered ? "never" : written.apostrophe,
  );
  const isCapitalised = word.isProperNoun && written.capitals !== "none";

  return spellings.map((spelling, at) => ({
    text: at === 0 && isCapitalised ? capitaliseWord(spelling) : spelling,
    syllable: reading[at],
    confidence: confidence[at],
  }));
}

/**
 * How a Han run is turned into words, with whatever the decoder can say about
 * how settled they were.
 */
type Decode = (dictionary: Dictionary, run: string) => readonly ScoredWord[];

/**
 * A decoder that reports no confidence at all, which is every decoder but one.
 */
function unscored(
  decode: (dictionary: Dictionary, run: string) => readonly DecodedWord[],
): Decode {
  return (dictionary, run) =>
    decode(dictionary, run).map((word) => ({ word, confidence: [] }));
}

/**
 * The lattice decoder, reporting nothing about its own confidence.
 */
const LATTICE: Decode = unscored(decodeRun);

/**
 * The greedy baseline, which has nothing to report either way.
 */
const GREEDY: Decode = unscored(decodeGreedily);

/**
 * Write one Han run's worth of decoded words.
 */
function writeRun(
  dictionary: Dictionary,
  words: readonly ScoredWord[],
  locale: Locale,
  written: Written,
  sandhi: SandhiOptions | undefined,
): readonly ConvertedPiece[] {
  // Sandhi runs across the whole run rather than within a word, since 不 in one
  // word assimilates to the tone starting the next.
  const readings = words.map((scored) =>
    readingFor(dictionary, scored.word, locale),
  );
  const flattened = applySandhi(readings.flat(), sandhi);

  let at = 0;
  const pieces: ConvertedPiece[] = [];
  for (const [index, scored] of words.entries()) {
    /* c8 ignore next -- readings is built by mapping over these same words */
    const length = readings[index]?.length ?? 0;
    if (index > 0) {
      // A space, unless 分词连写 wrote a hyphen: 干干净净 is one orthographic
      // word, `gāngān-jìngjìng`, cut into two decoded ones.
      pieces.push(plainPiece(scored.word.separator ?? " "));
    }
    pieces.push(
      ...writeWord(
        flattened.slice(at, at + length),
        // A locale reading of a different length cannot be lined up with the
        // confidence reported for the reading it replaced.
        scored.confidence.length === length ? scored.confidence : [],
        scored.word,
        written,
      ),
    );
    at += length;
  }
  return pieces;
}

/**
 * Rewrite every piece's text with a pass that reads across all of them.
 */
function rewrite(
  pieces: readonly ConvertedPiece[],
  pass: (parts: readonly string[]) => readonly string[],
): readonly ConvertedPiece[] {
  const rewritten = pass(pieces.map((piece) => piece.text));
  return pieces.map((piece, at) => {
    /* c8 ignore next -- one part comes back for each part handed over */
    const text = rewritten[at] ?? piece.text;
    return text === piece.text ? piece : { ...piece, text };
  });
}

/**
 * Run the pipeline over a text with a given decoder.
 */
function convertWith(
  decode: Decode,
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions,
): readonly ConvertedPiece[] {
  const {
    locale = "zh-CN",
    notation = "marks",
    apostrophe = "always",
    capitals = "auto",
    punctuation = "latin",
    grouping = true,
    sandhi,
  } = options;
  const written: Written = { notation, apostrophe, capitals };
  const converted: ConvertedPiece[] = [];

  for (const run of splitRuns(text)) {
    if (!run.isHan) {
      converted.push(plainPiece(run.text));
      continue;
    }
    const decoded = decode(dictionary, run.text);
    // Grouping rewrites word boundaries and never the readings behind them, so
    // the syllables — and the confidence beside them — survive it in order.
    const words = grouping
      ? regroup(
          decoded,
          applyGrouping(
            decoded.map((scored) => scored.word),
            dictionary,
          ),
        )
      : decoded;
    converted.push(...writeRun(dictionary, words, locale, written, sandhi));
  }
  let pieces: readonly ConvertedPiece[] = converted;

  // Both of these read the whole conversion rather than one run: a sentence
  // capital belongs to whichever run happens to start the sentence, and a mark
  // needs to know whether anything follows it before it takes a space.
  if (capitals === "auto" && isSentence(text)) {
    pieces = rewrite(pieces, capitaliseSentenceParts);
  }
  return punctuation === "latin"
    ? rewrite(pieces, toLatinPunctuationParts)
    : pieces;
}

/**
 * Redistribute the decode's per-syllable confidence over regrouped words.
 *
 * 分词连写 moves word boundaries — 看 and 了 become 看了 — without touching a
 * reading, so the run's syllables are the same syllables in the same order and
 * are simply cut in different places.
 */
function regroup(
  decoded: readonly ScoredWord[],
  grouped: readonly DecodedWord[],
): readonly ScoredWord[] {
  const confidence = decoded.flatMap((scored) => [...scored.confidence]);
  let at = 0;
  return grouped.map((word) => {
    const held = confidence.slice(at, at + word.reading.length);
    at += word.reading.length;
    return { word, confidence: held };
  });
}

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
 * {@link ReadingConfidence} — which is what an output format needs to show a
 * reader where it was guessing.
 *
 * Costs a second sweep of the lattice, which is why it is not what
 * {@link convert} runs.
 */
export function convertPieces(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(decodeRunScored, dictionary, text, options);
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
