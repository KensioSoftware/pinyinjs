/**
 * Whether an entry is a proper noun, and where its 姓 ends.
 *
 * jieba's tags propose a proper noun and CC-CEDICT's capitalisation can veto
 * it. The tags on their own are noisy enough to be worth correcting — 沙发,
 * 城市, 阿姨, 智能卡 and 花生仁 are all tagged nr or nz, and the decoder
 * capitalises straight off this bit.
 *
 * Only the senses that state a meaning of the word standing alone are read for
 * the veto. A capitalised
 * cross-reference carries the capital of the entry it points at, and reading it
 * as the word's own put a capital on 长寿, 友谊, 温泉 and 115 other keys. See
 * {@link statedOf}.
 */
import {
  characterCount,
  isSingleCharacter,
  toCharacters,
} from "../script/characters.js";
import {
  type CedictEntry,
  isBound,
  isStated,
  nameBoundariesOf,
} from "../sources/cedict.js";
import { isProperNounTag, type JiebaEntry } from "../sources/jieba.js";
import type { Syllable } from "../syllable/syllable.js";
import { KEPT_NAMES } from "./kept-names.js";
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
  lookup: NameLookup,
): ProperNoun {
  const partOfSpeech = jiebaEntry?.partOfSpeech ?? "";
  const proposed =
    jiebaEntry === undefined
      ? statedOf(cedictEntries).some((entry) => entry.isProperNoun)
      : isProperNounTag(partOfSpeech) &&
        (senses.length === 0 ||
          statedOf(senses).some((entry) => entry.isProperNoun));
  const isProperNoun =
    proposed &&
    (isSingleCharacter(word)
      ? leadsNames(nameMass, word, jiebaEntry?.frequency ?? 0)
      : senses.length > 0 || isUnlistedName(word, nameMass, lookup));
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

/**
 * What the merge can say about other words while it settles one.
 */
export interface NameLookup {
  /** jieba's count for a character standing on its own. */
  readonly frequencyOf: (character: string) => number;
  /** Whether CC-CEDICT capitalises a sense of the word. */
  readonly isCapitalised: (word: string) => boolean;
}

/**
 * Read other words' counts and capitals off the indexed sources.
 */
export function nameLookupOf(
  jieba: ReadonlyMap<string, JiebaEntry>,
  cedictByWord: ReadonlyMap<string, readonly CedictEntry[]>,
): NameLookup {
  return {
    frequencyOf: (character) => jieba.get(character)?.frequency ?? 0,
    isCapitalised: (word) =>
      (cedictByWord.get(word) ?? []).some((entry) => entry.isProperNoun),
  };
}

/**
 * Whether a word jieba tags as a name, and CC-CEDICT does not hold at all, is
 * one.
 *
 * jieba tags about 89,000 such words `nr`, `ns`, `nt` or `nz`. Most are names
 * (韦小宝, 令狐冲, 洪七公), and plenty are ordinary words that happened to be
 * tagged: 小姑娘, 老先生, 黑狗, 换衣服, 静静. With no CC-CEDICT entry there is
 * no lowercase sense to veto the tag, and 她只是个小姑娘 came out `tā zhǐshì
 * gè Xiǎogūniang`.
 *
 * A name starts with a character that starts names, which is the same test a
 * single character has to pass ({@link leadsNames}). 韦, 令 and 洪 pass, and
 * 小, 老, 黑 and 换 do not. A place that is a known name plus a generic, such
 * as 肯塔基州 or 长野县, keeps the flag on the name it opens with. The few
 * names that pass neither test are listed in {@link KEPT_NAMES}.
 */
function isUnlistedName(
  word: string,
  nameMass: NameMassTable,
  lookup: NameLookup,
): boolean {
  const characters = toCharacters(word);
  const head = characters[0] ?? "";
  return (
    KEPT_NAMES.has(word) ||
    leadsNames(nameMass, head, lookup.frequencyOf(head)) ||
    characters
      .slice(2)
      .some((_, at) =>
        lookup.isCapitalised(characters.slice(0, at + 2).join("")),
      )
  );
}

/**
 * The senses that state a meaning, falling back to all of them where none does.
 *
 * A capital on a bare cross-reference is the capital of the entry it points at,
 * so 长寿 `/see 長壽區|长寿区/` is no evidence that 长寿 is a place. Reading the
 * capitals off the stated senses alone demotes it, and 保安, 东北 and 京都 keep
 * the flag their stated senses earn. See
 * {@link import("../sources/cedict.js").isStated}.
 *
 * A bound form states a meaning, but not one the characters carry standing
 * alone. 美 is the 美 of 中美 and 美元 in its capitalised sense, and that
 * sense is all `(bound form)`. Read as stated, it capitalised 她很美 as `tā
 * hěn Měi`. See {@link import("../sources/cedict.js").isBound}.
 *
 * The fallback is what keeps a headword whose every sense refers on. 三亚 is
 * only ever `see 三亞市|三亚市`, and with nothing stated the cross-reference is
 * all the evidence there is. 2,347 flagged keys are in that position, among
 * them 七台河, 三门峡 and 上饶.
 */
function statedOf(entries: readonly CedictEntry[]): readonly CedictEntry[] {
  const stated = entries.filter((entry) => isStated(entry) && !isBound(entry));
  return stated.length > 0 ? stated : entries;
}
