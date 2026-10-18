/**
 * The reading rule for 着 where it is the result of a potential complement.
 */
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { LEXICAL_STEMS } from "./liao-frames.js";
import {
  type EdgeContext,
  type EdgeRule,
  endsLongerWord,
  startsLongerWord,
  tagOf,
  wordEndingAt,
  wordsStartingAt,
} from "./rules.js";

/** The character, in both scripts. */
const ZHE = new Set(["着", "著"]);

/**
 * What stands between the verb and the 着: 睡不着 and 用得着.
 */
const MARKERS = new Set(["不", "得"]);

/**
 * Verbs that take 不着 and 得着 but that jieba tags as something else.
 *
 * 用 is tagged `p`, 够 and 轮 `zg` and 等 `u`, and 用不着, 够不着, 轮不着 and
 * 等不着 are as common as any.
 */
const UNTAGGED_VERBS = new Set(toCharacters("用够夠轮輪等"));

/**
 * Whether a syllable is `zháo`, the reading 着 takes as a result.
 */
function isZhao(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "zh" && syllable.final === "ao" && syllable.tone === 2
  );
}

/**
 * Whether a word can take 着 as its result.
 */
function isVerb(context: EdgeContext, word: string | undefined): boolean {
  return (
    word !== undefined &&
    (tagOf(context, word).startsWith("v") || UNTAGGED_VERBS.has(word))
  );
}

/**
 * Whether the 着 at a position closes a verb, then 不 or 得.
 *
 * The 不 or 得 has to stand alone, which keeps 取得着 and 获得着, where the 着
 * is aspect on a verb ending in 得. The core tier has no words to say so, and
 * the verbs the 了 rule lists as making a word with 得 stand in for them. The 着 has to stand alone too, which keeps
 * 不着急 and 着凉, and no longer word may start at the 不, which keeps
 * 说话不着边际 `bù zhuó`.
 */
function isResultAt(context: EdgeContext, at: number): boolean {
  const marker = at - 1;
  if (
    !MARKERS.has(context.characters[marker] ?? "") ||
    startsLongerWord(context, at) ||
    endsLongerWord(context, at) ||
    (context.characters[marker] === "得" &&
      LEXICAL_STEMS.has(context.characters[marker - 1] ?? "")) ||
    wordsStartingAt(context, marker).some(
      (word) => toCharacters(word).length > 2,
    )
  ) {
    return false;
  }
  return isVerb(context, wordEndingAt(context, marker));
}

/**
 * 着 read `zháo` where it closes a potential complement after a verb.
 *
 * 着 is stored `zhe`, the aspect particle, with `zháo`, `zhuó` and `zhāo` as
 * alternates. The full tier holds 不着 as a word read `bù zháo`, which is how
 * 睡不着 came out right there. The standard and core tiers do not hold it, so
 * 他着急得睡不着 came out `shuì bù zhe` in both. 用得着 has no word in any tier,
 * and came out `yòng de zhe` in the standard tier.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia the rule moves 28 decodes in
 * the standard tier and 35 in the core tier, and all of them are corrections:
 * 睡不着觉, 找不著提姆, 用不着客气, 这谁管得着. The full tier moves none, since
 * 不着 already reads `zháo` there. No sentence in either CPP split moves.
 */
export const RESULTATIVE_ZHAO: EdgeRule = {
  name: "resultative-zhao",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (
      edge.to - edge.from !== 1 ||
      !ZHE.has(edge.text) ||
      !isZhao(edge.reading[0])
    ) {
      return "keep";
    }
    return isResultAt(context, edge.from) ? "force" : "keep";
  },
};
