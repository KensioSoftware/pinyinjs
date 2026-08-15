/**
 * The index every Wade-Giles reading is looked up in.
 *
 * Built by asking the writer what it would spell for each syllable of the
 * inventory, then keyed twice — once as written and once with the marks
 * stripped, since most Wade-Giles in the wild has dropped them.
 */
import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { APOSTROPHE, writeWadeGilesSpelling } from "./wade-giles-spelling.js";

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
export const DROPPED_MARKS = new Map<string, string>([
  [APOSTROPHE, ""],
  ["ê", "e"],
  ["ŭ", "u"],
  ["ü", "u"],
]);

/**
 * Every mark that can fall off.
 */
export const MARKS = /['êŭü]/gu;

/**
 * Strip the marks that fall off Wade-Giles in the wild.
 *
 * The aspiration apostrophe and the three diacritics, all at once, because in
 * practice they go together: a text that writes `Tsingtao` for 青島 has dropped
 * both. ü becomes u rather than being spelled out, since that is what the
 * dropped form looks like.
 */
export function withoutMarks(spelling: string): string {
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
export interface Spelt {
  readonly spelling: string;
  readonly syllable: Syllable;
}

/**
 * Whether two syllables differ only in their tone, which none of the indexed
 * ones carry.
 */
export function isSameSyllable(one: Syllable, other: Syllable): boolean {
  return one.initial === other.initial && one.final === other.final;
}

export const INDEX = buildIndex();
