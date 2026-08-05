/**
 * Gwoyeu Romatzyh (國語羅馬字), in both directions.
 *
 * GR is the odd one of the five. Every other system here writes a syllable and
 * then marks its tone — a diacritic, a raised digit, a tone letter — so the
 * spelling is one mapping over the inventory and the tone rides on top of it.
 * GR spells the tone *into* the syllable: 山 shān is `shan`, 陝 shǎn is `shaan`,
 * 善 shàn is `shann`. So it is four mappings rather than one, related by the
 * tonal rules below, and reading it back is an index keyed per tone.
 *
 * The rules come from Wikipedia's *Spelling in Gwoyeu Romatzyh*, which states
 * them as a rule of thumb per tone plus a handful of clauses. They are
 * implemented here as stated, with one amendment recorded in
 * {@link zeroInitial}, and the whole of it is scored against a different page's
 * four GR columns in [syllabary.test.ts](syllabary.test.ts).
 *
 * Three things follow from the tone being in the spelling:
 *
 * - **There is no toneless form.** The basic form *is* the first tone, so a
 *   syllable whose tone was never written cannot be told from one written in
 *   the first tone. That is bopomofo's shortfall exactly, arrived at from the
 *   other direction — see `docs/romanization/`.
 * - **The neutral tone is a dot in front**, and the syllable behind it keeps
 *   its original tonal spelling: 没有 méiyou is `mei.yeou`, with 有 yǒu's third
 *   tone still spelled. That is what {@link Syllable.originalTone} is for. A
 *   syllable that is neutral in its own right has no original tone, and takes
 *   the basic form: 什么 shénme is `shern.me`.
 * - **儿化 is a fusion rather than a suffix**, and it is spelled out here rime
 *   by rime as Chao gives it. See {@link RHOTACISED_RIMES}.
 */
import {
  DICTIONARY_SYLLABLES,
  narrowToAttested,
} from "../syllable/inventory.js";
import type { Final, Initial } from "../syllable/phonology.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";

/**
 * A tone that GR spells, which is the four contour tones.
 *
 * The neutral tone is the dot and has no spelling of its own, and an unwritten
 * tone has nothing to write.
 */
type ContourTone = 1 | 2 | 3 | 4;

/**
 * The four tones, for building the index.
 */
const CONTOUR_TONES: readonly ContourTone[] = [1, 2, 3, 4];

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
 * The sonorant initials, which swap what the first two tones do.
 *
 * A syllable beginning l-, m-, n- or r- takes an `-h-` as its second letter in
 * the first tone and is left alone in the second: 媽 mā is `mha` and 麻 má is
 * `ma`. The reason is frequency rather than phonology — these initials carry
 * far more second tones than first ones — and it is the one place where the
 * basic form is not the first tone.
 */
const SONORANT_INITIALS = new Set<Initial>(["l", "m", "n", "r"]);

/**
 * The letters that count as a vowel for the tonal rules.
 *
 * `y` is the empty rhyme and `è` is pinyin's ê; both are the whole of the rime
 * they appear in, so both take the doubling and the `-r` exactly as a vowel
 * does.
 */
const VOWELS = "aeiouyè";

/**
 * The vowels a tone mark can sit on in pinyin, in the order the rule tries
 * them, which is what "the main vowel" means for the third tone's doubling.
 */
const MAIN_VOWELS = ["a", "o", "e"] as const;

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
const NEUTRAL_MARK = ".";

/**
 * Whether a letter is one the tonal rules treat as a vowel.
 *
 * Spelled out rather than written `VOWELS.includes(letter)` because
 * `"aeiouyè".includes("")` is true, and the letter before the first one of a
 * spelling is exactly that: the empty string. A rule asking "is the letter
 * before this one a vowel" would silently say yes at the start of every
 * syllable.
 */
function isVowel(letter: string | undefined): boolean {
  return letter !== undefined && letter !== "" && VOWELS.includes(letter);
}

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
 * Where the rime's vowels start and end.
 *
 * The five syllables with no vowel letter at all — the syllabic nasals 呣, 唔,
 * 嗯 and their aspirated pair — fall back to the last letter, so that the rules
 * asking for "the vowel" have something to work on. GR has no attested
 * spelling for any of them; see `docs/romanization/`.
 */
function vowelSpan(form: string): readonly [number, number] {
  let start = 0;
  while (start < form.length && !isVowel(form[start])) {
    start += 1;
  }
  if (start === form.length) {
    return [form.length - 1, form.length - 1];
  }
  let end = start;
  while (isVowel(form[end + 1])) {
    end += 1;
  }
  return [start, end];
}

/**
 * Tone 1: the basic form, with `-h-` inserted after a sonorant initial.
 */
function firstTone(form: string, initial: Initial): string {
  return SONORANT_INITIALS.has(initial)
    ? `${form.slice(0, 1)}h${form.slice(1)}`
    : form;
}

