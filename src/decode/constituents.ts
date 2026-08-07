import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";

/**
 * The shortest word that can divide into two: 展覽 + 館 is three characters.
 */
const SHORTEST_DIVISIBLE = 3;

/**
 * Where a word divides, as the syllable counts of its two halves.
 *
 * Sandhi's domain is the prosodic foot, and inside a word the foot follows the
 * word's own structure: 展覽館 is 展覽 + 館 and 紙老虎 is 紙 + 老虎, which is the
 * whole reason one is `zhánlánguǎn` and the other `zhǐláohǔ`. Nothing in a
 * reading says which, so the dictionary is asked: a division is only proposed
 * where **both halves are words in their own right**.
 *
 * Where several divisions qualify, the most even one wins, and the one whose
 * rarest half is least rare breaks a remaining tie. Evenness first because a
 * four-syllable word is two feet of two rather than three and one — 莫名其妙 is
 * `mòmíng-qímiào`. Rarity rather than total frequency because a three-syllable
 * word divides evenly either way, and the question there is which of the two
 * two-syllable halves is really a word in it: 水彩筆 is 水彩 + 筆 rather than
 * 水 + 彩筆, and totalling the two would decide it on how common 水 is.
 *
 * Undefined where nothing qualifies, which is the common answer. Most words are
 * one or two syllables and have no room to divide; of the longer ones, plenty
 * are built from a bound form that is not a word — and an undivided word is
 * simply one foot, which is what the sandhi pass assumes without this.
 */
export function divisionOf(
  dictionary: Dictionary,
  word: string,
  reading: readonly Syllable[],
): readonly [number, number] | undefined {
  const characters = toCharacters(word);
  // 儿化 folds two characters into one syllable, so a reading shorter than the
  // word cannot be cut at a character boundary and is left whole.
  if (
    characters.length < SHORTEST_DIVISIBLE ||
    characters.length !== reading.length
  ) {
    return undefined;
  }

  let best: readonly [number, number] | undefined;
  let bestScore: readonly [number, number] | undefined;
  for (let at = 1; at < characters.length; at++) {
    const left = dictionary.lookup(characters.slice(0, at).join(""));
    const right = dictionary.lookup(characters.slice(at).join(""));
    if (left === undefined || right === undefined) {
      continue;
    }
    const score = [
      Math.abs(at - characters.length / 2),
      Math.max(left.cost, right.cost),
    ] as const;
    if (
      bestScore === undefined ||
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] && score[1] < bestScore[1])
    ) {
      best = [at, characters.length - at];
      bestScore = score;
    }
  }
  return best;
}
