/**
 * Which compounds the locale composition may be asked about at all.
 *
 * Three filters that between them cut 461,555 entries to a few hundred: the
 * compound has to line up one syllable per character, it has to contain a word
 * that carries a delta, and it must not be one of the homographs the data
 * cannot tell apart.
 */
import { toCharacters } from "../script/characters.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * Compounds whose constituent's 國語 reading must not be carried over.
 *
 * The composition below only fires where the compound reads its constituent
 * exactly as that constituent's own entry does, which rules out most of the ways
 * it could be wrong. What it cannot rule out is a homograph: two words spelled
 * and read identically in 普通话, of which only one shifts in 國語. 相亲 is
 * `xiāngqīn` either way when it means "mutually close" and `xiàngqīn` in Taiwan
 * when it means a matchmaking meeting, and nothing in the data distinguishes the
 * two senses.
 *
 * **Keep this small**, for the same reason
 * {@link import("./overrides.js").READING_OVERRIDES} is kept small. Three
 * exclusions against the 100 compounds the composition settles is the measured
 * ratio; a list growing much past that would mean the alignment check has
 * stopped carrying its weight and the rule itself needs revisiting.
 */
export const LOCALE_COMPOSITION_EXCLUSIONS: readonly {
  readonly word: string;
  readonly reason: string;
}[] = [
  {
    word: "相亲相爱",
    reason:
      "相亲 here is 相 + 亲 in the reciprocal sense, `xiāngqīn`, not the matchmaking word that reads `xiàngqīn` in 國語.",
  },
  {
    word: "腹背相亲",
    reason: "The same reciprocal 相亲, so the same reading in both locales.",
  },
  {
    word: "洋为中用",
    reason:
      "中 is 中国 and 用 is its own verb: 洋为中用 is not built on the word 中用, which is what reads `zhòngyòng` in 國語.",
  },
];

/**
 * The exclusions as a set, for the composition to consult.
 */
const EXCLUDED: ReadonlySet<string> = new Set(
  LOCALE_COMPOSITION_EXCLUSIONS.map((exclusion) => exclusion.word),
);

/**
 * Whether a compound can be asked what it is made of at all.
 *
 * A reading of one syllable per character is what lets a character span be cut
 * out of the compound's reading and replaced. 儿化 folds two characters into one
 * syllable and punctuation reads as none, so neither lines up and both are left
 * alone.
 */
export function isComposable(entry: DictionaryEntry): boolean {
  const characters = toCharacters(entry.hans);
  return (
    characters.length > 2 &&
    entry.readings.cn.length === characters.length &&
    !EXCLUDED.has(entry.hans) &&
    !EXCLUDED.has(entry.hant)
  );
}

/**
 * Whether any delta-carrying word appears inside this one.
 *
 * A cheap filter ahead of the segmentation: only a few hundred words carry a
 * delta, against 461,555 entries, and enumerating one word's substrings costs
 * far less than segmenting it.
 */
export function hasMarkedConstituent(
  word: string,
  marked: ReadonlySet<string>,
): boolean {
  const characters = toCharacters(word);
  return characters.some((_, from) => {
    let candidate = "";
    return characters.slice(from).some((character) => {
      candidate += character;
      return candidate !== word && marked.has(candidate);
    });
  });
}
