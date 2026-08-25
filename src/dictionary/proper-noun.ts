/**
 * Whether an entry is a proper noun, and where its 姓 ends.
 *
 * jieba's tags propose a proper noun and CC-CEDICT's capitalisation can veto
 * it. The tags on their own are noisy enough to be worth correcting — 沙发,
 * 城市, 阿姨, 智能卡 and 花生仁 are all tagged nr or nz, and the decoder
 * capitalises straight off this bit.
 */
import { characterCount, isSingleCharacter } from "../script/characters.js";
import { type CedictEntry, nameBoundariesOf } from "../sources/cedict.js";
import { isProperNounTag, type JiebaEntry } from "../sources/jieba.js";
import type { Syllable } from "../syllable/syllable.js";
import { leadsNames, type NameMassTable } from "./name-mass.js";

/**
 * What the sources between them say about a word's name-hood.
 */
export interface ProperNoun {
  readonly isProperNoun: boolean;
  /** Where the 姓 ends, in characters, or empty where nothing says. */
  readonly boundaries: readonly number[];
  /** Whether jieba proposed a proper noun that CC-CEDICT vetoed. */
  readonly isVetoed: boolean;
}

/**
 * Settle it for one word.
 *
 * The veto only ever demotes, never promotes. CC-CEDICT capitalises the pinyin
 * of a proper noun, which is a claim about the word rather than a category it
 * was sorted into — but it also capitalises any headword written with Latin
 * letters, so a capital there is not proof on its own. A lowercase one is much
 * better evidence, since nothing else would write it that way.
 *
 * The boundary is only looked for where the word survived the veto and reads
 * one syllable per character: 儿化 reads two characters as one syllable and
 * could not be cut by a count of characters.
 *
 * **A single character has to lead names as well**, which neither source can
 * say on its own and jieba's word list can. See
 * {@link import("./name-mass.js").leadsNames}. 411 characters carried the bit
 * on one capitalised sense, and 他连再见也不说 came out `tā Lián zàijiàn yě bù
 * shuō`.
 */
export function properNounOf(
  word: string,
  jiebaEntry: JiebaEntry | undefined,
  cedictEntries: readonly CedictEntry[],
  senses: readonly CedictEntry[],
  reading: readonly Syllable[],
  nameMass: NameMassTable,
): ProperNoun {
  const partOfSpeech = jiebaEntry?.partOfSpeech ?? "";
  const proposed =
    jiebaEntry === undefined
      ? cedictEntries.some((entry) => entry.isProperNoun)
      : isProperNounTag(partOfSpeech) &&
        (senses.length === 0 || senses.some((entry) => entry.isProperNoun));
  const isProperNoun =
    proposed &&
    (!isSingleCharacter(word) ||
      leadsNames(nameMass, word, jiebaEntry?.frequency ?? 0));
  const isAligned = characterCount(word) === reading.length;
  const boundaries =
    isProperNoun && isAligned
      ? (cedictEntries
          .map((entry) => nameBoundariesOf(entry.readings))
          .find((found) => found.length > 0) ?? [])
      : [];
  return {
    isProperNoun,
    boundaries,
    isVetoed: isProperNounTag(partOfSpeech) && !isProperNoun,
  };
}
