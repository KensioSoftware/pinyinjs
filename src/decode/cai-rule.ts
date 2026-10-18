/**
 * The 才能 that is 才 *only then* and 能 *can*, and not the noun *talent*.
 *
 * 才能 is a word, *talent* or *ability*, and every source counts it. The same
 * two characters are far more often the adverb 才 and the modal 能 in front of
 * a verb: 怎样才能提高爆发力, 必须先完成这件事才能回家, 到北方才能吃到真正的饺子.
 * The decode read every one of them as the noun.
 */
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordsEndingAt,
  wordsStartingAt,
} from "./rules.js";

/**
 * The word, in both scripts.
 */
const TALENT = new Set(["才能"]);

/**
 * The characters that close a word in front of the noun.
 *
 * 的 makes 才能 something owned or described (他的才能, 一定的才能), and 有 is
 * having it (有才能, 富有才能, 具有才能, 很有才能). 才 and 能 can follow neither.
 */
const BEFORE_NOUN = new Set(["的", "有"]);

/**
 * What can follow the noun and not the modal.
 *
 * 能 needs a verb after it, so a 的 (有才能的人) or the end of the run (你很有才能,
 * 她具有卓越才能) leaves it nothing to be the modal of. A 是 or a degree word
 * says something about the talent (音乐才能是可以培养的, 她的唱歌才能非常出众).
 */
const AFTER_NOUN = new Set(["的", "是", "很", "非常", "十分"]);

/**
 * Whether a longer word ends at the 才, and would take it once 才能 is gone.
 *
 * 处方才能买 is 处方 and then 才能, and taking the edge away let 方才 *just
 * now* take the 才, reading 处方 as `chù fāng`. 刚才能 and 人才能 have the same
 * shape. Which word the 才 belongs to there is a question this rule cannot
 * answer, so it leaves the decode as it was. Only a tagged word counts, since
 * the full tier holds untagged keys such as 时才 that no decode would choose.
 */
function isClaimed(context: EdgeContext, from: number): boolean {
  return wordsEndingAt(context, from + 1).some(
    (word) => word.length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * Whether the context at a 才能 says it is the noun.
 */
function isNoun(context: EdgeContext, from: number, to: number): boolean {
  if (
    wordsEndingAt(context, from).some((word) =>
      BEFORE_NOUN.has(word.at(-1) ?? ""),
    )
  ) {
    return true;
  }
  // Every word starting there is asked, since the longest hides the one the
  // rule is looking for: 音乐才能是否可以培养 has 是否 wrapped around its 是.
  const next = wordsStartingAt(context, to);
  return next.length === 0 || next.some((word) => AFTER_NOUN.has(word));
}

/**
 * 才能 is taken apart where a verb is left for 能 to be the modal of.
 *
 * The noun is kept after a 的 or a 有, and before a 的, a 是, a degree word or
 * the end of the run.
 * Everywhere else the 才 is the adverb and the 能 the modal. Taking the edge
 * away leaves the two to read as themselves. The readings are `cái néng`
 * either way, so this changes the segmentation and the spacing.
 *
 * Over the 139,893 distinct Han runs of Tatoeba and the Chinese Boost example
 * sentences, the decode read 才能 as the word in 184 runs. The rule splits 164,
 * and one of them is wrong: 他的钢琴才能为他在音乐专家中赢得了美名 is talent before a
 * 为 that reads like a verb.
 */
export const MODAL_CAI: EdgeRule = {
  name: "modal-cai",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    return TALENT.has(edge.text) &&
      !isClaimed(context, edge.from) &&
      !isNoun(context, edge.from, edge.to)
      ? "forbid"
      : "keep";
  },
};
