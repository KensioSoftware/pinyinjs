/**
 * Wade-Giles, in both directions.
 *
 * Writing it is a table, in the same way bopomofo is: an underlying initial and
 * final go in and a spelling comes out, with a handful of context rules for the
 * places Wade-Giles respells a final after particular initials (歌 gē is `ko`,
 * 作 zuò is `tso`, 貴 guì is `kuei`).
 *
 * Reading it is not a table, and that asymmetry is the whole of this file.
 * Three things stand in the way:
 *
 * - The spelling is not injective even when written correctly: `lo` is both
 *   luō and lo, and `o` is both ē and ō.
 * - The aspiration apostrophe is routinely dropped, and it carries a phonemic
 *   distinction: `ch'i` is qī and `chi` is jī, so a dropped mark makes one
 *   spelling stand for both. Written `chu`, with the diaeresis gone too, it
 *   stands for four syllables.
 * - The diacritics are routinely dropped as well — ê, ŭ and ü — which merges
 *   `hsü` into `hsu` and `tzŭ` into `tzu`.
 *
 * So reading returns *every* syllable a spelling could be, and does it against
 * the attested inventory rather than by rule: a rule would happily read `shung`
 * or `ki`, which are not syllables of Mandarin at all.
 * {@link readWadeGiles} takes the spelling as written, and
 * {@link readWadeGilesLoosely} allows for the marks that fell off. How much
 * that costs is measured — see `docs/romanization/`.
 *
 * The tone digit, where a text writes one, cuts that list back down: the
 * inventory knows which tones each syllable is written in, so `lo²` is 羅 luó
 * and not the 咯 that is only ever neutral. See {@link narrowToAttested}.
 */
import {
  DICTIONARY_SYLLABLES,
  narrowToAttested,
} from "../syllable/inventory.js";
import type { Final, Initial } from "../syllable/phonology.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { normaliseSuperscript, SUPERSCRIPT_TONES } from "../tone/tone-mark.js";
import { type Tone, toneFromNotation } from "../tone/tone.js";

/**
 * The mark Wade-Giles writes aspiration with.
 *
 * ASCII, because that is what a keyboard produces and what nearly all text
 * carries; the turned comma ʻ of the original and of library cataloguing is
 * read back but not written. Every shape a text might use is accepted on input,
 * which matters more here than in most places — this mark is the one carrying
 * the p/pʻ distinction.
 */
const APOSTROPHE = "'";

/**
 * Every shape the aspiration mark is written with in the wild.
 */
