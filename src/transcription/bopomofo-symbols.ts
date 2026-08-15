/**
 * The bopomofo symbols, and writing a syllable in them.
 *
 * `bopomofo.ts` reads by inverting these same tables, so the dependency runs
 * one way — nothing here knows how a string is parsed back.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";

/**
 * The medial (介音) of a syllable, or the empty string for one with none.
 */
export type Medial = "" | "i" | "u" | "ü";

/**
 * The rhyme a syllable ends on, or the empty string where the medial is the
 * whole of the final: 於 yú is ㄩ and nothing more.
 */
export type Rhyme =
  | ""
  | "a"
  | "o"
  | "e"
  | "ê"
  | "ai"
  | "ei"
  | "ao"
  | "ou"
  | "an"
  | "en"
  | "ang"
  | "eng"
  | "er"
  | "m"
  | "n"
  | "ng";

/**
 * The symbol each initial is written with.
 *
 * A syllable with no initial has no entry and writes nothing, which is what the
 * empty string stands for throughout this file.
 */
export const INITIAL_SYMBOLS = new Map<Initial, string>([
  ["b", "ㄅ"],
  ["p", "ㄆ"],
  ["m", "ㄇ"],
  ["f", "ㄈ"],
  ["d", "ㄉ"],
  ["t", "ㄊ"],
  ["n", "ㄋ"],
  ["l", "ㄌ"],
  ["g", "ㄍ"],
  ["k", "ㄎ"],
  ["h", "ㄏ"],
  ["j", "ㄐ"],
  ["q", "ㄑ"],
  ["x", "ㄒ"],
  ["zh", "ㄓ"],
  ["ch", "ㄔ"],
  ["sh", "ㄕ"],
  ["r", "ㄖ"],
  ["z", "ㄗ"],
  ["c", "ㄘ"],
  ["s", "ㄙ"],
]);

/**
 * The symbol each medial is written with.
 */
export const MEDIAL_SYMBOLS = new Map<Medial, string>([
  ["i", "ㄧ"],
  ["u", "ㄨ"],
  ["ü", "ㄩ"],
]);

/**
 * The symbol each rhyme is written with.
 *
 * ㄦ is here as a rhyme of its own and also serves as the 儿化 suffix, which is
 * what bopomofo does with it: 歌儿 gēr is ㄍㄜㄦ.
 *
 * The three syllabic nasals at the end are the marginal case. ㄇ and ㄋ are
 * initial letters doing rhyme duty, as bopomofo writes 呣 and 嗯; ㄫ is the
 * obsolete letter for a syllabic ng, used here rather than ㄥ so that 嗯 ǹg and
 * the rare 鞥 ēng do not come out identical.
 */
export const RHYME_SYMBOLS = new Map<Rhyme, string>([
  ["a", "ㄚ"],
  ["o", "ㄛ"],
  ["e", "ㄜ"],
  ["ê", "ㄝ"],
  ["ai", "ㄞ"],
  ["ei", "ㄟ"],
  ["ao", "ㄠ"],
  ["ou", "ㄡ"],
  ["an", "ㄢ"],
  ["en", "ㄣ"],
  ["ang", "ㄤ"],
  ["eng", "ㄥ"],
  ["er", "ㄦ"],
  ["m", "ㄇ"],
  ["n", "ㄋ"],
  ["ng", "ㄫ"],
]);

/**
 * How each final divides into a medial and a rhyme.
 *
 * Written out rather than split off the front of the spelling, because the
 * division is phonological and the spelling only mostly follows it: `in` is
 * ㄧㄣ, an i medial over the ㄣ rhyme rather than over an n of its own, and
 * `iong` is ㄩㄥ — a ü medial despite the i in the spelling, which is why
 * 兄 xiōng and 军 jūn share a medial.
 */
export const FINAL_PARTS: Record<Final, readonly [Medial, Rhyme]> = {
  a: ["", "a"],
  o: ["", "o"],
  e: ["", "e"],
  ê: ["", "ê"],
  er: ["", "er"],
  ai: ["", "ai"],
  ei: ["", "ei"],
  ao: ["", "ao"],
  ou: ["", "ou"],
  an: ["", "an"],
  en: ["", "en"],
  ang: ["", "ang"],
  eng: ["", "eng"],
  ong: ["u", "eng"],
  i: ["i", ""],
  ia: ["i", "a"],
  io: ["i", "o"],
  ie: ["i", "ê"],
  iao: ["i", "ao"],
  iou: ["i", "ou"],
  ian: ["i", "an"],
  in: ["i", "en"],
  iang: ["i", "ang"],
  ing: ["i", "eng"],
  iong: ["ü", "eng"],
  u: ["u", ""],
  ua: ["u", "a"],
  uo: ["u", "o"],
  uai: ["u", "ai"],
  uei: ["u", "ei"],
  uan: ["u", "an"],
  uen: ["u", "en"],
  uang: ["u", "ang"],
  ueng: ["u", "eng"],
  ü: ["ü", ""],
  üe: ["ü", "ê"],
  üan: ["ü", "an"],
  ün: ["ü", "en"],
  m: ["", "m"],
  n: ["", "n"],
  ng: ["", "ng"],
};

