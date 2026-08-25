/**
 * How much of jieba's corpus a character carries at the head of a name.
 *
 * A word is usually one thing, and 北京 being a place in its only sense settles
 * what 北京 is. A character is a morpheme that turns up in hundreds of words,
 * and nearly every character that is a surname is an ordinary word besides. 王
 * is `Wáng` and `wáng` the king, 连 is `Lián` and "even", 云 is `Yún` and a
 * cloud. Neither source settles that on its own. jieba tags the bare character
 * `nr` for all three, and CC-CEDICT gives all three a capitalised sense and a
 * lowercase one.
 *
 * What separates them is how often each is met as a name, and jieba's own word
 * list carries it. The character heads words there, each with a corpus count
 * and a tag of its own. 李 heads 40,346 occurrences of names against 9,787 of
 * ordinary words, and 连 heads 2,102 against 23,042 of 连续, 连接 and 连忙.
 * Counted this way the surnames separate from the words that happen to be
 * surnames, and the list that comes out is the one a reader would write down:
 * 陈, 赵, 杨, 吴, 朱, 郭, 蒋, 蔡 and about a hundred others.
 */
import { toCharacters } from "../script/characters.js";
import { isProperNounTag, type JiebaEntry } from "../sources/jieba.js";

/**
 * The corpus mass of the words one character begins, split by what they are.
 */
export interface NameMass {
  /** Occurrences of the names it begins. */
  readonly asName: number;
  /** Occurrences of the ordinary words it begins. */
  readonly asWord: number;
}

/**
 * What each character heads, keyed by the character.
 */
export type NameMassTable = ReadonlyMap<string, NameMass>;

/**
 * Count what every character heads in jieba's dictionary.
 *
 * **Only the first character of a word counts.** A capital opens a name and the
 * question here is what opens one, so 德 is counted for 德国 and not for 伍德.
 * Counting the inside of a name too would say that 德 is a name character,
 * which is true and answers a different question from the one the capital asks.
 *
 * Single characters are skipped, since a character heading itself would only
 * confirm whatever tag it already carries.
 */
export function countNameMass(
  jieba: ReadonlyMap<string, JiebaEntry>,
): NameMassTable {
  const mass = new Map<string, NameMass>();

  for (const [word, entry] of jieba) {
    const characters = toCharacters(word);
    const head = characters[0];
    if (characters.length < 2 || head === undefined) {
      continue;
    }
    const held = mass.get(head) ?? { asName: 0, asWord: 0 };
    mass.set(
      head,
      isProperNounTag(entry.partOfSpeech)
        ? { asName: held.asName + entry.frequency, asWord: held.asWord }
        : { asName: held.asName, asWord: held.asWord + entry.frequency },
    );
  }

  return mass;
}

/**
 * Whether jieba's corpus met a character at the head of a name more often than
 * as a word.
 *
 * The character's own count is on the side of the words, because a bare
 * character in a 简体 corpus is a word being used as one. 帅 heads 155
 * occurrences of names against 86 of words, which would pass, and it was
 * counted 795 times on its own reading `shuài` and meaning handsome, which
 * settles it the other way.
 *
 * A character jieba never saw heading a word has nothing on either side and
 * fails. What that costs is a 繁體 character, whose 简体 pairing lends it the
 * answer afterwards in `traditional-carry.ts`.
 */
export function leadsNames(
  mass: NameMassTable,
  character: string,
  frequency: number,
): boolean {
  const held = mass.get(character);
  return held !== undefined && held.asName > held.asWord + frequency;
}
