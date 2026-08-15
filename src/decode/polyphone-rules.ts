/**
 * The rules that settle a polyphone from the words around it.
 *
 * 长 is `cháng` or `zhǎng` and 弹 is `tán` or `dàn`, and which one a text means
 * is a question about the neighbours rather than about the character. The
 * other rules in `reading-rules.ts` are about particles and 儿化, which is a
 * different kind of evidence.
 */
import type { Syllable } from "../syllable/syllable.js";

export { PLAYING_TAN } from "./tan-rule.js";
import { type EdgeContext, type EdgeRule, wordEndingAt } from "./rules.js";

/**
 * Whether a syllable is `cháng`, the stative reading of 长.
 */
function isChang(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "ch" &&
    syllable.final === "ang" &&
    syllable.tone === 2
  );
}

/**
 * Adverbs that measure a quality rather than modify an action.
 *
 * The discriminating side of the 长 context, and the reason the set is written
 * out rather than taken from a tag: jieba calls 很 `zg` and 多 `m`, so the two
 * commonest members are not adverbs as far as the dictionary is concerned,
 * while 已经, 也, 却 and 就 — which sit in front of the *verb* 长 — are `d`
 * along with the ones wanted here. The tag names the wrong set in both
 * directions, so the set is named directly.
 *
 * Everything here is degree or comparison. 还 and 不 are deliberately absent
 * even though 距离还长 and 那座桥不长 are both `cháng`: they modify verbs as
 * readily as qualities, and 还长有毛 and 胡子不长在前额上 are the same two
 * characters around the verb.
 */
const DEGREE = new Set([
  "一样",
  "十分",
  "多",
  "多么",
  "好",
  "如此",
  "尽量",
  "很",
  "格外",
  "极",
  "极其",
  "比较",
  "略",
  "相当",
  "真",
  "稍",
  "稍微",
  "越",
  "越来越",
  "这么",
  "这样",
  "那么",
  "那样",
  "更",
  "最",
  "有多",
  "特别",
  "老",
  "够",
  "挺",
  "太",
  "非常",
]);

/**
 * What shows a 长 to be growing even with a degree word in front of it.
 *
 * {@link DEGREE} already excludes nearly everything that precedes the verb, so
 * this only has to settle the three shapes reachable from both sets: 真长得很快
 * and 越长得快, where 得 marks the complement; 长着, where the aspect does; and
 * 越长越高, where the correlative makes the 长 the thing that increases.
 *
 * 了 and 的 are pointedly *not* here, and that is the whole use of conditioning
 * on the adverb first. Following a bare 长 either would suggest the verb — 长了
 * 一个大包, 长的很像 — but following an adverb and a 长 they are the sentence
 * particle and the attributive: 时间太长了 and 很长的道路 are both `cháng`, and
 * an earlier draft of this rule that guarded on them read both as `zhǎng`.
 */
const GROWING = new Set(["得", "着", "越"]);

/**
 * What growing produces, as the far half of 越长越X.
 *
 * 越长越高, 越长越大, 越长越胖: each names a dimension that increases *because*
 * something grew, so the 长 in front of it is the verb. The adjectives that go
 * with a length or a duration are pointedly absent — 时间越长越好, 队伍越长越慢
 * — because those are the cases the sources already read correctly.
 */
const GROWN_INTO = new Set(["高", "大", "胖", "壮", "结实"]);

/**
 * Whether an edge is the 越长 of a 越长越X saying something grew.
 *
 * This exists because of a defect in the sources rather than a gap in them.
 * 越长 is a key, read `yuè cháng`, and it is the *only* one of its shape: 越大,
 * 越高, 越好, 越快 and 越多 are all absent, so 越高越好 decodes as two words and
 * 越长越高 reaches for a word nothing else in the paradigm has. It carries no
 * part of speech, which is how the dictionary holds a reading somebody asserted
 * rather than a word anybody counted — the same category {@link TEACHING_JIAO}
 * declines to trust — and it comes from one source, `large_pinyin.txt`, with
 * CC-CEDICT holding no such entry.
 *
 * Taking the edge away leaves the character's own default, which is `zhǎng`,
 * and leaves `cháng` standing as a rival about one bucket dearer. That last
 * part is the point of forbidding rather than forcing: 越长越X is genuinely
 * ambiguous — 孩子越长越漂亮 grows and 头发越长越漂亮 lengthens, and only the
 * subject says which — so the decode should answer with the likelier reading
 * and still report itself as guessing. A forced edge could not.
 *
 * Unlike the rest of this file the shape has no corpus behind it: 越长 occurs
 * three times in the 88,866 lines, and all three are 越来越长 or 说的越长. The
 * word list is therefore small on purpose, and everything outside it is left as
 * the sources have it.
 */
function isGrowthCorrelative(context: EdgeContext): boolean {
  const { characters, edge } = context;
  return (
    edge.text === "越长" &&
    edge.partOfSpeech === "" &&
    characters[edge.to] === "越" &&
    GROWN_INTO.has(characters[edge.to + 1] ?? "")
  );
}

/**
 * 长 read as `cháng` where an adverb of degree measures it.
 *
 * The character is stored `zhǎng` with `cháng` as an alternate, and the data
 * says so about the character in isolation: Unihan ranks the readings
 * `zhǎng(1879) cháng(1179)` by corpus count and names `zhǎng` in `kMandarin`.
 * That ranking is doing real work — 署长, 团长, 公安局长, 总会长, 审理长 and
 * the rest reach a bare 长 at the end of a title and read it correctly — so the
 * default is not the thing to change. What is left over is the 长 that is an
 * adjective, and nothing in the cost model can prefer an alternate at a
 * position no word covers: 这篇文章不太长 came out `bú tài zhǎng`.
 *
 * The context that separates them is one-sided, as it was for the modal 得. A
 * 长 that is *growing* is a verb, and a degree adverb cannot modify one — there
 * is no 很长 meaning it grew a lot — so 很, 太, 最, 多 and their kin in front of
 * a bare 长 make it the adjective. The other side carries almost nothing: what
 * follows an adjectival 长 is a noun (很长时间), a particle (最长的大桥), or the
 * end of the sentence (他的腿很长), which is also what follows half the verbs.
 *
 * Measured over the same 88,866 lines of Tatoeba and zh.wikipedia the other
 * rules were sized against, 260 长 decode as a word of their own and this moves
 * 75 of them to `cháng`, all 75 correctly. On CPP's 40 hand-labelled 长 it takes
 * the character from 85.00% to 87.50%, fixing 时间最长 and breaking nothing.
 *
 * The other half of the rule is {@link GROWN_INTO}, which pushes the opposite
 * way on the one shape the sources get wrong.
 */
export const ADJECTIVAL_CHANG: EdgeRule = {
  name: "adjectival-chang",
  verdictFor: (context: EdgeContext) => {
    const { characters, edge } = context;
    if (isGrowthCorrelative(context)) {
      return "forbid";
    }
    if (edge.text !== "长" || !isChang(edge.reading[0])) {
      return "keep";
    }
    if (GROWING.has(characters[edge.to] ?? "")) {
      return "keep";
    }
    const before = wordEndingAt(context, edge.from);
    return before !== undefined && DEGREE.has(before) ? "force" : "keep";
  },
};
