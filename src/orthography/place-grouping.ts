/**
 * Joining a place name to the generic that names its kind.
 *
 * 北京市 is one orthographic word and 北京 市 is two, and which it is depends
 * on the generic rather than on the tag jieba gave the whole.
 */
import type { DecodedWord } from "../decode/word.js";
import { toCharacters } from "../script/characters.js";
import { type GroupingRule, join, splitAt } from "./rule.js";

/**
 * The generic half of an administrative place name.
 *
 * Both scripts, since a 繁體 name is a key in its own right and never converted
 * before lookup.
 */
const ADMINISTRATIVE_GENERICS = new Set([
  "市",
  "省",
  "县",
  "縣",
  "区",
  "區",
  "镇",
  "鎮",
  "乡",
  "鄉",
  "村",
  "州",
]);

/**
 * Fold every word a predicate accepts into the word before it.
 */
export function joinBackwards(
  words: readonly DecodedWord[],
  isAttached: (word: DecodedWord, head: DecodedWord) => boolean,
): readonly DecodedWord[] {
  const grouped: DecodedWord[] = [];
  for (const word of words) {
    const head = grouped.at(-1);
    if (head !== undefined && isAttached(word, head)) {
      grouped[grouped.length - 1] = join(head, word);
      continue;
    }
    grouped.push(word);
  }
  return grouped;
}

/**
 * 了, 着 and 过 attach to the verb in front of them.
 *
 * GB/T 16159: 他看了 is `tā kànle`, not `tā kàn le`. Safe as a rule because it
 * only ever joins what the decode had already separated — the dictionary has no
 * entry for 看了, so nothing the dictionary asserted is being overridden. The
 * readings do not change either way, so the worst case is untidy spacing.
 */

/**
 * A place name's generic half is written separately, and capitalised.
 *
 * GB/T 16159 专名和通名分写: 南京市 is `Nánjīng Shì`, 西湖区 is `Xīhú Qū`.
 *
 * Two conditions keep it from running away, both of them measured against the
 * whole dictionary rather than guessed. The word must be tagged a place name,
 * and **the part before the generic must itself be a word** — without the
 * second, 上山下乡 and 三街六市 are tagged `ns` and come apart as
 * `Shàngshānxià Xiāng` and `Sānjiēliù Shì`. Together they fire on 4,798 of the
 * dictionary's 8,781 candidates and hold back 427.
 *
 * The rule deliberately never touches a two-character name, so 上海 stays
 * `Shànghǎi` and 长城 stays `Chángchéng`: there, the generic character is part
 * of the proper name rather than a description of it, and no rule can tell the
 * two apart — 黄河 is `Huáng Hé` and 青海 is `Qīnghǎi`.
 */
export const PLACE_GENERICS: GroupingRule = {
  name: "place-generics",
  apply: (words, dictionary) =>
    words.flatMap((word) => {
      const characters = toCharacters(word.text);
      const generic = characters.at(-1) ?? "";
      if (
        word.partOfSpeech !== "ns" ||
        characters.length < 3 ||
        !ADMINISTRATIVE_GENERICS.has(generic) ||
        dictionary.lookup(characters.slice(0, -1).join("")) === undefined
      ) {
        return [word];
      }
      const split = splitAt(word, characters.length - 1);
      if (split === undefined) {
        return [word];
      }
      // Both halves are capitalised: 通名 is part of the name, not a common
      // noun trailing it.
      return split.map((part) => ({ ...part, isProperNoun: true }));
    }),
};
