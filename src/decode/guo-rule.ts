/**
 * Whether a 过 is the experiential aspect marker or a verb of its own.
 *
 * The marker is toneless and the verb is `guò`, and the word in front is the
 * evidence, since only a verb takes aspect.
 */
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordsEndingAt,
} from "./rules.js";

/**
 * The two characters the experiential marker is written with.
 *
 * 過 is the 繁體 form and carries the same three readings, so both have to be
 * named. The 长 rule gives the reason at length.
 */
const MARKER = new Set(["过", "過"]);

/**
 * The tag prefix jieba gives a verb. Only a verb takes aspect.
 *
 * A prefix, so that `vn`, `vd` and `vi` are in. 检查过了 and 工作过 are the
 * shape, and jieba tags 检查 `vn`.
 */
const VERB_TAG = "v";

/**
 * Whether a syllable is toneless `guo`, the reading the marker takes.
 */
function isGuo(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "g" && syllable.final === "uo" && syllable.tone === 5
  );
}

/**
 * Whether a verb ends at a position.
 *
 * Every word ending there is asked, and not only the longest, for the reason
 * {@link wordsEndingAt} gives. 前去 is a time word and hides the 去 inside it,
 * so 我以前去过这家店 saw a `t` where the verb was, and 我去 is a pair the
 * dictionary holds with no part of speech at all and hid the same 去 in 我去過
 * 巴黎.
 */
function isVerbEndingAt(context: EdgeContext, at: number): boolean {
  return wordsEndingAt(context, at).some((word) =>
    tagOf(context, word).startsWith(VERB_TAG),
  );
}

/**
 * Whether a pair the dictionary holds carries a fourth-tone 过 into a marker's
 * position.
 *
 * Forcing the single-character edge settles nothing on its own, since a reading
 * spanning two characters brings its own 过 with it. 我从没见过风车 read `guò`
 * off 见过 and 你已經吃過飯了 off 吃過飯, and 期望过高, 说过话 and 洗过车 each
 * reached the same reading from one side or the other.
 *
 * Only a pair is asked, and only one holding a syllable for each of its
 * characters. A three-character key is a word in its own right and keeps its
 * 过 (睡过头, 过马路, 反应过度), where a pair spanning the marker and its
 * neighbour is a reading somebody recorded rather than a word anybody counted.
 */
function carriesGuo(context: EdgeContext, edge: EdgeContext["edge"]): boolean {
  if (edge.to - edge.from !== 2 || edge.reading.length !== 2) {
    return false;
  }
  return toCharacters(edge.text).some(
    (character, offset) =>
      MARKER.has(character) &&
      !isGuo(edge.reading[offset]) &&
      isVerbEndingAt(context, edge.from + offset),
  );
}

/**
 * 过 read toneless where it marks experiential aspect.
 *
 * 他去过法国 came out `qùguò`, and 我吃过饭了, 你去过京都吗 and every 见过,
 * 听说过 and 工作过 with them. The dictionary already holds the toneless
 * reading as an alternate of `guò` and the lattice already offers the edge, and
 * nothing new is asserted here. What was missing is a preference, since the
 * cost model has no way to reach one alternate of a character over another at
 * a position no word covers. {@link MODAL_DE} was written for the same
 * position.
 *
 * The word in front decides it. Aspect attaches to a verb and to nothing else.
 * A 过 with a verbal word ending immediately before it is the marker (去过,
 * 吃过, 听说过, 告诉过, 工作过). The far side is silent, because an object, a
 * 了, a 吗 and the end of the sentence all follow the marker as readily as they
 * follow the verb 过. See {@link carriesGuo} for the pairs that carry a `guò`
 * past a forced edge.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia, 1,437 过 and 過 decode as a
 * word of their own and every one of them reads `guò`. This moves 1,002 of
 * them, and 29 more that no boundary had split out. Sized before it was
 * written, the condition holds for 998 of the 1,437 and is right on 939. The
 * 59 misses fall into five groups. 38 hand the 过 to a directional or
 * resultative complement (他游过了河, 一隻老鼠跑過房間, 他们转过身, 我坐过站了,
 * 回過神來). 14 are 过 as a verb behind a modal or an adverb (我們才能過比較好
 * 的日子, 你要過聖誕節了嗎, 也许他不回去过春节). 4 are 过 meaning to exceed
 * (期望过高 twice, 分享过多私人信息, 大象能活过一百岁). 2 belong to the word
 * after (设置过马路警察, 提供过海巴士服务). One is the noun (忘功不忘過).
 *
 * 26 of the 998 keep their `guò` anyway, held by a word jieba counted and
 * tagged. {@link TEACHING_JIAO} draws the same line. 打过 accounts for 12 of
 * them, 过话 for 9 and 考过 for 2. All but 我坐过站了 were right already.
 *
 * The condition is deliberately no narrower, and four ways of tightening it
 * were measured over the same lines. Excluding a modal in front gives up 32
 * firings to catch 10 misses, 想过 being the marker in all 22 of its own.
 * Excluding a single-character adjective after gives up 4 to catch 2, the
 * others being 见过胖的纯素食者 and 见过新来的那货. Excluding a 了 after gives
 * up 45 to catch 11, most of the 45 being 我吃过了 and 我说过了. The fourth
 * pays and is rejected all the same. A written-out set of the verbs that take
 * a crossing 过 (游, 跑, 跃, 转, 吹, 滑, 跳, 擦, 逃, 拉, 扔, 躲) gives up 28
 * firings to catch 26, which would take the rule from 94% right to 96%. Those
 * verbs take the marker too, and the corpus is thin on the sentences where they
 * do. 我在这个泳池里游过泳 and 但我從没游過泳 are the whole of the measured
 * cost, while 跑过马拉松 and 跳过舞 are absent from it and would break. The
 * crossings the set catches are a gap in the dictionary rather than a fact
 * about the grammar, since 走过, 穿过, 越过 and 度过 are keys tagged `v` and no
 * bare 过 ever stands where they do.
 *
 * Taking a pair off the lattice moves a boundary as well as a reading, and it
 * does so in 48 runs. 30 of those are corrections to both (你洗過車子了嗎 was
 * `xǐ guòchē zǐ`, 我曾經想過當個護士嗎 was `xiǎng guòdàng`, 只是校服过时了 was
 * `guò shí`). 4 are the cost. 懷有過高的期望 loses its 过高, and 有过来往,
 * 沒再見過她 and 只見過他一次 keep their syllables and lose a word boundary to
 * 过来, 再见 and 只见.
 *
 * The 439 bare 过 the condition declines hold a good deal of the marker, and
 * one cause accounts for most of them. jieba's tags are keyed on 简体, so 聽
 * and 讀 carry no tag at all and 說, 來, 問 and 學 come back `zg`. That gap is
 * not this rule's to close.
 */
export const EXPERIENTIAL_GUO: EdgeRule = {
  name: "experiential-guo",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (MARKER.has(edge.text)) {
      return isGuo(edge.reading[0]) && isVerbEndingAt(context, edge.from)
        ? "force"
        : "keep";
    }
    return edge.partOfSpeech === "" && carriesGuo(context, edge)
      ? "forbid"
      : "keep";
  },
};
