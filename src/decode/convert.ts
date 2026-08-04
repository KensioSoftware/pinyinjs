import type { Dictionary } from "../dictionary/dictionary.js";
import type { Locale } from "../script/script.js";
import {
  type Syllable,
  type ToneNotation,
  writeSyllable,
} from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { decodeGreedily } from "./greedy.js";
import { splitRuns } from "./runs.js";
import { applySandhi, type SandhiOptions } from "./sandhi.js";
import type { DecodedWord } from "./word.js";

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
}

/**
 * Capitalise the first letter of a syllable.
 */
function capitalise(text: string): string {
  return text.slice(0, 1).toUpperCase() + text.slice(1);
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
 * Write one decoded word, applying its capitalisation.
 *
 * Only proper nouns are capitalised here. Sentence-initial capitals and the
 * rest of GB/T 16159 spacing belong to the orthography pass, which is Phase 4.
 */
function writeWord(
  reading: readonly Syllable[],
  word: DecodedWord,
  notation: ToneNotation,
): string {
  if (reading.length === 0) {
    return word.text;
  }
  const written = reading.map((syllable) => writeSyllable(syllable, notation));
  const joined = written.join("");
  return word.isProperNoun ? capitalise(joined) : joined;
}

/**
 * How a Han run is turned into words.
 */
type Decode = (dictionary: Dictionary, run: string) => readonly DecodedWord[];

/**
 * Write one Han run's worth of decoded words.
 */
function writeRun(
  dictionary: Dictionary,
  words: readonly DecodedWord[],
  options: Required<Pick<ConvertOptions, "locale" | "notation">> &
    ConvertOptions,
): string {
  const { locale, notation, sandhi } = options;
  // Sandhi runs across the whole run rather than within a word, since 不 in one
  // word assimilates to the tone starting the next.
  const readings = words.map((word) => readingFor(dictionary, word, locale));
  const flattened = applySandhi(readings.flat(), sandhi);

  let at = 0;
  const written: string[] = [];
  for (const [index, word] of words.entries()) {
    /* c8 ignore next -- readings is built by mapping over these same words */
    const length = readings[index]?.length ?? 0;
    written.push(writeWord(flattened.slice(at, at + length), word, notation));
    at += length;
  }
  return written.join(" ");
}

/**
 * Run the pipeline over a text with a given decoder.
 */
function convertWith(
  decode: Decode,
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions,
): string {
  const { locale = "zh-CN", notation = "marks", ...rest } = options;
  let converted = "";

  for (const run of splitRuns(text)) {
    converted += run.isHan
      ? writeRun(dictionary, decode(dictionary, run.text), {
          ...rest,
          locale,
          notation,
        })
      : run.text;
  }

  return converted;
}

/**
 * Convert hanzi to pinyin with the lattice decoder.
 *
 * The recommended path. Builds every candidate reading of each Han run, locks
 * the positions that read the same way whichever candidates are chosen, and
 * scores only what is left — see {@link decodeRun} and ALGORITHM.md.
 *
 * Spacing is one gap per decoded word, which is not orthography: GB/T 16159
 * grouping, apostrophes and sentence capitals are Phase 4, so the spacing here
 * is what the decode believes rather than what the standard writes.
 */
export function convert(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  return convertWith(decodeRun, dictionary, text, options);
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
  return convertWith(decodeGreedily, dictionary, text, options);
}
