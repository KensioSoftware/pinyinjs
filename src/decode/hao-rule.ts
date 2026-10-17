/**
 * Whether a 好学 is studious or is easy to learn.
 *
 * The dictionary holds 好学 as `hào xué`, *studious*, the sense jieba counted.
 * CC-CEDICT also gives `hǎo xué`, *easy to learn*, and the merge kept the
 * first. What decides between them is what the 好学 is said of.
 */
import { toCharacters } from "../script/characters.js";
import { type EdgeContext, type EdgeRule, wordsEndingAt } from "./rules.js";

/**
 * The word, in both scripts.
 */
const STUDIOUS = new Set(["好学", "好學"]);

/**
 * The characters that close the name of a language.
 *
 * 德语, 法语, 拉丁语, 中文 and 英文. A language is learned and cannot be
 * studious, so the 好学 after one is easy to learn.
 */
const LANGUAGE_ENDINGS = new Set(["语", "語", "文"]);

/**
 * The character a reduplicated 好好 repeats.
 */
const GOOD = "好";

/**
 * Whether the 好学 starting at a position is said of a language, or is the
 * second 好 of 好好.
 *
 * 只要你好好学中文 has 好好 and then 学. A 好 in front of the 好学 belongs to
 * the first 好, and the pair would read it `hǎohào xué`.
 */
function isEasyToLearnAt(context: EdgeContext, at: number): boolean {
  if (context.characters[at - 1] === GOOD) {
    return true;
  }
  return wordsEndingAt(context, at).some(
    (word) =>
      toCharacters(word).length > 1 &&
      LANGUAGE_ENDINGS.has(toCharacters(word).at(-1) ?? ""),
  );
}

/**
 * 好学 taken apart where it means easy to learn.
 *
 * 德语好学吗 and 法语好学吗 came out `hào xué`, asking whether German is
 * studious. Taking the edge away leaves 好 and 学 to their own readings,
 * `hǎo` and `xué`. 聪明好学, 勤而好学 and 沉静好学 are said of a person and
 * keep the word.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia this changes 5 readings in the
 * full tier and 3 in the standard tier, and all are corrections: 德语好学吗,
 * 義大利語好學嗎 and 只要你好好学中文 among them. Nothing moves in the core tier
 * or on either CPP split.
 */
export const EASY_HAO: EdgeRule = {
  name: "easy-hao",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    return STUDIOUS.has(edge.text) && isEasyToLearnAt(context, edge.from)
      ? "forbid"
      : "keep";
  },
};
