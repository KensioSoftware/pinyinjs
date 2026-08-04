import type { Dictionary } from "../dictionary/dictionary.js";
import type { Locale } from "../script/script.js";
import {
  type Syllable,
  type ToneNotation,
  writeSyllable,
} from "../syllable/syllable.js";
import { decodeGreedily, type DecodedWord } from "./greedy.js";
import { splitRuns } from "./runs.js";
import { applySandhi, type SandhiOptions } from "./sandhi.js";

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
 * Convert hanzi to pinyin with the greedy baseline decoder.
 *
 * **The baseline, kept to measure against.** See {@link decodeGreedily} for why
 * this is not the intended algorithm, and ALGORITHM.md for what replaces it.
 * Spacing here is one gap per matched word, which is not orthography — GB/T
 * 16159 grouping is Phase 4 — so the spacing score this produces is a floor
 * rather than an attempt.
 */
export function convertGreedily(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  const { locale = "zh-CN", notation = "marks", sandhi } = options;
  let converted = "";

  for (const run of splitRuns(text)) {
    if (!run.isHan) {
      converted += run.text;
      continue;
    }

    const words = decodeGreedily(dictionary, run.text);
    // Sandhi runs across the whole run rather than within a word, since 不 in
    // one word assimilates to the tone starting the next.
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
    converted += written.join(" ");
  }

  return converted;
}
