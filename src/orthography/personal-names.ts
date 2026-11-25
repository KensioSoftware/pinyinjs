/**
 * Personal names no source lists, written as a surname and a given name.
 *
 * 郑板桥嫁女 and 蒋干盗书 are 歇后语 about historical figures. Neither source
 * lists 郑板桥 or 蒋干, so each decodes as a surname and whatever words its
 * given name happens to make (板桥 a plank bridge, 干 the verb). Nothing around
 * those words says a name runs through them. A saying has no title after the
 * name and often no punctuation, and the words that follow are a verb or a
 * noun, as they are after 云 in 云是天空中的水汽团 or 福 in 福生有基. Measured
 * over Chinese Boost's 例句 and sayings, every pattern that took 徐庶进曹营
 * also took a cloud, a bear or a fortune.
 *
 * So the names are listed. These are the ones found in the Chinese Boost 例句
 * and sayings, each read in its text. **Keep this small.** A name joins when a
 * text that needs it is found, the way
 * {@link import("../dictionary/kept-names.js").KEPT_NAMES} grows.
 */
import type { DecodedWord } from "../decode/word.js";
import { characterCount, toCharacters } from "../script/characters.js";
import type { GroupingRule } from "./rule.js";

/**
 * Each listed name, with how many of its characters are the surname.
 *
 * Both writings are listed, since a run is matched in the script it is in.
 */
export const PERSONAL_NAMES: ReadonlyMap<string, number> = new Map([
  ["郑板桥", 1],
  ["鄭板橋", 1],
  ["徐庶", 1],
  ["蒋干", 1],
  ["蔣幹", 1],
  ["严嵩", 1],
  ["嚴嵩", 1],
  ["杨五郎", 1],
  ["楊五郎", 1],
  ["孟获", 1],
  ["孟獲", 1],
]);

/**
 * The longest listed name, in characters.
 */
const LONGEST_NAME = Math.max(
  ...[...PERSONAL_NAMES.keys()].map((name) => characterCount(name)),
);

/**
 * 郑板桥 is `Zhèng Bǎnqiáo`, a surname and a given name.
 *
 * The surname has to be a word of its own and the name has to end on a word
 * boundary, so a decode that read a longer word across either edge is left
 * alone. The words of the given name are joined into one, since GB/T 16159
 * joins the syllables of a given name, and both parts take a capital.
 */
export const PERSONAL_NAME: GroupingRule = {
  name: "personal-name",
  apply: (words) => {
    const named: DecodedWord[] = [];
    for (let at = 0; at < words.length; at++) {
      const word = words[at];
      /* c8 ignore next 3 -- at stays inside the array */
      if (word === undefined) {
        continue;
      }
      const matched = nameFrom(words, at);
      named.push(...(matched?.parts ?? [word]));
      at += matched?.consumed ?? 0;
    }
    return named;
  },
};

/**
 * The listed name that starts at a word, written in its two parts, with how
 * many words after the first it consumed.
 */
function nameFrom(
  words: readonly DecodedWord[],
  at: number,
):
  | { readonly parts: readonly DecodedWord[]; readonly consumed: number }
  | undefined {
  const surname = words[at];
  if (surname === undefined) {
    return undefined;
  }
  let text = surname.text;
  for (let end = at + 1; end < words.length; end++) {
    text += words[end]?.text ?? "";
    if (characterCount(text) > LONGEST_NAME) {
      return undefined;
    }
    const surnameLength = PERSONAL_NAMES.get(text);
    if (surnameLength === characterCount(surname.text)) {
      const given = words.slice(at + 1, end + 1);
      return {
        parts: [
          { ...surname, isProperNoun: true },
          givenName(given, toCharacters(text).slice(surnameLength).join("")),
        ],
        consumed: end - at,
      };
    }
  }
  return undefined;
}

/**
 * The words of a given name joined into one name.
 */
function givenName(words: readonly DecodedWord[], text: string): DecodedWord {
  return {
    text,
    reading: words.flatMap((word) => [...word.reading]),
    isProperNoun: true,
    partOfSpeech: "nr",
    isKnown: words.every((word) => word.isKnown),
  };
}
