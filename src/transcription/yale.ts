/**
 * Yale, in both directions.
 *
 * Yale was written for American soldiers in 1943 and spells Mandarin the way
 * English spells itself: pinyin q is `ch`, pinyin x is `sy`, and 知 is `jr`
 * because that is what an unprepared reader would say. So it sits between the
 * two systems already here — a table like Wade-Giles, but with pinyin's tone
 * diacritics rather than raised digits, and with none of Wade-Giles's droppable
 * marks.
 *
 * Three things make it more than a straight substitution:
 *
 * - **The medials are written with y and w**, so the initial and the final can
 *   collide: x is `sy` and -ia is `ya`, and 蝦 xiā is `sya` rather than
 *   `syya`. The same doubling is avoided in `dz` + the empty rhyme `z` → `dz`
 *   and in `r` + `r` → `r`.
 * - **The empty rhyme is a letter of its own**: `r` after the retroflexes and
 *   `z` after the dental sibilants, which is where 知 `jr` and 資 `dz` come
 *   from.
 * - **Pinyin's -o after a labial is really -uo**, and Yale writes what is said:
 *   波 bō is `bwo` while 咯 lo is `lo`. The IPA column of the same source
 *   agrees — see [ipa.ts](ipa.ts) — which is a pleasing confirmation that the
 *   two tables are describing one language rather than each other.
 *
 * Reading it back is a lookup over the inventory, as everything here is. Yale
 * is very nearly injective: see `docs/romanization/` for the count and for the
 * one pair it merges.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  applyToneMark,
  normaliseSuperscript,
  stripToneMarks,
  toneDiacritic,
  toneFromMarks,
} from "../tone/tone-mark.js";
import { type Tone, toneFromNotation } from "../tone/tone.js";
import { indexInventory, readIndexed } from "./spelling-index.js";

/**
 * How each initial is spelled.
 *
 * The aspiration pairs read as English does — pinyin b is `b` and pinyin p is
 * `p` — which is the whole point of the system and the one respect in which it
 * is easier than Wade-Giles. The palatals borrow the retroflex letters, since
 * the two series never contrast, except for x: `sy` keeps 西 `syi` from being
 * read as 詩 `shr`.
 */
