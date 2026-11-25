/**
 * Names no source lists, with how each is written.
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
 * So the names are listed, each with the pinyin it is written in. The table
 * settles the reading as well as the capitals and the spaces. 藏王 is the
 * Japanese ski resort Zaō, and the decode reads its 藏 as `cáng`, to hide.
 *
 * These are the names found in the Chinese Boost 例句 and sayings, each read in
 * its text. A saying is listed whole where its names only make sense together,
 * as the states of Qin and Chu do in 亡秦必楚. **Keep this small.** A name
 * joins when a text that needs it is found, the way
 * {@link import("../dictionary/kept-names.js").KEPT_NAMES} grows.
 */
import type { DecodedWord } from "../decode/word.js";
import { characterCount } from "../script/characters.js";
import { LISTED_NAMES } from "./listed-name-table.js";
import {
  hintedFrom,
  keepingHinted,
  listedWords,
  type ListedWord,
} from "./listed-words.js";
import type { GroupingRule } from "./rule.js";

/**
 * The words of every listed text, cut once.
 */
const LISTED_WORDS: ReadonlyMap<string, readonly ListedWord[]> = new Map(
  [...LISTED_NAMES].map(([text, pinyin]) => [text, listedWords(text, pinyin)]),
);

/**
 * The longest listed text, in characters.
 */
const LONGEST_LISTED = Math.max(
  ...[...LISTED_NAMES.keys()].map((text) => characterCount(text)),
);

/**
 * 郑板桥 is `Zhèng Bǎnqiáo` and 藏王 `Zàngwáng`, as the table writes them.
 *
 * A listed text has to start and end on a word boundary, so a decode that read
 * a longer word across either edge is left alone. The words inside it are
 * replaced with the table's, readings and capitals included.
 *
 * Runs after {@link import("./lone-name.js").LONE_NAME}, which would otherwise
 * take the capital off 秦 in 亡秦必楚.
 */
export const LISTED_NAME: GroupingRule = {
  name: "listed-name",
  apply: (words, _dictionary, context) => {
    const hinted = context?.hinted ?? new Set<number>();
    const named: DecodedWord[] = [];
    let offset = 0;
    for (let at = 0; at < words.length; at++) {
      const word = words[at];
      /* c8 ignore next 3 -- at stays inside the array */
      if (word === undefined) {
        continue;
      }
      const matched = listedFrom(words, at, hintedFrom(hinted, offset));
      const consumed = words.slice(at, at + 1 + (matched?.consumed ?? 0));
      named.push(...(matched?.words ?? [word]));
      offset += characterCount(consumed.map((one) => one.text).join(""));
      at += matched?.consumed ?? 0;
    }
    return named;
  },
};

/**
 * The listed text that starts at a word, written as the table writes it, with
 * how many words after the first it consumed.
 */
function listedFrom(
  words: readonly DecodedWord[],
  at: number,
  isHinted: (position: number) => boolean,
):
  | { readonly words: readonly DecodedWord[]; readonly consumed: number }
  | undefined {
  let text = "";
  for (let end = at; end < words.length; end++) {
    text += words[end]?.text ?? "";
    if (characterCount(text) > LONGEST_LISTED) {
      return undefined;
    }
    const listed = LISTED_WORDS.get(text);
    const covered = words.slice(at, end + 1);
    const written =
      listed === undefined
        ? undefined
        : keepingHinted(listed, covered, isHinted);
    if (written !== undefined) {
      const isKnown = covered.every((one) => one.isKnown);
      return {
        words: written.map((word) => ({
          ...word,
          partOfSpeech: word.isProperNoun ? "nr" : "",
          isKnown,
        })),
        consumed: end - at,
      };
    }
  }
  return undefined;
}
