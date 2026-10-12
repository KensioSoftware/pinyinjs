/**
 * The reading rule for 只 where it is a measure word.
 */
import type { EdgeContext, EdgeRule, EdgeVerdict } from "./rules.js";
import { isMeasureAt, isZhi } from "./zhi-frames.js";

/**
 * 只 read `zhī` where a number or a demonstrative counts it.
 *
 * The character is stored `zhǐ` with `zhī` as an alternate, so 三只猫 came out
 * `sān zhǐ māo`. 一只 and 几只 are words in the standard and full tiers and
 * read `zhī` through the word. No other counted 只 has an entry.
 *
 * After a number the measure word is the reading whatever follows. 另外两只是
 * 母的 is "the other two are female", so the 只是 edge is taken off the
 * lattice there, along with any other edge reading the 只 `zhǐ`. After 这, 那
 * and 哪 the adverb is the commoner sense, and the rule waits for a noun or an
 * adjective (see `isDemonstratedAt` in `zhi-frames.ts`).
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia and both CPP splits, the rule
 * moves 119 decodes in the full tier, 126 in the standard tier and 262 in the
 * core tier (which holds no 一只). All of them are measure words, except 后半只计
 * in the standard and core tiers and 凡百只务实行 in the core tier, where no
 * word claims the numeral. It misses 这只表多少钱 and 这只维卡, where the next
 * word is tagged a verb. None of CPP's 39 labelled 只 moves.
 */
export const COUNTING_ZHI: EdgeRule = {
  name: "counting-zhi",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.reading.length !== edge.to - edge.from) {
      return "keep";
    }
    let verdict: EdgeVerdict = "keep";
    for (let at = edge.from; at < edge.to; at++) {
      if (!isMeasureAt(context, at)) {
        continue;
      }
      if (!isZhi(edge.reading[at - edge.from])) {
        return "forbid";
      }
      if (edge.to - edge.from === 1) {
        verdict = "force";
      }
    }
    return verdict;
  },
};
