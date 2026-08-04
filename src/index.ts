/**
 * pinyinjs — a toolkit for Chinese hanzi and pinyin.
 *
 * Exports are listed one by one rather than re-exported wholesale, so that the
 * public surface is a deliberate choice rather than whatever happens to be
 * exported internally.
 */

export {
  FREQUENCY_BUCKETS,
  FrequencyTable,
} from "./dictionary/frequency-table.js";

export { KeyIndex } from "./dictionary/key-index.js";
export type { KeyLookup } from "./dictionary/key-index.js";

export {
  detectScript,
  DEFAULT_LOCALE,
  isLocale,
  isScript,
  LOCALES,
  SCRIPTS,
} from "./script/script.js";
export type { Locale, Script } from "./script/script.js";

export {
  FINALS,
  INITIALS,
  isFinal,
  isInitial,
  isPalatalInitial,
} from "./syllable/phonology.js";
export type { Final, Initial } from "./syllable/phonology.js";

export { readWord, splitSyllables } from "./syllable/split.js";

export {
  isSyllable,
  normaliseUmlaut,
  readSyllable,
  writeSyllable,
  writeSyllableSpelling,
} from "./syllable/syllable.js";
export type { Syllable, ToneNotation } from "./syllable/syllable.js";

export {
  applyToneMark,
  stripToneMarks,
  toneFromMarks,
} from "./tone/tone-mark.js";

export { isTone, NEUTRAL_TONE, toneFromNotation, TONES } from "./tone/tone.js";
export type { Tone } from "./tone/tone.js";
