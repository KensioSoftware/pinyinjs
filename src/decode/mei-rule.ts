/**
 * The 美的 that is an adjective and its 的, and not the brand.
 *
 * 美的 is a word, the name of the appliance maker read `Měidí`, and the
 * dictionary holds it as a proper noun. The same two characters are far more
 * often 美 *beautiful* and the particle after it: 最美的姑娘, 很美的动物, 多美的日出.
 * The decode took the name every time, so a learner's sentence about a
 * sunrise came out with a capitalised `Měidí` in it.
 */
import { type EdgeContext, type EdgeRule, wordsEndingAt } from "./rules.js";

/**
 * The word, in both scripts.
 */
const BRAND = new Set(["美的"]);

/**
 * The words that grade or assert an adjective, in both scripts.
 *
 * Each one says something about how beautiful a thing is, or that it is, and a
 * company name takes neither: 最美的, 非常美的, 这么美的, 是美的. 多 is in for
 * 多美的日出啊, the exclamation.
 */
const DEGREE = new Set([
  "最",
  "很",
  "更",
  "太",
  "真",
  "挺",
  "多",
  "多么",
  "多麼",
  "非常",
  "十分",
  "特别",
  "特別",
  "极其",
  "極其",
  "比较",
  "比較",
  "相当",
  "相當",
  "如此",
  "这么",
  "這麼",
  "那么",
  "那麼",
  "这样",
  "這樣",
  "那样",
  "那樣",
  "是",
]);

/**
 * 美的 is taken apart where a degree word or a 是 grades it.
 *
 * Taking the edge away leaves 美 and 的 to read as themselves, `měi de`, which
 * is the reading as well as the spacing: the name's 的 is `dí`.
 *
 * Over the 139,893 distinct Han runs of Tatoeba and the Chinese Boost example
 * sentences, the decode read 美的 as the name in 28 runs and none of them was
 * the company.
 */
export const ADJECTIVAL_MEI: EdgeRule = {
  name: "adjectival-mei",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    return BRAND.has(edge.text) &&
      wordsEndingAt(context, edge.from, 2).some((word) => DEGREE.has(word))
      ? "forbid"
      : "keep";
  },
};
