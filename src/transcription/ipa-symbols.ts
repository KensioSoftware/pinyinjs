/**
 * The IPA symbols each part of a syllable is written with, as tables.
 *
 * A broad transcription rather than a narrow one — see `ipa.ts` for what that
 * settles and what it leaves out.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";

/**
 * The symbol each initial is transcribed with.
 *
 * The aspiration series is where pinyin's letters mislead most: pinyin b is
 * [p], and pinyin p is [pʰ]. Nothing in Mandarin is voiced here, which is what
 * both Wade-Giles and Yale are working around in their own directions.
 */
export const INITIAL_SYMBOLS = new Map<Initial, string>([
  ["b", "p"],
  ["p", "pʰ"],
  ["m", "m"],
  ["f", "f"],
  ["d", "t"],
  ["t", "tʰ"],
  ["n", "n"],
  ["l", "l"],
  ["g", "k"],
  ["k", "kʰ"],
  ["h", "x"],
  ["j", "tɕ"],
  ["q", "tɕʰ"],
  ["x", "ɕ"],
  ["zh", "ʈʂ"],
  ["ch", "ʈʂʰ"],
  ["sh", "ʂ"],
  ["r", "ʐ"],
  ["z", "ts"],
  ["c", "tsʰ"],
  ["s", "s"],
]);

/**
 * The symbols each final is transcribed with.
 *
 * The vowels are where the transcription and the spelling part company: pinyin
 * writes one e for [ɤ], [ə] and [ɛ], and one i for [i] and [ɨ], because a
 * spelling can let the context do the work and a transcription cannot. 天 tiān
 * is [tʰiɛn] and 恩 ēn is [ən].
 */
export const FINAL_SYMBOLS: Record<Final, string> = {
  a: "a",
  o: "ɔ",
  e: "ɤ",
  ê: "ɛ",
  er: "aɚ",
  ai: "ai",
  ei: "ei",
  ao: "au",
  ou: "ou",
  an: "an",
  en: "ən",
  ang: "aŋ",
  eng: "əŋ",
  ong: "ʊŋ",
  i: "i",
  ia: "ia",
  io: "iɔ",
  ie: "ie",
  iao: "iau",
  iou: "iou",
  ian: "iɛn",
  in: "in",
  iang: "iaŋ",
  ing: "iŋ",
  iong: "iʊŋ",
  u: "u",
  ua: "ua",
  uo: "uo",
  uai: "uai",
  uei: "uei",
  uan: "uan",
  uen: "uən",
  uang: "uaŋ",
  ueng: "uəŋ",
  ü: "y",
  üe: "ye",
  üan: "yɛn",
  ün: "yn",
  m: "m̩",
  n: "n̩",
  ng: "ŋ̍",
};

/**
 * The initials after which the i final is the empty rhyme [ɨ].
 */
export const EMPTY_RHYME_INITIALS = new Set<Initial>([
  "zh",
  "ch",
  "sh",
  "r",
  "z",
  "c",
  "s",
]);

/**
 * The initials after which pinyin's -o final is [uo] rather than [ɔ].
 */
export const LABIAL_INITIALS = new Set<Initial>(["b", "p", "m", "f"]);

/**
 * What 儿化 adds.
 *
 * A suffix, and that is an approximation this module states rather than hides:
 * a rhotacised syllable is not the plain one with [ɚ] after it. 玩儿 wánr is
 * [wɑɚ̯] with the nasal gone, and 味儿 wèir keeps its glide while 事儿 shìr
 * loses its empty rhyme entirely. Modelling that needs a rhyme-by-rhyme table
 * of fused forms, which is a phonological claim rather than a transcription
 * convention, and it is not made here.
 */
export const ERHUA_SUFFIX = "ɚ";

/**
 * The Chao tone letter each tone is written with.
 *
 * The neutral tone has none: it has no contour of its own, taking its pitch
 * from the syllable before it, and the transcription leaves it unwritten. That
 * is bopomofo's problem in reverse — bopomofo cannot say "no tone", and this
 * cannot say "neutral".
 */
export const TONE_LETTERS = new Map<Tone, string>([
  [1, "˥"],
  [2, "˧˥"],
  [3, "˨˩˦"],
  [4, "˥˩"],
  [NEUTRAL_TONE, ""],
]);

/**
 * How an IPA syllable writes its tone.
 *
 * Chao's tone letters are the standard notation and the default; `numbers`
 * writes his pitch numerals instead (55, 35, 214, 51), which is what a plain
 * ASCII field wants.
 */
export interface IpaOptions {
  readonly tones?: "letters" | "numbers" | "none";
}

/**
 * The pitch value each tone is numbered with, in Chao's own notation.
 */
export const TONE_NUMBERS = new Map<Tone, string>([
  [1, "55"],
  [2, "35"],
  [3, "214"],
  [4, "51"],
  [NEUTRAL_TONE, ""],
]);