const INITIAL_SPELLINGS = new Map<Initial, string>([
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
const FINAL_SPELLINGS: Record<Final, string> = {
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
const ZERO_INITIAL_SPELLINGS = new Map<Final, string>([
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
const LABIAL_INITIALS = new Set<Initial>(["b", "p", "m", "f"]);

/**
 * The letter the empty rhyme is written with after each series.
 *
 * 知 is `jr` and 資 is `dz`: the i of zhi and zi is the syllabic continuation
 * of the initial rather than a vowel, and Yale writes that continuation as a
 * letter. Where the initial already ends in it — `r` and `dz` — it is not
 * written twice, which is why 日 rì is `r` and 字 zì is `dz`.
 */
const EMPTY_RHYME_LETTERS = new Map<Initial, string>([
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
const ERHUA_SUFFIX = "r";

/**
 * How a final is spelled after a given initial.
 */
function finalSpelling(initial: Initial, final: Final): string {
  if (initial === "") {
    return ZERO_INITIAL_SPELLINGS.get(final) ?? FINAL_SPELLINGS[final];
  }
  if (final === "i" && EMPTY_RHYME_LETTERS.has(initial)) {
    return EMPTY_RHYME_LETTERS.get(initial) ?? "";
  }
  if (final === "o" && LABIAL_INITIALS.has(initial)) {
    return "wo";
  }
  return FINAL_SPELLINGS[final];
}

/**
 * Spell a syllable in Yale, without its tone or its 儿化 suffix.
 *
 * The two collapses live here rather than in the tables, because both are the
 * same rule — Yale does not write a letter twice — and both are visible only
 * once the initial and the final are side by side.
 */
function baseSpelling(syllable: Syllable): string {
  const { initial, final } = syllable;
  const written = finalSpelling(initial, final);
  const spelt = INITIAL_SPELLINGS.get(initial) ?? "";
  // sy + ya is sya, and dz + z is dz.
  return spelt.endsWith(written.slice(0, 1))
    ? `${spelt}${written.slice(1)}`
    : `${spelt}${written}`;
}

/**
 * Spell a syllable in Yale without its tone: 西 xī is `syi`.
 */
export function writeYaleSpelling(syllable: Syllable): string {
  return `${baseSpelling(syllable)}${syllable.erhua === true ? ERHUA_SUFFIX : ""}`;
}

/**
 * How a Yale syllable writes its tone.
 *
 * Diacritics are the system's own notation and the same four pinyin uses, which
 * is where pinyin took them from; `numbers` writes a digit on the line instead,
 * and is the only one of the three that can say "neutral" rather than leaving
 * it to be inferred.
 */
export interface YaleOptions {
  readonly tones?: "marks" | "numbers" | "none";
}

/**
 * Put the tone mark on, including on the syllables with no vowel to take it.
 *
 * `applyToneMark` follows the standard's a-then-o-or-e-then-last-vowel rule and
 * gives back what it was handed when nothing can carry a mark, which is exactly
 * the seven empty-rhyme syllables: `jr`, `chr`, `shr`, `r`, `dz`, `tsz` and
 * `sz`. Those take the mark on their last letter, since a syllable with no
 * vowel still has a tone.
 */
function markTone(spelling: string, tone: Tone): string {
  const marked = applyToneMark(spelling, tone);
  return marked === spelling
    ? `${spelling}${toneDiacritic(tone)}`.normalize("NFC")
    : marked;
}

/**
 * Write a syllable in Yale: 就 jiù becomes `jyòu`.
 *
 * The mark goes on the base rather than on the 儿化 suffix, so 花儿 huār is
 * `hwār`. An unwritten tone stays unwritten, as everywhere else in this
 * package; the neutral tone is written unmarked, which is Yale's own convention
 * and pinyin's, and means the two are told apart only by `numbers`.
 */
export function writeYale(
  syllable: Syllable,
  options: YaleOptions = {},
): string {
  const { tones = "marks" } = options;
  const base = baseSpelling(syllable);
  const suffix = syllable.erhua === true ? ERHUA_SUFFIX : "";
  const { tone } = syllable;
  if (tone === undefined || tones === "none") {
    return `${base}${suffix}`;
  }
  return tones === "numbers"
    ? `${base}${suffix}${String(tone)}`
    : `${markTone(base, tone)}${suffix}`;
}

/**
 * Write a word in Yale, one syllable after another.
 *
 * Solid, as Yale's own textbooks write a word — 中國 is `Jūnggwó` — rather than
 * hyphenated as Wade-Giles has it. That leaves the syllable boundary unmarked
 * and so unrecoverable, which is the same gap pinyin fills with the 隔音符号 and
 * which this module does not attempt: reading takes a syllable at a time.
 */
export function writeYaleWord(
  syllables: readonly Syllable[],
  options: YaleOptions = {},
): string {
  return syllables.map((syllable) => writeYale(syllable, options)).join("");
}

/**
 * Every syllable each Yale spelling stands for.
 */
const INDEX = indexInventory((syllable) => baseSpelling(syllable));

/**
 * Take the tone off, however it was written.
 *
 * A trailing digit first, since `jyou4` is unambiguous and cheap to spot; then
 * the diacritics, which is what Yale actually writes. An unmarked syllable has
 * no tone rather than the neutral one, for the reason `readSyllable` gives:
 * nothing was written either way.
 */
function splitTone(text: string): readonly [string, Tone | undefined] {
  const found = /^(.*?)([0-5])$/u.exec(normaliseSuperscript(text));
  const digit = found?.[2];
  if (found !== null && digit !== undefined) {
    return [stripToneMarks(found[1] ?? ""), toneFromNotation(Number(digit))];
  }
  return [stripToneMarks(text), toneFromMarks(text)];
}

/**
 * Read a Yale syllable: `jyòu` becomes 就 jiù.
 *
 * Returns every syllable the spelling stands for, which is one for all but the
 * handful `docs/romanization/` counts. Empty for anything that is not Yale at
 * all.
 */
export function readYale(text: string): readonly Syllable[] {
  const [spelling, tone] = splitTone(
    text.trim().normalize("NFC").toLowerCase(),
  );
  return readIndexed(INDEX, spelling, tone, ERHUA_SUFFIX);
}
