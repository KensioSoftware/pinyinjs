/**
 * How Yale spells each part of a syllable, as tables.
 *
 * Separated from the rules that read them, so that this file is only ever a
 * statement of what the system writes.
 */
import type { Final, Initial } from "../syllable/phonology.js";

/**
 * How each initial is spelled.
 *
 * The aspiration pairs read as English does — pinyin b is `b` and pinyin p is
 * `p` — which is the whole point of the system and the one respect in which it
 * is easier than Wade-Giles. The palatals borrow the retroflex letters, since
 * the two series never contrast, except for x: `sy` keeps 西 `syi` from being
 * read as 詩 `shr`.
 */
export const INITIAL_SPELLINGS = new Map<Initial, string>([
  ["b", "b"],
  ["p", "p"],
  ["m", "m"],
  ["f", "f"],
  ["d", "d"],
  ["t", "t"],
  ["n", "n"],
  ["l", "l"],
  ["g", "g"],
  ["k", "k"],
  ["h", "h"],
  ["j", "j"],
  ["q", "ch"],
  ["x", "sy"],
  ["zh", "j"],
  ["ch", "ch"],
  ["sh", "sh"],
  ["r", "r"],
  ["z", "dz"],
  ["c", "ts"],
  ["s", "s"],
]);

/**
 * How each final is spelled after an initial.
 *
 * The i and ü groups are written with y and the u group with w, which is why
 * so few of them need a second form with no initial in front: 家 jiā is `jya`
 * and 呀 ya is `ya`, the same final spelled the same way.
 */
export const FINAL_SPELLINGS: Record<Final, string> = {
  a: "a",
  o: "o",
  e: "e",
  ê: "e",
  er: "er",
  ai: "ai",
  ei: "ei",
  ao: "au",
  ou: "ou",
  an: "an",
  en: "en",
  ang: "ang",
  eng: "eng",
  ong: "ung",
  i: "i",
  ia: "ya",
  io: "yo",
  ie: "ye",
  iao: "yau",
  iou: "you",
  ian: "yan",
  in: "in",
  iang: "yang",
  ing: "ing",
  iong: "yung",
  u: "u",
  ua: "wa",
  uo: "wo",
  uai: "wai",
  uei: "wei",
  uan: "wan",
  uen: "wun",
  uang: "wang",
  ueng: "weng",
  ü: "yu",
  üe: "ywe",
  üan: "ywan",
  ün: "yun",
  m: "m",
  n: "n",
  ng: "ng",
};

/**
 * The five finals that are spelled differently with no initial in front of
 * them.
 *
 * Everything else in the i, u and ü groups already carries its y or w, so this
 * is a much shorter list than Wade-Giles needs. 文 wen is the odd one: after an
 * initial the same final is `wun` (敦 dwun), because there the w is the medial
 * rather than the onset.
 */
export const ZERO_INITIAL_SPELLINGS = new Map<Final, string>([
  ["i", "yi"],
  ["in", "yin"],
  ["ing", "ying"],
  ["u", "wu"],
  ["uen", "wen"],
]);

/**
 * The initials after which pinyin's -o final is really -uo, and Yale writes it
 * so: 波 bō is `bwo`, against 咯 lo which is `lo`.
 */
export const LABIAL_INITIALS = new Set<Initial>(["b", "p", "m", "f"]);

/**
 * The letter the empty rhyme is written with after each series.
 *
 * 知 is `jr` and 資 is `dz`: the i of zhi and zi is the syllabic continuation
 * of the initial rather than a vowel, and Yale writes that continuation as a
 * letter. Where the initial already ends in it — `r` and `dz` — it is not
 * written twice, which is why 日 rì is `r` and 字 zì is `dz`.
 */
export const EMPTY_RHYME_LETTERS = new Map<Initial, string>([
  ["zh", "r"],
  ["ch", "r"],
  ["sh", "r"],
  ["r", "r"],
  ["z", "z"],
  ["c", "z"],
  ["s", "z"],
]);

/**
 * The 儿化 suffix, which Yale writes as pinyin does.
 */
export const ERHUA_SUFFIX = "r";
