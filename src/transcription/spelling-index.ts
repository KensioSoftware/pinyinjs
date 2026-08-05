/**
 * An index from a written spelling to the syllables it can stand for.
 *
 * Every reader in this directory is an index over the attested inventory rather
 * than a reverse rule, for the reason [wade-giles.ts](wade-giles.ts) records: a
 * rule would happily read `shung` or `ki`, which are regular spellings of
 * syllables Mandarin does not have. Building the index by *writing* every
 * syllable also means a reader cannot drift from its writer — there is one
 * table, and reading is what falls out of it backwards.
 *
 * Wade-Giles keeps its own version of this, because it needs two indexes and a
 * per-mark repair for the apostrophes and diacritics real text drops. Yale and
 * IPA drop nothing, so they share the plain one.
 */
import {
  DICTIONARY_SYLLABLES,
  narrowToAttested,
} from "../syllable/inventory.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import type { Tone } from "../tone/tone.js";

/**
 * Every syllable a spelling stands for, which is one for all but a handful.
 */
export type SpellingIndex = ReadonlyMap<string, readonly Syllable[]>;

/**
 * Index the whole inventory by how `spell` writes each of its syllables.
 *
 * The syllables carry no tone: a spelling stands for a syllable, and the tone
 * is read off the marks separately.
 */
export function indexInventory(
  spell: (syllable: Syllable) => string,
): SpellingIndex {
  const index = new Map<string, Syllable[]>();
  for (const pinyin of DICTIONARY_SYLLABLES) {
    const syllable = readSyllable(pinyin);
    /* c8 ignore next 3 -- inventory.test.ts holds the parser to the inventory */
    if (syllable === undefined) {
      continue;
    }
    const key = spell(syllable);
    const found = index.get(key);
    if (found === undefined) {
      index.set(key, [syllable]);
    } else {
      found.push(syllable);
    }
  }
  return index;
}

/**
 * Read a spelling out of an index, allowing for a 儿化 suffix on the end of it.
 *
 * The suffix is tried second and separately, because both readings can be real:
 * Yale's `er` is 兒 ér, and it is also 餓儿 with the suffix on it. Returning
 * both is the same answer Wade-Giles gives to an ambiguous spelling, and it is
 * the caller's to narrow.
 *
 * Both readings can be real; often only one of them is. The tone written is
 * evidence about which — IPA's `aɚ˥` is 啊儿 ār and not a 兒 that is never
 * written in a first tone — so {@link narrowToAttested} takes the candidates
 * Mandarin does not write off the list before the caller sees it.
 */
export function readIndexed(
  index: SpellingIndex,
  spelling: string,
  tone: Tone | undefined,
  suffix: string,
): readonly Syllable[] {
  const found = (written: string, hasErhua: boolean): readonly Syllable[] =>
    (index.get(written) ?? []).map((syllable) => ({
      ...syllable,
      tone,
      ...(hasErhua && { erhua: true }),
    }));

  const base =
    spelling !== suffix && spelling.endsWith(suffix)
      ? spelling.slice(0, -suffix.length)
      : "";
  return narrowToAttested([
    ...found(spelling, false),
    ...(base === "" ? [] : found(base, true)),
  ]);
}
