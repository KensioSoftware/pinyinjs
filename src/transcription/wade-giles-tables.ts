/**
 * How Wade-Giles spells each part of a syllable, as tables.
 *
 * Separated from the rules that read them, so that this file is only ever a
 * statement of what the system writes.
 */
import type { Final, Initial } from "../syllable/phonology.js";

/**
 * The mark Wade-Giles writes aspiration with.
 *
 * ASCII, because that is what a keyboard produces and what nearly all text
 * carries; the turned comma ʻ of the original and of library cataloguing is
 * read back but not written. Every shape a text might use is accepted on input,
 * which matters more here than in most places — this mark is the one carrying
 * the p/pʻ distinction.
 */
export const APOSTROPHE = "'";

/**
 * Every shape the aspiration mark is written with in the wild.
 */
export const APOSTROPHES = /['ʻʼ‘’`´ʹ]/gu;

/**
 * How each initial is spelled.
 *
 * The unvoiced/aspirated pairing is what makes this look wrong to a reader who
 * only knows pinyin: Wade-Giles writes the *unaspirated* stop with the plain
 * letter, so pinyin b is `p` and pinyin p is `pʻ`. Nothing is missing from the
 * table; the whole series is shifted.
 */
export const INITIAL_SPELLINGS = new Map<Initial, string>([
  ["b", "p"],
  ["p", `p${APOSTROPHE}`],
  ["m", "m"],
  ["f", "f"],
  ["d", "t"],
  ["t", `t${APOSTROPHE}`],
  ["n", "n"],
  ["l", "l"],
  ["g", "k"],
  ["k", `k${APOSTROPHE}`],
  ["h", "h"],
  ["j", "ch"],
  ["q", `ch${APOSTROPHE}`],
  ["x", "hs"],
  ["zh", "ch"],
  ["ch", `ch${APOSTROPHE}`],
  ["sh", "sh"],
  ["r", "j"],
  ["z", "ts"],
  ["c", `ts${APOSTROPHE}`],
  ["s", "s"],
]);

/**
 * How z, c and s are spelled before the empty rhyme.
 *
 * 資 zī is `tzŭ` rather than `tsŭ`, and 私 sī is `ssŭ` rather than `sŭ`: the
 * three sibilants take a different shape in front of the vowel that is not
 * really one.
 */
export const SIBILANT_SPELLINGS = new Map<Initial, string>([
  ["z", "tz"],
  ["c", `tz${APOSTROPHE}`],
  ["s", "ss"],
]);

/**
 * How each final is spelled after an initial.
 *
 * `ueng` never occurs after one — 翁 wēng is the only syllable that has it —
 * and is written with the form the pattern would give it rather than being made
 * a special case.
 */
export const FINAL_SPELLINGS: Record<Final, string> = {
  a: "a",
  o: "o",
  e: "ê",
  ê: "eh",
  er: "êrh",
  ai: "ai",
  ei: "ei",
  ao: "ao",
  ou: "ou",
  an: "an",
  en: "ên",
  ang: "ang",
  eng: "êng",
  ong: "ung",
  i: "i",
  ia: "ia",
  io: "io",
  ie: "ieh",
  iao: "iao",
  iou: "iu",
  ian: "ien",
  in: "in",
  iang: "iang",
  ing: "ing",
  iong: "iung",
  u: "u",
  ua: "ua",
  uo: "uo",
  uai: "uai",
  uei: "ui",
  uan: "uan",
  uen: "un",
  uang: "uang",
  ueng: "uêng",
  ü: "ü",
  üe: "üeh",
  üan: "üan",
  ün: "ün",
  m: "m",
  n: "n",
  ng: "ng",
};

/**
 * How each final is spelled with no initial in front of it.
 *
 * The i, u and ü groups take a y or w onset as they do in pinyin, but not the
 * same one in the same places: 一 yī is `i` and 有 yǒu is `yu`, which is also
 * where 魚 yú's `yü` loses its diaeresis and collides. Finals that cannot stand
 * alone keep their after-initial spelling.
 */
export const ZERO_INITIAL_SPELLINGS: Record<Final, string> = {
  ...FINAL_SPELLINGS,
  i: "i",
  ia: "ya",
  io: "yo",
  ie: "yeh",
  iao: "yao",
  iou: "yu",
  ian: "yen",
  in: "yin",
  iang: "yang",
  ing: "ying",
  iong: "yung",
  u: "wu",
  ua: "wa",
  uo: "wo",
  uai: "wai",
  uei: "wei",
  uan: "wan",
  uen: "wên",
  uang: "wang",
  ueng: "wêng",
  ü: "yü",
  üe: "yüeh",
  üan: "yüan",
  ün: "yün",
};

/**
 * The initials after which the i final is the empty rhyme written `ih`.
 */
export const RETROFLEX_INITIALS = new Set<Initial>(["zh", "ch", "sh", "r"]);

/**
 * The initials after which it is the empty rhyme written `ŭ`.
 */
export const SIBILANT_INITIALS = new Set<Initial>(["z", "c", "s"]);

/**
 * The initials after which the e final is written `o` rather than `ê`.
 */
export const O_FOR_E_INITIALS = new Set<Initial>(["g", "k", "h"]);

/**
 * The initials after which `uo` loses its u: 作 zuò is `tso`, 若 ruò is `jo`.
 *
 * sh is the exception that has to be listed by its absence — 說 shuō stays
 * `shuo` while 桌 zhuō is `cho` — and it is an exception in the source rather
 * than an error here.
 */
export const O_FOR_UO_INITIALS = new Set<Initial>([
  "d",
  "t",
  "n",
  "l",
  "z",
  "c",
  "s",
  "zh",
  "ch",
  "r",
]);

/**
 * The initials after which `uei` keeps its middle vowel: 貴 guì is `kuei`.
 */
export const UEI_INITIALS = new Set<Initial>(["g", "k"]);