/**
 * The i or u a glide can be written on, turned into y or w.
 *
 * The rule is `NiV → NyV` and `NuV → NwV`, where N is a non-vowel or nothing at
 * all: the i or u has to be the medial rather than part of a diphthong, which
 * is what the "not preceded by a vowel" test says. The `+ -i if final` clause
 * covers the rimes that are nothing but the medial — `i` becomes `yi` and not
 * a bare `y`.
 */
function glided(form: string): string | undefined {
  for (const [letter, glide] of [
    ["i", "y"],
    ["u", "w"],
  ] as const) {
    const at = form.indexOf(letter);
    if (at !== -1 && !isVowel(form[at - 1])) {
      const rest = form.slice(at + 1);
      return `${form.slice(0, at)}${glide}${rest === "" ? letter : rest}`;
    }
  }
  return undefined;
}

/**
 * Tone 2: i/u to y/w, or an `-r` after the vowels.
 */
function secondTone(form: string, initial: Initial): string {
  if (SONORANT_INITIALS.has(initial)) {
    return form;
  }
  const glide = glided(form);
  if (glide !== undefined) {
    return glide;
  }
  const [, end] = vowelSpan(form);
  return `${form.slice(0, end + 1)}r${form.slice(end + 1)}`;
}

/**
 * The i or u a third tone can be swapped for e or o.
 *
 * `Vi`/`iV` becomes `Ve`/`eV` and `Vu`/`uV` becomes `Vo`/`oV`, so the letter
 * has to sit beside a vowel; where both an i and a u are available it is
 * whichever comes *first* that changes, which is why 交 jiǎo is `jeau` and not
 * `jiao`. The swap is abandoned where it would produce `ee` or `oo`, both of
 * which are the doubling below and would collide with it.
 */
function swapped(form: string): string | undefined {
  const found = (
    [
      ["i", "e"],
      ["u", "o"],
    ] as const
  )
    .map(([letter, swap]) => [form.indexOf(letter), swap] as const)
    .filter(([at]) => at !== -1)
    .toSorted((one, other) => one[0] - other[0])[0];
  if (found === undefined) {
    return undefined;
  }
  const [at, swap] = found;
  const before = form[at - 1];
  const after = form[at + 1];
  const isBeside = isVowel(before) || isVowel(after);
  const isDoubles = before === swap || after === swap;
  return isBeside && !isDoubles
    ? `${form.slice(0, at)}${swap}${form.slice(at + 1)}`
    : undefined;
}

/**
 * Tone 3, where the swap does not apply: double the main vowel.
 *
 * The main vowel is the one a pinyin tone mark would sit on — a, then o or e,
 * then the last vowel there is — so 請 qǐng is `chiing` and 給 gěi is `geei`.
 */
function doubled(form: string): string {
  const [start, end] = vowelSpan(form);
  const rime = form.slice(start, end + 1);
  const main = MAIN_VOWELS.map((vowel) => rime.indexOf(vowel)).find(
    (at) => at !== -1,
  );
  const at = start + (main ?? rime.length - 1);
  return `${form.slice(0, at + 1)}${form.slice(at, at + 1)}${form.slice(at + 1)}`;
}

/**
 * Tone 3: i/u to e/o beside a vowel, or the main vowel doubled.
 */
function thirdTone(form: string): string {
  return swapped(form) ?? doubled(form);
}

/**
 * Tone 4: change or double the last letter, or add `-h`.
 *
 * The `⇏iw` clause is why 去 qù is `chiuh` and not `chiw`: the u of `iu` is the
 * ü rather than the second half of a diphthong, and turning it into a w would
 * say the wrong thing about the vowel.
 */
function fourthTone(form: string): string {
  const last = form.slice(-1);
  const before = form.slice(-2, -1);
  if (last === "i" && isVowel(before)) {
    return `${form.slice(0, -1)}y`;
  }
  if (last === "u" && isVowel(before) && before !== "i") {
    return `${form.slice(0, -1)}w`;
  }
  if (form.endsWith("ng")) {
    return `${form.slice(0, -2)}nq`;
  }
  if (last === "n" || last === "l") {
    return `${form}${last}`;
  }
  return `${form}h`;
}