const APOSTROPHES = /['ʻʼ‘’`´ʹ]/gu;

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
 * The 儿化 suffix, which Wade-Giles writes as the syllable 兒 rather than as a
 * letter on the end of the one before it.
 *
 * So this is the one place a syllable is written with a hyphen in it: 花儿 huār
 * is `hua-êrh`. Pinyin's `r` suffix is the later convention and the two are not
 * interchangeable.
 */
const ERHUA_SUFFIX = "-êrh";

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
  return tones === "numbers"
    ? `${spelling}${String(tone)}`
    : /* c8 ignore next -- every tone has a raised digit */
      `${spelling}${SUPERSCRIPT_TONES.get(tone) ?? ""}`;
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

/**
 * Spellings that are correct Wade-Giles but are not the ones written here.
 *
 * Each is a place the sources give two forms for one syllable. Writing picks
 * one — the form that keeps the system as close to injective as it can be — and
 * reading takes either, since a text using the other is not wrong.
 */
const VARIANT_SPELLINGS: readonly (readonly [string, string])[] = [
  // 一 yī: `i` is the older and commoner form, `yi` follows pinyin.
  ["yi", "yi"],
  // 俄 é: `o` is attested (O-kuo for 俄國) but collides with 哦 ō, so `ê` is
  // written and `o` is only read.
  ["o", "e"],
  // 戳 chuō: regular in the series with 桌 `cho`, but `chʻuo` is also written.
  [`ch${APOSTROPHE}uo`, "chuo"],
];

/**
 * How each mark is written once it has been dropped.
 */
const DROPPED_MARKS = new Map<string, string>([
  [APOSTROPHE, ""],
  ["ê", "e"],
  ["ŭ", "u"],
  ["ü", "u"],
]);

/**
 * Every mark that can fall off.
 */
const MARKS = /['êŭü]/gu;

/**
 * Strip the marks that fall off Wade-Giles in the wild.
 *
 * The aspiration apostrophe and the three diacritics, all at once, because in
 * practice they go together: a text that writes `Tsingtao` for 青島 has dropped
 * both. ü becomes u rather than being spelled out, since that is what the
 * dropped form looks like.
 */
function withoutMarks(spelling: string): string {
  return spelling.replaceAll(
    MARKS,
    /* c8 ignore next -- the pattern only matches what the map holds */
    (mark) => DROPPED_MARKS.get(mark) ?? "",
  );
}

/**
 * Every syllable each Wade-Giles spelling can stand for.
 *
 * Built from the attested inventory rather than from a reverse rule, so that
 * nothing outside the syllabary can be read: `shung` is a perfectly regular
 * Wade-Giles spelling of a syllable Mandarin does not have, and a rule would
 * hand it back.
 *
 * The loose index is the same thing keyed by the spelling with its marks taken
 * off, which is what makes reading sloppy Wade-Giles a lookup rather than a
 * search.
 */
function buildIndex(): {
  readonly exact: ReadonlyMap<string, readonly Spelt[]>;
  readonly loose: ReadonlyMap<string, readonly Spelt[]>;
} {
  const exact = new Map<string, Spelt[]>();
  const loose = new Map<string, Spelt[]>();

  // A spelling of undefined means "whatever this module would write"; the
  // variants carry theirs, since they are the forms it would not have written.
  const sources: (readonly [string | undefined, string])[] = [
    ...[...DICTIONARY_SYLLABLES].map(
      (pinyin) => [undefined, pinyin] as readonly [undefined, string],
    ),
    ...VARIANT_SPELLINGS,
  ];

  const spelt: Spelt[] = [];
  for (const [spelling, pinyin] of sources) {
    const syllable = readSyllable(pinyin);
    /* c8 ignore next 3 -- inventory.test.ts holds the parser to the inventory */
    if (syllable === undefined) {
      continue;
    }
    spelt.push({
      spelling: spelling ?? writeWadeGilesSpelling(syllable),
      syllable,
    });
  }

  for (const one of spelt) {
    for (const [index, key] of [
      [exact, one.spelling],
      [loose, withoutMarks(one.spelling)],
    ] as const) {
      const found = index.get(key);
      if (found === undefined) {
        index.set(key, [one]);
      } else if (
        found.every((other) => !isSameSyllable(other.syllable, one.syllable))
      ) {
        found.push(one);
      }
    }
  }
  return { exact, loose };
}

/**
 * One Wade-Giles spelling and the syllable it stands for.
 */
interface Spelt {
  readonly spelling: string;
  readonly syllable: Syllable;
}

/**
 * Whether two syllables differ only in their tone, which none of the indexed
 * ones carry.
 */
function isSameSyllable(one: Syllable, other: Syllable): boolean {
  return one.initial === other.initial && one.final === other.final;
}

const INDEX = buildIndex();

/**
 * Take a trailing tone digit off, raised or on the line.
 */
function splitTone(text: string): readonly [string, Tone | undefined] {
  const found = /^(.*?)([0-5])$/u.exec(normaliseSuperscript(text));
  const digit = found?.[2];
  if (found === null || digit === undefined) {
    return [text, undefined];
  }
  return [found[1] ?? "", toneFromNotation(Number(digit))];
}

/**
 * Normalise a written syllable to the shape the exact index is keyed by.
 */
function normalise(text: string): string {
  return text
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replaceAll(APOSTROPHES, () => APOSTROPHE);
}

/**
 * Whether `written` is `spelling` with some of its marks dropped.
 *
 * Dropped, and never added: a text that wrote `chʻu` did not mean `chü`, and
 * only a text that wrote `chu` could have meant either. Allowing for a mark
 * that should not be there would double the candidate lists to catch a mistake
 * nobody makes, since the marks are dropped by not being typed rather than by
 * being typed wrongly.
 *
 * Per mark rather than all or nothing, because that is how they come off:
 * `chʻu` has kept its apostrophe and lost a diaeresis it may or may not have
 * had, so it is 出 chū or 去 qù but not 朱 zhū.
 */
function isMarksDropped(spelling: string, written: string): boolean {
  let at = 0;
  for (const character of spelling) {
    const dropped = DROPPED_MARKS.get(character);
    if (written[at] === character) {
      at += 1;
    } else if (dropped !== undefined && written.startsWith(dropped, at)) {
      at += dropped.length;
    } else {
      return false;
    }
  }
  return at === written.length;
}

/**
 * Read a normalised spelling out of one of the two indexes.
 *
 * `toKey` is how the spelling is turned into that index's key, and it has to be
 * applied to the 儿化 suffix as well: read loosely, `hua-êrh` arrives as
 * `hua-erh`.
 *
 * The tone is written on here and not judged: the index is toneless, so what
 * comes back is every syllable of that spelling in whatever tone the text
 * carried, and narrowing that to the tones Mandarin actually writes belongs to
 * the callers, which have the whole candidate list to weigh.
 */
function readFrom(
  index: ReadonlyMap<string, readonly Spelt[]>,
  toKey: (spelling: string) => string,
  spelling: string,
  tone: Tone | undefined,
): readonly Syllable[] {
  const found = (written: string, isErhua: boolean): readonly Syllable[] =>
    (index.get(toKey(written)) ?? [])
      .filter((one) => isMarksDropped(one.spelling, written))
      .map((one) => ({
        ...one.syllable,
        tone,
        ...(isErhua && { erhua: true }),
      }));

  const suffix = toKey(ERHUA_SUFFIX);
  const base = spelling.endsWith(suffix)
    ? spelling.slice(0, -suffix.length)
    : "";
  return [...found(spelling, false), ...(base === "" ? [] : found(base, true))];
}

/**
 * Read a Wade-Giles syllable exactly as it is written: `chiu⁴` becomes 就 jiù.
 *
 * Returns every syllable the spelling stands for, which is one for all but a
 * handful of them — `lo` is both 羅 luó and 咯 lo, and `o` is both 俄 é and
 * 哦 ó. Empty for anything that is not Wade-Giles at all.
 *
 * A written tone narrows that: 咯 is only ever neutral, so `lo` on its own is
 * the two syllables and `lo²` is 羅 luó alone. See {@link narrowToAttested}.
 */
export function readWadeGiles(text: string): readonly Syllable[] {
  const [spelling, tone] = splitTone(normalise(text));
  return narrowToAttested(readFrom(INDEX.exact, (key) => key, spelling, tone));
}

/**
 * The same, allowing for the marks real-world Wade-Giles drops.
 *
 * `chi` read exactly is 機 jī; read loosely it is jī or 七 qī, because a text
 * that meant `chʻi` may simply never have typed the apostrophe. The exact
 * readings come first, so a caller that wants to believe what was written can
 * take the head of the list and one that wants every possibility can take the
 * lot.
 *
 * Narrowed over the whole list rather than over each half of it, because the
 * two halves are rivals: `pan²` written exactly is a bán that Mandarin does not
 * have, and the reading worth keeping is the 盤 pán of a text that dropped an
 * apostrophe. Read exactly, `pan²` is still bán — there is nothing there to
 * prefer it to.
 */
export function readWadeGilesLoosely(text: string): readonly Syllable[] {
  const exact = readWadeGiles(text);
  const [spelling, tone] = splitTone(normalise(text));
  const loose = readFrom(INDEX.loose, withoutMarks, spelling, tone);

  return narrowToAttested([
    ...exact,
    ...loose.filter((syllable) =>
      exact.every(
        (other) =>
          !isSameSyllable(other, syllable) || other.erhua !== syllable.erhua,
      ),
    ),
  ]);
}

/**
 * The longest a Wade-Giles head can be: the longest spelling, plus the 儿化
 * suffix and a tone digit.
 *
 * Derived rather than written down, because a fixed width is a number that goes
 * stale silently.
 */
const LONGEST_SPELLING =
  Math.max(...[...INDEX.exact.keys()].map((spelling) => spelling.length)) + 1;

/**
 * The syllables Wade-Giles writes with no vowel in them at all.
 *
 * 嗯 `ng`, 呣 `m`, 唔 `n`, 噷 `hm` and 哼 `hng` — the syllabic nasals, every one
 * of them an interjection. They are syllables and read as such on their own,
 * but a *piece* of a longer run is never one of them: over the 411,956
 * multi-syllable words of the phrase corpus, **not one** has a syllabic nasal
 * anywhere in it, first or otherwise.
 *
 * That matters because `ng` would otherwise let any run ending in -ng come
 * apart: `shung` is a regular Wade-Giles spelling of a syllable Mandarin does
 * not have, and {@link readWadeGiles} refuses it precisely so that a rule
 * cannot invent it — but `shu` + `ng` would hand it back through the side door.
 * Barring them from a split costs nothing that can be measured and closes it.
 */
const SYLLABIC_NASALS = new Set(
  [...INDEX.loose.keys()].filter((spelling) => !/[aeiouêŭü]/u.test(spelling)),
);

/**
 * Whether a normalised run reads as exactly one Wade-Giles syllable.
 *
 * Asked of the loose reader, so that a splitter accepts the same spellings the
 * reader does: a splitter that emitted a piece the reader then refused would be
 * the two halves disagreeing about what Wade-Giles is.
 */
function isOneSyllable(run: string, memo: Map<string, boolean>): boolean {
  const found = memo.get(run);
  if (found !== undefined) {
    return found;
  }
  const isReads = readWadeGilesLoosely(run).length > 0;
  memo.set(run, isReads);
  return isReads;
}

/**
 * Split a run of Wade-Giles with no hyphens in it, longest-first.
 *
 * Memoised on the suffix, as `splitSyllables` is, since a run of ambiguous
 * syllables would otherwise backtrack exponentially.
 */
function segmentWadeGiles(
  run: string,
  reads: Map<string, boolean>,
  memo: Map<string, readonly string[] | undefined>,
): readonly string[] | undefined {
  if (run === "") {
    return [];
  }
  const found = memo.get(run);
  if (found !== undefined || memo.has(run)) {
    return found;
  }
  memo.set(run, undefined);
  for (
    let length = Math.min(LONGEST_SPELLING, run.length);
    length > 0;
    length--
  ) {
    const head = run.slice(0, length);
    if (!isOneSyllable(head, reads) || SYLLABIC_NASALS.has(head)) {
      continue;
    }
    const rest = segmentWadeGiles(run.slice(length), reads, memo);
    if (rest !== undefined) {
      const split = [head, ...rest];
      memo.set(run, split);
      return split;
    }
  }
  return undefined;
}

/**
 * Split written Wade-Giles into syllables: `maotsetung` becomes three.
 *
 * **The hyphen is Wade's own boundary and is honoured where it is there.** What
 * this is for is the text that dropped it, which is most of the Wade-Giles
 * anybody meets — and there the system has nothing to fall back on, since its
 * apostrophe marks aspiration rather than separation. Pinyin's 隔音符号 has no
 * counterpart here.
 *
 * Longest-first, as `splitSyllables` is for pinyin, and measured on the same
 * vocabulary the 52.07% ambiguity figure comes from — 411,956 multi-syllable
 * words of the phrase corpus, written in Wade-Giles and run together:
 *
 * | | marks kept | marks dropped |
 * | --- | ---: | ---: |
 * | the boundary is found | 99.19% | 99.04% |
 * | the word comes back | **99.45%** | **56.04%** |
 *
 * **Finding the boundary is not the hard part; saying which syllable it was
 * is.** The boundary is found either way; what collapses is the reading, and
 * only when the marks are gone, because 52.07% of written syllables then no
 * longer say which syllable they were. See {@link readWadeGilesLoosely}.
 *
 * The true split is among the candidates 100.00% of the time and is the only
 * candidate 17.08% of the time, at a mean of 5.23 candidates per word — so
 * longest-first is a choice among real rivals rather than the only reading
 * available. It comes back whole slightly *more* often than it finds the
 * boundary, because two of the variant spellings read the same either way.
 *
 * The 0.81% of boundaries that are missed are one mechanism: Wade-Giles ends
 * syllables in -n and -ng and begins them with vowels and n-, so `i-ti-hu-na`
 * runs together as `itihuna` and comes back `i-ti-hun-a`. Of 3,317 misses,
 * 53.39% swallow a syllable beginning with n- and 36.72% one beginning with a
 * vowel. Pinyin is spared most of this by spelling a zero-initial i- as `yi-`;
 * Wade-Giles writes 一 as `i`, and 960 of the misses — 28.94% — are a
 * swallowed 一.
 *
 * Returns undefined for a run that does not split into Wade-Giles at all —
 * which includes `Chungking` and `Tsingtao`, because those are Postal
 * Romanisation rather than Wade-Giles and `king`, `tsing` and `pe` are not
 * Wade-Giles syllables.
 */
export function splitWadeGiles(text: string): readonly string[] | undefined {
  const run = normalise(text);
  if (run === "") {
    return undefined;
  }
  const reads = new Map<string, boolean>();

  // One syllable is one syllable, which is what lets the syllabic nasals be
  // read on their own while never being a piece of anything longer.
  if (isOneSyllable(run, reads)) {
    return [run];
  }

  const memo = new Map<string, readonly string[] | undefined>();

  // A hyphen is a boundary except in `-êrh`, which is part of a spelling — so
  // the segmenter is given the hyphens and takes the longer head where one
  // reads, rather than the run being cut on them first.
  const split = segmentWadeGiles(run, reads, memo);
  if (split !== undefined) {
    return split;
  }
  // Nothing read across the hyphens, so treat every one of them as a boundary.
  const parts = run.split("-").filter((part) => part !== "");
  if (parts.length < 2) {
    return undefined;
  }
  const segments = parts.map((part) => segmentWadeGiles(part, reads, memo));
  return segments.includes(undefined)
    ? undefined
    : segments.flatMap((segment) => segment ?? []);
}

/**
 * Read a whole Wade-Giles word, splitting it first: `maotsetung` is 毛澤東.
 *
 * Takes the first candidate for each syllable rather than every combination,
 * which is the same choice {@link readWadeGilesLoosely}'s ordering offers and
 * for the same reason: a caller looking at a word cannot be handed the 5.23
 * splits and the candidates under each of them and be said to have an answer.
 * Measured over the phrase corpus, that recovers 99.45% of words written with
 * their marks and 56.04% of words written without them.
 *
 * Undefined where the run does not split at all.
 */
export function readWadeGilesWord(
  text: string,
): readonly Syllable[] | undefined {
  const split = splitWadeGiles(text);
  if (split === undefined) {
    return undefined;
  }
  const syllables = split.flatMap((spelling) => {
    const [first] = readWadeGilesLoosely(spelling);
    /* c8 ignore next -- the splitter only emits spellings that read */
    return first === undefined ? [] : [first];
  });
  /* c8 ignore next -- for the same reason */
  return syllables.length === split.length ? syllables : undefined;
}
