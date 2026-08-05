/**
 * IPA, in both directions.
 *
 * This is not a romanisation at all — it is a transcription, and it is the one
 * table here that says something about the language rather than about a
 * spelling convention. It is also the most compositional of the four: an
 * initial symbol and a final symbol, with no zero-initial forms whatever,
 * because y and w are spellings and IPA does not spell. 一 yī is simply [i].
 *
 * The transcription is the broad one of Wikipedia's *Help:IPA/Mandarin*, which
 * is what the syllabary this package checks against uses, so the table and its
 * ground truth are the same analysis. Two consequences worth knowing:
 *
 * - **The empty rhyme is [ɨ]** after both the retroflexes and the dental
 *   sibilants, where narrower transcriptions distinguish [ʐ̩] from [z̩].
 * - **-o after a labial is [uo]**: 波 bō is [puo] while 咯 lo is [lɔ]. Yale
 *   makes the same split, from `bwo` against `lo`, which is two systems
 *   agreeing rather than one copying the other.
 *
 * What this deliberately does not model is anything above the syllable: no
 * 三声 sandhi, no reduction of an unstressed syllable, and no fusion for 儿化 —
 * see {@link ERHUA_SUFFIX}. A syllable in, a syllable out.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE, type Tone, toneFromNotation } from "../tone/tone.js";
import { indexInventory, readIndexed } from "./spelling-index.js";

/**
 * The symbol each initial is transcribed with.
 *
 * The aspiration series is where pinyin's letters mislead most: pinyin b is
 * [p], and pinyin p is [pʰ]. Nothing in Mandarin is voiced here, which is what
 * both Wade-Giles and Yale are working around in their own directions.
 */
const INITIAL_SYMBOLS = new Map<Initial, string>([
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
const FINAL_SYMBOLS: Record<Final, string> = {
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
const EMPTY_RHYME_INITIALS = new Set<Initial>([
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
const LABIAL_INITIALS = new Set<Initial>(["b", "p", "m", "f"]);

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
const ERHUA_SUFFIX = "ɚ";

/**
 * The Chao tone letter each tone is written with.
 *
 * The neutral tone has none: it has no contour of its own, taking its pitch
 * from the syllable before it, and the transcription leaves it unwritten. That
 * is bopomofo's problem in reverse — bopomofo cannot say "no tone", and this
 * cannot say "neutral".
 */
const TONE_LETTERS = new Map<Tone, string>([
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
const TONE_NUMBERS = new Map<Tone, string>([
  [1, "55"],
  [2, "35"],
  [3, "214"],
  [4, "51"],
  [NEUTRAL_TONE, ""],
]);

/**
 * How a final is transcribed after a given initial.
 */
function finalSymbols(initial: Initial, final: Final): string {
  if (final === "i" && EMPTY_RHYME_INITIALS.has(initial)) {
    return "ɨ";
  }
  if (final === "o" && LABIAL_INITIALS.has(initial)) {
    return "uo";
  }
  return FINAL_SYMBOLS[final];
}

/**
 * Transcribe a syllable without its tone: 就 jiù becomes `tɕiou`.
 */
export function writeIpaSymbols(syllable: Syllable): string {
  const { initial, final } = syllable;
  const suffix = syllable.erhua === true ? ERHUA_SUFFIX : "";
  return `${INITIAL_SYMBOLS.get(initial) ?? ""}${finalSymbols(initial, final)}${suffix}`;
}

/**
 * Transcribe a syllable in IPA: 就 jiù becomes `tɕiou˥˩`.
 *
 * Without brackets, since whether it is phonemic or phonetic is the caller's
 * claim to make and not this table's.
 */
export function writeIpa(syllable: Syllable, options: IpaOptions = {}): string {
  const symbols = writeIpaSymbols(syllable);
  const { tone } = syllable;
  const { tones = "letters" } = options;
  if (tone === undefined || tones === "none") {
    return symbols;
  }
  const written =
    tones === "numbers" ? TONE_NUMBERS.get(tone) : TONE_LETTERS.get(tone);
  /* c8 ignore next -- every tone is in both tables */
  return `${symbols}${written ?? ""}`;
}

/**
 * Transcribe a word, one syllable after another.
 *
 * Run together, as a transcription of connected speech is written. The tone
 * letters mark where each syllable ends, so nothing is lost by it — except for
 * the neutral tone, which writes nothing and so leaves a boundary unmarked.
 */
export function writeIpaWord(
  syllables: readonly Syllable[],
  options: IpaOptions = {},
): string {
  return syllables.map((syllable) => writeIpa(syllable, options)).join("");
}

/**
 * Every syllable each transcription stands for.
 */
const INDEX = indexInventory((syllable) => writeIpaSymbols(syllable));

/**
 * The tone each written form stands for, letters and pitch numerals alike.
 */
const TONES_BY_WRITTEN = new Map<string, Tone>(
  [...TONE_LETTERS, ...TONE_NUMBERS]
    .filter(([, written]) => written !== "")
    .map(([tone, written]) => [written, tone]),
);

/**
 * Take the tone off the end, however it was written.
 *
 * Tone letters, a pitch numeral, or the plain 1-to-5 digit this package uses
 * everywhere else — the last is not IPA at all, but it costs nothing to accept
 * and it is what somebody typing at a terminal will reach for.
 */
function splitTone(text: string): readonly [string, Tone | undefined] {
  const found = /^(.*?)([˥˦˧˨˩]+|214|55|35|51|[0-5])$/u.exec(text);
  const written = found?.[2];
  if (written === undefined) {
    return [text, undefined];
  }
  const tone =
    TONES_BY_WRITTEN.get(written) ?? toneFromNotation(Number(written));
  return tone === undefined ? [text, undefined] : [found?.[1] ?? "", tone];
}

/**
 * Read an IPA transcription back: `tɕiou˥˩` becomes 就 jiù.
 *
 * An index over the inventory, as everything here is, so a transcription of
 * something Mandarin does not have reads as nothing rather than as a syllable
 * nobody says. Returns an array for the same reason the other readers do,
 * though IPA has less to be ambiguous about than any of them.
 */
export function readIpa(text: string): readonly Syllable[] {
  const [symbols, tone] = splitTone(text.trim().normalize("NFC"));
  return readIndexed(INDEX, symbols, tone, ERHUA_SUFFIX);
}
