/**
 * The proper noun that is really a number and the 量词 counting with it.
 *
 * 三本 is a Japanese surname and 堵墙 a place, and jieba tags both as names
 * (`ns` and `nr`). In running text they are 三本书 (three books) and 一堵墙 (a
 * wall), and the decode read them as one word: `sānběn shū`, `yì dǔqiáng`.
 * {@link import("./measure-rule.js").COUNTED_MEASURE} keeps a counted 量词
 * out of the next word, and it finds the 量词 by its tag. 本 is tagged `r` and
 * 堵 `v`, so it never sees these two.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { type EdgeContext, type EdgeRule, wordStartingAt } from "./rules.js";

/**
 * The tags jieba gives a person, a place and another proper name.
 *
 * Asked as well as the proper-noun flag, because a word only jieba tags as a
 * name keeps the tag and loses the flag.
 */
const NAME_TAG = /^n[rsz]/u;

/**
 * The 量词 the dictionary does not tag `q` and a proper noun has taken in.
 *
 * Kept to the two the corpus shows. The untagged 量词 are many (条, 件, 只 and
 * 块 among them), and a wider set would reach names such as 四川, whose 川 is
 * no 量词 at all.
 */
const UNTAGGED_MEASURES = new Set(["本", "堵"]);

/**
 * The titles that follow a surname, in both scripts.
 *
 * 三本先生 is Mr Sanbon, and a title after the name says the name is meant.
 */
const TITLES = new Set([
  "先生",
  "小姐",
  "女士",
  "太太",
  "老师",
  "老師",
  "同学",
  "同學",
]);

/**
 * Whether a character is a numeral, or 几 asking how many.
 */
function isNumeral(character: string | undefined): boolean {
  return (
    character !== undefined &&
    (QUANTITY_CHARACTERS.has(character) ||
      character === "几" ||
      character === "幾")
  );
}

/**
 * A proper noun is taken apart where its 量词 is counting with a number.
 *
 * Two shapes are caught. The name starts with the number and the 量词 follows
 * (三本书, 五本书) and no title follows, or the name starts with the 量词 and the
 * number is just in front of it (一堵墙). Taking the edge away leaves each
 * character to read as itself, and the spacing follows the count.
 *
 * Over the 139,893 distinct Han runs of Tatoeba and the Chinese Boost example
 * sentences, the rule changes 13 runs, 9 of them 三本 and 4 堵墙, and each one
 * is a count.
 */
export const COUNTED_NAME: EdgeRule = {
  name: "counted-name",
  verdictFor: (context: EdgeContext) => {
    const { characters, edge } = context;
    if (!edge.isProperNoun && !NAME_TAG.test(edge.partOfSpeech)) {
      return "keep";
    }
    const first = characters[edge.from];
    const second = characters[edge.from + 1];
    const startsWithCount =
      isNumeral(first) &&
      UNTAGGED_MEASURES.has(second ?? "") &&
      !TITLES.has(wordStartingAt(context, edge.to) ?? "");
    const followsCount =
      UNTAGGED_MEASURES.has(first ?? "") &&
      isNumeral(characters[edge.from - 1]);
    return startsWithCount || followsCount ? "forbid" : "keep";
  },
};