/**
 * The initials whose syllable with an i final is written as the initial alone:
 * 知 is ㄓ, not ㄓㄧ.
 *
 * The i of zhi, chi, shi, ri, zi, ci and si is not the i of ji at all — it is
 * the syllabic continuation of the initial (空韻), and bopomofo simply does not
 * write it. This is the one place the correspondence is not one symbol per
 * part.
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
 * The symbol 儿化 is written with.
 *
 * ㄦ, the same letter as the rhyme of 兒 ér itself, which is why reading it
 * takes the position into account: see {@link parseSymbols}.
 */
export const ERHUA_SYMBOL = "ㄦ";

/**
 * The mark each tone takes.
 *
 * The neutral tone's dot goes *before* the syllable and the other four go
 * after — but **before a 儿化 ㄦ rather than after it**: 哪儿 nǎr is ㄋㄚˇㄦ and
 * 玩儿 wánr is ㄨㄢˊㄦ. The mark belongs to the syllable's nucleus, and the
 * suffix is not part of what it marks. Wikipedia's *Bopomofo*, citing 教育部's
 * 國語注音符號手冊, says so outright, and it is what 教育部's dictionaries and
 * Wiktionary both write.
 */
export const TONE_MARKS = new Map<Tone, string>([
  [1, "ˉ"],
  [2, "ˊ"],
  [3, "ˇ"],
  [4, "ˋ"],
  [NEUTRAL_TONE, "˙"],
]);

/**
 * The tone each mark stands for, including the shapes a keyboard produces.
 *
 * Tolerant input and standard output, as the rest of the package has: `´` and
 * `` ` `` are the ASCII neighbours of ˊ and ˋ, and are what text that was typed
 * rather than composed tends to carry.
 */
export const TONES_BY_MARK = new Map<string, Tone>([
  ["ˉ", 1],
  ["¯", 1],
  ["ˊ", 2],
  ["´", 2],
  ["ˇ", 3],
  ["ˋ", 4],
  ["`", 4],
  ["˙", NEUTRAL_TONE],
  ["·", NEUTRAL_TONE],
]);

/**
 * How the first tone is written.
 *
 * Standard bopomofo leaves it unmarked, which is why `none` is the default. The
 * cost is that a syllable whose tone was never written comes back as a first
 * tone, since bopomofo has no way to say "no tone at all"; `mark` writes ˉ and
 * keeps the two apart.
 */
export interface BopomofoOptions {
  readonly firstTone?: "mark" | "none";
}

/**
 * Write a syllable in bopomofo: 就 jiù becomes ㄐㄧㄡˋ.
 *
 * Total over well-formed syllables — every initial and every final has a
 * symbol — so anything the syllable parser accepts can be written, including
 * the syllables no dictionary uses.
 */
export function writeBopomofo(
  syllable: Syllable,
  options: BopomofoOptions = {},
): string {
  const { initial, final, tone } = syllable;
  const [medial, rhyme] = FINAL_PARTS[final];
  const isEmptyRhyme = final === "i" && EMPTY_RHYME_INITIALS.has(initial);

  const written = [
    INITIAL_SYMBOLS.get(initial) ?? "",
    isEmptyRhyme ? "" : (MEDIAL_SYMBOLS.get(medial) ?? ""),
    isEmptyRhyme ? "" : (RHYME_SYMBOLS.get(rhyme) ?? ""),
  ].join("");
  const suffix = syllable.erhua === true ? ERHUA_SYMBOL : "";

  const mark = tone === undefined ? undefined : TONE_MARKS.get(tone);
  if (mark === undefined || (tone === 1 && options.firstTone !== "mark")) {
    return `${written}${suffix}`;
  }
  return tone === NEUTRAL_TONE
    ? `${mark}${written}${suffix}`
    : `${written}${mark}${suffix}`;
}

/**
 * Write a word in bopomofo, one syllable after another.
 *
 * Separated by spaces, as 教育部's dictionaries write them. A syllable boundary
 * is findable without the space — an initial symbol can only start one — but a
 * long unbroken run of symbols is hard to read, and the space costs nothing.
 */
export function writeBopomofoWord(
  syllables: readonly Syllable[],
  options: BopomofoOptions = {},
): string {
  return syllables
    .map((syllable) => writeBopomofo(syllable, options))
    .join(" ");
}
