/**
 * How Gwoyeu Romatzyh spells each part of a syllable, as tables.
 *
 * Separated from the spelling rules that read them, so that this file is only
 * ever a statement of what the system writes.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { ContourTone } from "./gwoyeu-tonal-forms.js";

/**
 * How each initial is spelled.
 *
 * GR uses the voiced letters for the unaspirated series, as pinyin does, so
 * this half of the table is nearly pinyin's own. The three that differ are the
 * alveolar affricates — `tz` and `ts` for pinyin z and c — and the palatals,
 * which GR does not distinguish from the retroflexes at all: `j`, `ch` and `sh`
 * stand for both series, and it is the following `i` that says which. That is
 * why pinyin zhu, ju and jiu come out as `ju`, `jiu` and `jiou`.
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
  ["x", "sh"],
  ["zh", "j"],
  ["ch", "ch"],
  ["sh", "sh"],
  ["r", "r"],
  ["z", "tz"],
  ["c", "ts"],
  ["s", "s"],
]);

/**
 * How each final is spelled in the basic form.
 *
 * Written out in full, as the finals table of *Spelling in Gwoyeu Romatzyh*
 * has them: `iou` and `uei` rather than pinyin's contracted iu and ui, `iu` for
 * ü, `au` for ao, and `el` for er — the `-r` being spoken for by the second
 * tone.
 */
export const FINAL_SPELLINGS: Record<Final, string> = {
  a: "a",
  o: "o",
  e: "e",
  ê: "è",
  er: "el",
  ai: "ai",
  ei: "ei",
  ao: "au",
  ou: "ou",
  an: "an",
  en: "en",
  ang: "ang",
  eng: "eng",
  ong: "ong",
  i: "i",
  ia: "ia",
  io: "io",
  ie: "ie",
  iao: "iau",
  iou: "iou",
  ian: "ian",
  in: "in",
  iang: "iang",
  ing: "ing",
  iong: "iong",
  u: "u",
  ua: "ua",
  uo: "uo",
  uai: "uai",
  uei: "uei",
  uan: "uan",
  uen: "uen",
  uang: "uang",
  ueng: "ueng",
  ü: "iu",
  üe: "iue",
  üan: "iuan",
  ün: "iun",
  m: "m",
  n: "n",
  ng: "ng",
};

/**
 * The initials after which the empty rhyme is written `-y`.
 *
 * 詩 shī is `shy` and 斯 sī is `sy`, which is the same observation Yale makes
 * with its `r` and `z`: the i of shi is a continuation of the initial rather
 * than a vowel. GR spends a letter of its own on it, and that letter behaves
 * as a vowel for every tonal rule below — `shy`, `shyr`, `shyy`, `shyh`.
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
 * The letter 儿化 is written with.
 *
 * `-l` rather than `-r`, the second tone having spoken for the r.
 */
export const ERHUA_SUFFIX = "l";

/**
 * The rime each final takes once it is rhotacised, before the `-l`.
 *
 * **GR transcribes 儿化 as it is said rather than as it is spelled**, which is
 * what makes this a table rather than a suffix. 玩儿 wánr is `wal` and not
 * `wanl`, because the -n is not there to hear; 事儿 shìr is `shell`, the empty
 * rhyme having gone entirely; 今儿 jīnr and 鸡儿 jīr are both `jiel`, which is
 * the collapse *Spelling in Gwoyeu Romatzyh* names.
 *
 * The rules it gives, applied here as stated:
 *
 * - `-y`, the empty rhyme, becomes `e`
 * - `i` and `in` become `ie`; `iu` (ü) and `iun` (ün) become `iue`
 * - `ing` becomes `ieng`
 * - every other `-n` disappears without trace
 * - the asyllabic `-i` of `ai`, `uai`, `iai` and `uei` disappears
 *
 * So `al` covers a, an and ai; `el` covers en, ei and the empty rhyme; `uel`
 * covers uen and uei. The tonal rules then apply to the result, which is where
 * `dial` becomes 一點兒's `deal`.
 */
export const RHOTACISED_RIMES: Record<Final, string> = {
  a: "a",
  o: "o",
  e: "e",
  ê: "è",
  // 兒 is already the rhotic syllable; nothing else attaches to it.
  er: "el",
  ai: "a",
  ei: "e",
  ao: "au",
  ou: "ou",
  an: "a",
  en: "e",
  ang: "ang",
  eng: "eng",
  ong: "ong",
  i: "ie",
  ia: "ia",
  io: "io",
  ie: "ie",
  iao: "iau",
  iou: "iou",
  ian: "ia",
  in: "ie",
  iang: "iang",
  ing: "ieng",
  iong: "iong",
  u: "u",
  ua: "ua",
  uo: "uo",
  uai: "ua",
  uei: "ue",
  uan: "ua",
  uen: "ue",
  uang: "uang",
  ueng: "ueng",
  ü: "iue",
  üe: "iue",
  üan: "iua",
  ün: "iue",
  // The syllabic nasals, which GR does not spell at all: see writeGwoyeu.
  m: "m",
  n: "n",
  ng: "ng",
};

/**
 * The rhotacised rime of the empty rhyme, which `-y` becomes.
 */
export const RHOTACISED_EMPTY_RHYME = "e";

/**
 * The last tone in which a final writes an apostrophe before the `-l`.
 *
 * Three finals need one, because the fusion above has made them collide with a
 * rime that was already there. `e` rhotacised is `e'l`, `er'l` and `ee'l`, to
 * keep it apart from the `el`, `erl` and `eel` that en, ei and the empty rhyme
 * give; `ie` and `iue` take one in the first two tones only, since in the third
 * and fourth they merge with i and iu anyway. The fourth tone of `e` needs no
 * apostrophe either, `ehl` being distinct from `ell` on its own.
 */
export const APOSTROPHE_TONES = new Map<Final, ContourTone>([
  ["e", 3],
  ["ie", 2],
  ["üe", 2],
]);

/**
 * The apostrophe those three finals take.
 */
export const APOSTROPHE = "'";

/**
 * The dot written in front of a neutral-tone syllable.
 *
 * A full stop, which is how GR writes it in print. Chao's own practice is to
 * use it on a word's first appearance rather than throughout; this module
 * always writes it, because it is the only thing in GR that can say "neutral"
 * rather than leaving it to be inferred.
 */
