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
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { normaliseSuperscript } from "../tone/tone-mark.js";
import { type Tone, toneFromNotation } from "../tone/tone.js";
import {
  APOSTROPHE,
  APOSTROPHES,
  ERHUA_SUFFIX,
  writeWadeGilesSpelling,
} from "./wade-giles-spelling.js";

export {
  type WadeGilesOptions,
  writeWadeGiles,
  writeWadeGilesSpelling,
  writeWadeGilesWord,
} from "./wade-giles-spelling.js";

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

export const INDEX = buildIndex();

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
export function normalise(text: string): string {
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
 * Take the 儿化 suffix off a normalised spelling.
 *
 * Done before the tone digit is read rather than after, because the digit is
 * written in front of the suffix: `wan²-'rh` is a second-tone 玩 carrying it.
 *
 * Read loosely the apostrophe may have fallen off, so `-rh` is a suffix too;
 * read exactly it is not, and neither is `-êrh` under either reading. That is
 * the point of the reduced form: 女儿 nǚ'ér is `nü³-êrh²`, two syllables, and
 * a suffix spelled the same way would make the two indistinguishable.
 */
function splitErhua(
  spelling: string,
  isLoose: boolean,
): readonly [string, boolean] {
  const suffixes = isLoose
    ? [ERHUA_SUFFIX, withoutMarks(ERHUA_SUFFIX)]
    : [ERHUA_SUFFIX];
  const suffix = suffixes.find((one) => spelling.endsWith(one));
  return suffix === undefined
    ? [spelling, false]
    : [spelling.slice(0, -suffix.length), true];
}

/**
 * Read a normalised spelling out of one of the two indexes.
 *
 * `toKey` is how the spelling is turned into that index's key.
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
  isErhua: boolean,
): readonly Syllable[] {
  return (index.get(toKey(spelling)) ?? [])
    .filter((one) => isMarksDropped(one.spelling, spelling))
    .map((one) => ({
      ...one.syllable,
      tone,
      ...(isErhua && { erhua: true }),
    }));
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
  const [written, isErhua] = splitErhua(normalise(text), false);
  const [spelling, tone] = splitTone(written);
  return narrowToAttested(
    readFrom(INDEX.exact, (key) => key, spelling, tone, isErhua),
  );
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
  const [written, isErhua] = splitErhua(normalise(text), true);
  const [spelling, tone] = splitTone(written);
  const loose = readFrom(INDEX.loose, withoutMarks, spelling, tone, isErhua);

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
