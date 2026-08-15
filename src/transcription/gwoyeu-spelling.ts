/**
 * How Gwoyeu Romatzyh spells a syllable, once the tonal rules have run.
 *
 * The tables and the write side. `gwoyeu.ts` reads by building an index from
 * what this writes for every syllable of the inventory in every tone, so the
 * dependency runs one way.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  type ContourTone,
  fourthTone,
  tonalForm,
  zeroInitial,
} from "./gwoyeu-tonal-forms.js";

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
const FINAL_SPELLINGS: Record<Final, string> = {
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
 * The letter 儿化 is written with.
 *
 * `-l` rather than `-r`, the second tone having spoken for the r.
 */
const ERHUA_SUFFIX = "l";

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
const RHOTACISED_RIMES: Record<Final, string> = {
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
const RHOTACISED_EMPTY_RHYME = "e";

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
const APOSTROPHE_TONES = new Map<Final, ContourTone>([
  ["e", 3],
  ["ie", 2],
  ["üe", 2],
]);

/**
 * The apostrophe those three finals take.
 */
const APOSTROPHE = "'";

/**
 * The dot written in front of a neutral-tone syllable.
 *
 * A full stop, which is how GR writes it in print. Chao's own practice is to
 * use it on a word's first appearance rather than throughout; this module
 * always writes it, because it is the only thing in GR that can say "neutral"
 * rather than leaving it to be inferred.
 */
export const NEUTRAL_MARK = ".";

/**
 * How a final is spelled after a given initial.
 */
function rimeSpelling(initial: Initial, final: Final): string {
  return final === "i" && EMPTY_RHYME_INITIALS.has(initial)
    ? "y"
    : FINAL_SPELLINGS[final];
}

/**
 * The basic form of a syllable: the spelling every tonal rule starts from.
 */
function basicForm(syllable: Syllable): string {
  const { initial, final } = syllable;
  const spelt = INITIAL_SPELLINGS.get(initial) ?? "";
  return `${spelt}${rimeSpelling(initial, final)}`;
}

/**
 * Spell a syllable in a given tone.
 */
export function toneForm(syllable: Syllable, tone: ContourTone): string {
  return tonalForm(basicForm(syllable), syllable.initial, tone);
}

/**
 * The basic rhotacised form of a syllable: the spelling before the `-l`.
 */
function rhotacisedForm(syllable: Syllable): string {
  const { initial, final } = syllable;
  const rime =
    final === "i" && EMPTY_RHYME_INITIALS.has(initial)
      ? RHOTACISED_EMPTY_RHYME
      : RHOTACISED_RIMES[final];
  return `${INITIAL_SPELLINGS.get(initial) ?? ""}${rime}`;
}

/**
 * Whether a rhotacised rime spells its fourth tone rather than doubling the l.
 *
 * The fourth tone of a rhotacised syllable doubles the `-l` — `nal` becomes
 * `nall` — except where the rime has a fourth tone of its own to spell, and
 * then it spells that and adds the l on the end: `aul` becomes `awl` and `angl`
 * becomes `anql`. *Spelling in Gwoyeu Romatzyh* lists the exceptions as
 * `awl, owl, anql, enql, onql` and `ehl`, which is every rime ending in a
 * diphthong's -u or in -ng, plus the `e` that takes the apostrophe.
 */
function isOwnFourthTone(final: Final, rime: string): boolean {
  return final === "e" || /(?:[aeiou]u|ng)$/u.test(rime);
}

/**
 * Spell a rhotacised syllable in a given tone.
 */
export function rhotacisedTone(syllable: Syllable, tone: ContourTone): string {
  const { initial, final } = syllable;
  const basic = rhotacisedForm(syllable);
  if (tone === 4) {
    const spelt = isOwnFourthTone(final, basic)
      ? `${fourthTone(basic)}${ERHUA_SUFFIX}`
      : `${basic}${ERHUA_SUFFIX}${ERHUA_SUFFIX}`;
    return initial === "" ? zeroInitial(spelt, basic) : spelt;
  }
  const apostrophe =
    tone <= (APOSTROPHE_TONES.get(final) ?? 0) ? APOSTROPHE : "";
  return `${tonalForm(basic, initial, tone)}${apostrophe}${ERHUA_SUFFIX}`;
}

/**
 * Spell a syllable in a given tone, rhotacised or not.
 */
function spelling(syllable: Syllable, tone: ContourTone): string {
  return syllable.erhua === true
    ? rhotacisedTone(syllable, tone)
    : toneForm(syllable, tone);
}

/**
 * The basic form of a syllable, rhotacised or not.
 *
 * The spelling before any tonal rule has touched it, which is the first tone
 * for every initial but the sonorants and the second tone for those. It is
 * what a neutral syllable with no original tone is written as.
 */
function basicSpelling(syllable: Syllable): string {
  if (syllable.erhua !== true) {
    return basicForm(syllable);
  }
  const apostrophe = APOSTROPHE_TONES.has(syllable.final) ? APOSTROPHE : "";
  return `${rhotacisedForm(syllable)}${apostrophe}${ERHUA_SUFFIX}`;
}

/**
 * Write a syllable in Gwoyeu Romatzyh: 就 jiù becomes `jiow`.
 *
 * An unwritten tone is written as the first-tone form, because GR has no other
 * form to write — which means it reads back as a first tone, exactly as
 * bopomofo's unmarked syllable does.
 *
 * The neutral tone takes the dot in front, and behind it goes the syllable's
 * original tonal spelling where {@link Syllable.originalTone} says what that
 * was: 没有 méiyou is `mei.yeou`. Where it does not, the basic form goes there
 * instead — which is what GR itself writes for a syllable that is neutral in
 * its own right, 什么 shénme being `shern.me`. The basic form is not the first
 * tone for a sonorant initial, and writing `.mhe` would say the 么 was one.
 */
export function writeGwoyeu(syllable: Syllable): string {
  const { tone, originalTone } = syllable;
  if (tone === NEUTRAL_TONE) {
    const spelt =
      originalTone === undefined || originalTone === NEUTRAL_TONE
        ? basicSpelling(syllable)
        : spelling(syllable, originalTone);
    return `${NEUTRAL_MARK}${spelt}`;
  }
  return spelling(syllable, tone ?? 1);
}

/**
 * Write a word in Gwoyeu Romatzyh, one syllable after another.
 *
 * Solid, as GR writes a word: 北京 is `Beeijing`, which is the convention
 * pinyin inherited. GR uses an apostrophe where the join is ambiguous — its own
 * name for pinyin, `Pin'in`, is the standard example — and that is not written
 * here, for the same reason `readGwoyeu` takes one syllable at a time: knowing
 * where the boundary is ambiguous means being able to split the word, and
 * nothing here splits a GR word.
 */
export function writeGwoyeuWord(syllables: readonly Syllable[]): string {
  return syllables.map((syllable) => writeGwoyeu(syllable)).join("");
}
