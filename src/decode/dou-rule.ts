/**
 * The 都 that is the adverb *all*, read into a place name in front of it.
 *
 * 花都 is a district of Guangzhou, `Huādū`, and the dictionary holds it as a
 * proper noun. In running text it is nearly always 花 *flowers* and 都 *all*:
 * 花都开了, 公园里的花都开了, 所有的花都是纸做的. The decode read the name,
 * capital and `dū` included.
 */
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordStartingAt,
} from "./rules.js";

/**
 * The place names whose first character is a common noun that 都 can sum up.
 */
const NAMES = new Set(["花都"]);

/**
 * The tag prefix jieba gives a noun.
 */
const NOUN_TAG = "n";

/**
 * 花都 is taken apart where no noun follows it.
 *
 * The district names what it holds: 花都区, 花都机场. Where a verb, an
 * adverb, a 是 or the end of the run follows, the 都 is the adverb and sums up
 * the flowers. Taking the edge away leaves 花 and 都 to read as themselves,
 * `huā dōu`.
 *
 * Over the 139,893 distinct Han runs of Tatoeba and the Chinese Boost example
 * sentences, the decode read 花都 as the name in 11 runs, and none of them was
 * the district.
 */
export const SUMMING_DOU: EdgeRule = {
  name: "summing-dou",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    return NAMES.has(edge.text) &&
      !tagOf(context, wordStartingAt(context, edge.to)).startsWith(NOUN_TAG)
      ? "forbid"
      : "keep";
  },
};