/**
 * Put the y- or w- on a syllable that has no initial, in tones 3 and 4.
 *
 * **This is the one place where the published rules needed amending, and the
 * amendment is a correction of one word.** They say that a basic form starting
 * i- or u- has that letter *replaced* by y- or w- (tone 4), or changed to e- or
 * o- with a y- or w- added (tone 3). Applied literally that deletes a vowel the
 * attested spellings keep: 一 yī's basic form is `i`, and tone 4 comes out `yh`
 * where the source has `yih`. Nine cells of the syllabary fail that way, all of
 * them a rime that is bare or closed by a consonant — `yii`, `yih`, `wuu`,
 * `wuh`, `yiin`, `yinn`, `yiing`, `yinq`, `yuh`.
 *
 * The rime table of *Spelling in Gwoyeu Romatzyh* says what actually happens,
 * and it is one rule rather than two: **the letter replaced is a medial**, so
 * it goes only when a different vowel follows it. `iuh` has a u after the i and
 * becomes `yuh`; `ih` has an h and becomes `yih`; `ii` has the same vowel
 * doubled, which is not a following vowel at all, and becomes `yii`. Tone 3
 * needs no separate clause once that is said, because its own swap has already
 * eaten the medial wherever there was one.
 */
function zeroInitial(form: string, basic: string): string {
  const onset = basic.slice(0, 1);
  if (onset !== "i" && onset !== "u") {
    return form;
  }
  const glide = onset === "i" ? "y" : "w";
  const next = form[1];
  const isMedial =
    form.slice(0, 1) === onset && isVowel(next) && next !== onset;
  return `${glide}${isMedial ? form.slice(1) : form}`;
}

/**
 * Apply the tonal rules to a basic form, which is the whole of them.
 */
function tonalForm(basic: string, initial: Initial, tone: ContourTone): string {
  if (tone === 1) {
    return firstTone(basic, initial);
  }
  if (tone === 2) {
    return secondTone(basic, initial);
  }
  const changed = tone === 3 ? thirdTone(basic) : fourthTone(basic);
  return initial === "" ? zeroInitial(changed, basic) : changed;
}

/**
 * Spell a syllable in a given tone.
 */
function toneForm(syllable: Syllable, tone: ContourTone): string {
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
function rhotacisedTone(syllable: Syllable, tone: ContourTone): string {
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

/**
 * Every syllable each spelling stands for, keyed per tone.
 *
 * The other readers here index the inventory once and read the tone off the
 * marks; GR has no marks, so the index is built four times over and each entry
 * carries the tone its spelling means. That is the whole practical difference
 * between reading GR and reading the rest.
 */
function indexTonalForms(): ReadonlyMap<string, readonly Syllable[]> {
  const index = new Map<string, Syllable[]>();
  const add = (key: string, syllable: Syllable): void => {
    const found = index.get(key);
    if (found === undefined) {
      index.set(key, [syllable]);
    } else {
      found.push(syllable);
    }
  };
  for (const pinyin of DICTIONARY_SYLLABLES) {
    const syllable = readSyllable(pinyin);
    /* c8 ignore next 3 -- inventory.test.ts holds the parser to the inventory */
    if (syllable === undefined) {
      continue;
    }
    for (const tone of CONTOUR_TONES) {
      add(toneForm(syllable, tone), { ...syllable, tone });
      const rhotacised = { ...syllable, tone, erhua: true };
      add(rhotacisedTone(rhotacised, tone), rhotacised);
    }
  }
  return index;
}

const INDEX = indexTonalForms();

/**
 * Look a spelling up.
 *
 * The rhotacised forms are in the same index as the plain ones rather than
 * being found by taking an `-l` off the end, because GR's 儿化 is a fusion and
 * there is nothing to take off: `wal` is 玩儿 wánr and `wa` is not a syllable
 * anybody wrote. It is also why one spelling can be several syllables — `jiel`
 * is 今儿 jīnr and 鸡儿 jīr — which the index holds as it holds any other
 * collision.
 */
function lookUp(spelling: string): readonly Syllable[] {
  return INDEX.get(spelling) ?? [];
}

/**
 * Read a Gwoyeu Romatzyh syllable: `jiow` becomes 就 jiù.
 *
 * A leading dot is the neutral tone, and it wins over whatever tone the
 * spelling behind it carries — `.yeou` is a neutral 友, which is what GR means
 * by it. The tone it displaces is kept as the {@link Syllable.originalTone},
 * since that is exactly what the spelling behind the dot recorded and it is
 * what writing the syllable back needs.
 *
 * Returns every syllable the spelling stands for, and nothing at all for a
 * spelling no syllable of the inventory writes.
 *
 * Narrowed after the dot has been applied rather than before it, since the dot
 * is what says which tone was written: `ell` is 二 èr or 恩儿 ēnr, and a
 * neutral `.ell` is neither of those tones.
 */
export function readGwoyeu(text: string): readonly Syllable[] {
  const written = text.trim().normalize("NFC").toLowerCase();
  const isNeutral = written.startsWith(NEUTRAL_MARK);
  const found = lookUp(
    isNeutral ? written.slice(NEUTRAL_MARK.length) : written,
  );
  return narrowToAttested(
    isNeutral
      ? found.map((syllable) => ({
          ...syllable,
          tone: NEUTRAL_TONE,
          ...(syllable.tone !== undefined && { originalTone: syllable.tone }),
        }))
      : found,
  );
}
