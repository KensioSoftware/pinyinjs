/**
 * Surname characters the dictionary does not flag, and the dynasties.
 */
import type { DecodedWord } from "../decode/word.js";
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { toCharacters } from "../script/characters.js";

/**
 * Common surnames whose character stands alone as an ordinary word.
 *
 * 马 is a horse and 严 strict, so the dictionary does not flag either
 * character as a name of its own (see "Single-character names require an
 * additional frequency check" in docs/orthography/). Before a title they are
 * still surnames. 马奶奶 is Grandma Ma and 张先生 is Mr Zhang.
 *
 * Drawn from the first hundred surnames in 百家姓 that the dictionary leaves
 * unflagged, in both scripts. Characters that are also a preposition, a verb
 * or an adverb a title can follow are left out (向老师问好 greets a teacher
 * and 谢老师 thanks one). They are 何, 于, 向, 曾, 莫, 万, 余, 任, 付, 谢, 顾,
 * 戴, 段 and 钱. 龙 is left out as well, because 龙妈妈 is more often a
 * dragon in a story than a Mrs Long.
 */
export const UNFLAGGED_SURNAMES: ReadonlySet<string> = new Set(
  "张刘黄周孙马高林罗唐许韩肖田董苏钟谭范金石夏白雷史陶严武汤程方張劉黃孫馬羅許韓蕭蘇鍾譚嚴湯",
);

/**
 * The dynasties, by the character that names each.
 *
 * 宋本 is a Song edition and 明本 a Ming one. 宋 is flagged as the surname
 * Sòng and 明 is not flagged at all, but before {@link DYNASTY_WORDS} each is
 * the dynasty and takes a capital.
 */
export const DYNASTIES: ReadonlySet<string> = new Set(
  "夏商周秦汉漢晋晉隋唐宋元明清",
);

/**
 * The words that say the character before them is a dynasty.
 *
 * An edition (宋本), the dynasty itself (宋朝) and its period (宋代).
 */
export const DYNASTY_WORDS: ReadonlySet<string> = new Set(["本", "朝", "代"]);

/**
 * The words that count or point at the character after them.
 *
 * 两张老师的照片 is two photos and 这周本 is this week. After a number or a
 * demonstrative, 张 and 周 are a measure word and a week, not a surname or a
 * dynasty.
 */
export const COUNTING_WORDS: ReadonlySet<string> = new Set("这那哪每几這幾");

/**
 * Whether a number or a demonstrative counts the character.
 */
export function isCountedAt(
  words: readonly DecodedWord[],
  at: number,
): boolean {
  const before = words[at - 1];
  return (
    before !== undefined &&
    (COUNTING_WORDS.has(before.text) ||
      toCharacters(before.text).every((character) =>
        QUANTITY_CHARACTERS.has(character),
      ))
  );
}

/**
 * Whether the character is a dynasty, named by the word after it.
 */
export function isDynastyAt(
  words: readonly DecodedWord[],
  at: number,
): boolean {
  const word = words[at];
  const after = words[at + 1];
  return (
    word !== undefined &&
    after !== undefined &&
    DYNASTIES.has(word.text) &&
    DYNASTY_WORDS.has(after.text)
  );
}
