/**
 * How Wade-Giles spells a syllable: the tables, and writing one out.
 *
 * The reading side in `wade-giles.ts` builds its index by asking this module
 * what it would write for every syllable of the inventory, so the dependency
 * runs one way — spelling knows nothing about reading.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import { SUPERSCRIPT_TONES } from "../tone/tone-mark.js";

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
const INITIAL_SPELLINGS = new Map<Initial, string>([
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
const SIBILANT_SPELLINGS = new Map<Initial, string>([
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
const FINAL_SPELLINGS: Record<Final, string> = {
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
const ZERO_INITIAL_SPELLINGS: Record<Final, string> = {
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
const RETROFLEX_INITIALS = new Set<Initial>(["zh", "ch", "sh", "r"]);

/**
 * The initials after which it is the empty rhyme written `ŭ`.
 */
const SIBILANT_INITIALS = new Set<Initial>(["z", "c", "s"]);

/**
 * The initials after which the e final is written `o` rather than `ê`.
 */
const O_FOR_E_INITIALS = new Set<Initial>(["g", "k", "h"]);

/**
 * The initials after which `uo` loses its u: 作 zuò is `tso`, 若 ruò is `jo`.
 *
 * sh is the exception that has to be listed by its absence — 說 shuō stays
 * `shuo` while 桌 zhuō is `cho` — and it is an exception in the source rather
 * than an error here.
 */
const O_FOR_UO_INITIALS = new Set<Initial>([
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
const UEI_INITIALS = new Set<Initial>(["g", "k"]);

/**
 * How an initial is spelled in front of a given final.
 */
function initialSpelling(initial: Initial, final: Final): string {
  const sibilant = final === "i" ? SIBILANT_SPELLINGS.get(initial) : undefined;
  return sibilant ?? INITIAL_SPELLINGS.get(initial) ?? "";
}

/**
 * How a final is spelled after a given initial.
 */
function finalSpelling(initial: Initial, final: Final): string {
  if (initial === "") {
    return ZERO_INITIAL_SPELLINGS[final];
  }
  if (final === "i") {
    if (RETROFLEX_INITIALS.has(initial)) {
      return "ih";
    }
    if (SIBILANT_INITIALS.has(initial)) {
      return "ŭ";
    }
  }
  if (final === "e" && O_FOR_E_INITIALS.has(initial)) {
    return "o";
  }
  if (final === "uo" && O_FOR_UO_INITIALS.has(initial)) {
    return "o";
  }
  if (final === "uei" && UEI_INITIALS.has(initial)) {
    return "uei";
  }
  return FINAL_SPELLINGS[final];
}

/**
 * The 儿化 suffix, which Wade-Giles hangs off the syllable rather than fusing
 * into it.
 *
 * So this is the one place a syllable is written with a hyphen in it: 花儿 huār
 * is `hua¹-'rh`. Two things about that shape are worth stating, because both
 * are decisions:
 *
 * - **The suffix is the reduced `'rh` rather than a full `êrh`.** 兒 as a
 *   syllable of its own is `êrh`, and as a suffix it is written short. This is
 *   the form en.wiktionary's Chinese entries use throughout, and it is what the
 *   fixture in [test/fixtures/wiktionary.ts](../../test/fixtures/wiktionary.ts)
 *   is checked against.
 * - **The tone digit goes on the syllable, in front of the suffix.** The tone
 *   is the base syllable's — 花儿 is a first-tone 花 with a suffix on it — and
 *   Wade-Giles writes the digit after the syllable it belongs to. Writing
 *   `hua-êrh¹` instead, as this module used to, says the 兒 carries a first
 *   tone, which is not what anybody means by it.
 *
 * Pinyin's `r` suffix is the later convention and the two are not
 * interchangeable.
 */
export const ERHUA_SUFFIX = `-${APOSTROPHE}rh`;

/**
 * How a Wade-Giles syllable writes its tone.
 *
 * Wade-Giles writes it as a raised digit after the syllable, which is why
 * `superscript` is the default; `numbers` writes the same digit on the line,
 * which is what a plain-text field or a filename wants.
 */
export interface WadeGilesOptions {
  readonly tones?: "superscript" | "numbers" | "none";
}

/**
 * Spell a syllable in Wade-Giles without its tone.
 */
export function writeWadeGilesSpelling(syllable: Syllable): string {
  const { initial, final } = syllable;
  const suffix = syllable.erhua === true ? ERHUA_SUFFIX : "";
  return `${initialSpelling(initial, final)}${finalSpelling(initial, final)}${suffix}`;
}

/**
 * Write a syllable in Wade-Giles: 就 jiù becomes `chiu⁴`.
 *
 * Total over well-formed syllables, as the bopomofo writer is. An unwritten
 * tone stays unwritten rather than being invented as a first tone, which is
 * what lets the round trip come back exactly.
 *
 * The digit goes in front of the 儿化 suffix rather than after it — 玩儿 wánr
 * is `wan²-'rh` — for the reason {@link ERHUA_SUFFIX} gives.
 */
export function writeWadeGiles(
  syllable: Syllable,
  options: WadeGilesOptions = {},
): string {
  const spelling = writeWadeGilesSpelling(syllable);
  const { tone } = syllable;
  const { tones = "superscript" } = options;
  if (tone === undefined || tones === "none") {
    return spelling;
  }
  const digit =
    tones === "numbers"
      ? String(tone)
      : /* c8 ignore next -- every tone has a raised digit */
        (SUPERSCRIPT_TONES.get(tone) ?? "");
  return spelling.endsWith(ERHUA_SUFFIX)
    ? `${spelling.slice(0, -ERHUA_SUFFIX.length)}${digit}${ERHUA_SUFFIX}`
    : `${spelling}${digit}`;
}

/**
 * Write a word in Wade-Giles, hyphenating between its syllables.
 *
 * The hyphen is Wade's own convention and it is not decoration: `Tse-tung`
 * written solid could be read as two syllables or as three, and the system has
 * no 隔音符号 to fall back on. Pinyin writes the word solid and reaches for an
 * apostrophe only where the boundary is genuinely ambiguous, which is the
 * opposite default.
 */
export function writeWadeGilesWord(
  syllables: readonly Syllable[],
  options: WadeGilesOptions = {},
): string {
  return syllables
    .map((syllable) => writeWadeGiles(syllable, options))
    .join("-");
}
