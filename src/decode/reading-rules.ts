import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
  wordStartingAt,
} from "./rules.js";

/**
 * Whether a syllable is `děi`, the modal reading of 得.
 *
 * Compared structurally rather than by spelling it out, since a syllable is
 * stored as its parts and writing one back is the formatting stage's job.
 */
function isDei(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "d" && syllable.final === "ei" && syllable.tone === 3
  );
}

/**
 * What stands in front of a modal 得: a subject, an adverb, or a time word.
 *
 * 我得走, 你就得去, 我今天得走. The particle 得 cannot follow any of these,
 * because it attaches to the predicate it modifies — which is exactly what
 * makes this the discriminating side of the context.
 */
const SUBJECT_TAGS = new Set(["r", "d", "t"]);

/**
 * What follows a modal 得: the verb phrase it governs.
 *
 * Prepositions and adverbs are in because 我得在八月, 我得先走 and 我得快点 are
 * all modal, and what follows the 得 in each is the front of a verb phrase
 * rather than a verb.
 */
const GOVERNED_TAGS = /^(?:v|p|d|a)/u;

/**
 * 得 read as `děi` where it is a modal rather than a particle.
 *
 * One character, three readings, and the dictionary can only carry a default:
 * 得 is stored `de` — the structural particle, which is far the commonest — with
 * `dé` and `děi` as alternates. Nothing in the cost model can prefer an
 * alternate at a position no word covers, so 我得走了 came out `wǒ de zǒule`
 * and every other modal 得 with it. This is the case ROADMAP.md was waiting for
 * before building stage 4: neither harness could see it, since the gold corpus
 * had only 觉得 and CPP's 40 得 cases are labelled `dé` or `de` and never `děi`.
 *
 * The context is what separates the three, and only one side of it carries
 * information. The particle 得 always follows the verb or adjective it attaches
 * to (说得好, 跑得快, 累得要命), so a 得 with a *pronoun, adverb or time word*
 * in front of it is not that particle. Requiring a verb phrase after it as well
 * keeps 得了感冒 and 得了奖 — `dé`, and a real reading of the same character —
 * out of it.
 *
 * Conditioning on what precedes rather than on what follows was measured, not
 * assumed: "the word before is not a verb" fires 309 times over 88,866 lines of
 * Tatoeba and zh.wikipedia and is wrong about four times in five, because
 * jieba tags 下 as `f`, 学 as `n` and 飞 as nothing at all, and 雨下得很大 is a
 * particle whatever the tag says. Naming the small closed set of things that
 * can precede a modal is the same rule from the other side, and over the same
 * text it fires 126 times and is right 122: the four misses are literary 得
 * read `dé` after an adverb — 未必得喜悦, 暂得于己, 仅得约, 未得迁还家乡 —
 * which nothing short of semantics separates from 必须得承认.
 */
export const MODAL_DE: EdgeRule = {
  name: "modal-de",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.text !== "得" || !isDei(edge.reading[0])) {
      return "keep";
    }
    const before = wordEndingAt(context, edge.from);
    const after = wordStartingAt(context, edge.to);
    return SUBJECT_TAGS.has(tagOf(context, before)) &&
      GOVERNED_TAGS.test(tagOf(context, after))
      ? "force"
      : "keep";
  },
};

/**
 * 儿 does not stand on its own where the dictionary attests the 儿化.
 *
 * 儿化 is a per-word dictionary fact taken from CC-CEDICT's explicit `r5`
 * token, and 2,009 of the 2,067 keys ending in 儿 carry it. What that leaves is
 * an edge: 这边儿, 上边儿 and 旁边儿 are all listed and 那边儿 is not, so
 * 我得跑到那边儿去 read the 儿 as a syllable of its own — `nàbian ér` — and the
 * decode was choosing between 那边 plus 儿 and 那 plus 边儿 on frequency alone.
 *
 * This forbids the bare 儿 edge when the character in front of it makes an
 * attested 儿化 word, so the only paths left are the ones that absorb it. That
 * asserts nothing the dictionary does not already say — 边儿 is `biānr` because
 * CC-CEDICT says so — which is what separates it from synthesising 儿化 with a
 * suffix rule, the thing ORTHOGRAPHY.md rejects and the old project got wrong.
 *
 * Measured over the same 88,866 lines it fires 7 times, and all 7 are right:
 * 照片儿, 出门儿, 热点儿, 辣味儿, 晚会儿, 针管儿, 碍事儿. It is deliberately
 * silent on the 20 bare 儿 with no attested 儿化 behind them, which are 马儿,
 * 门铃儿 and a row of Mongol names transliterated with 儿.
 */
export const ATTESTED_ERHUA: EdgeRule = {
  name: "attested-erhua",
  verdictFor: (context: EdgeContext) => {
    const { characters, edge } = context;
    if (edge.text !== "儿" || edge.from === 0) {
      return "keep";
    }
    /* c8 ignore next -- the edge starts inside the run it was built from */
    const absorbed = `${characters[edge.from - 1] ?? ""}儿`;
    const reading = context.dictionary.lookup(absorbed)?.reading;
    return (reading?.at(-1)?.erhua ?? false) ? "forbid" : "keep";
  },
};

/**
 * Whether a syllable is `jiāo`, the verbal reading of 教.
 */
function isJiao(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "j" && syllable.final === "iao" && syllable.tone === 1
  );
}

/**
 * What a 教 that is teaching governs: the thing or the person taught.
 *
 * A pronoun, a common noun, a name or one of the tags jieba gives a subject —
 * 教我, 教英语, 教历史, 教孩子, 教玛丽. `ns` is deliberately absent, since the
 * only 教 with a place tag after it over the corpus is 教青局, an office.
 */
const TAUGHT_TAGS = new Set(["r", "n", "nz", "nr", "nt", "ng"]);

/**
 * What follows a 教 that is teaching where no object does: aspect and the
 * complement marker, which only a verb takes.
 *
 * 他教了三年书, 他教过我英语, 她教书教得很快乐. Matched as characters rather
 * than through their tags, because what the dictionary has starting at a 得 is
 * as likely to be 得很 as the particle itself.
 */
const ASPECT = new Set(["了", "过", "過", "着", "著", "得"]);

/**
 * The tag prefix jieba gives a particle, which nothing teaching can follow.
 */
const PARTICLE_TAG = "u";

/**
 * Whether the 教 at a position is teaching something to somebody.
 *
 * The object is what says so, which is the same shape the modal 得 rule takes:
 * a 教 with a pronoun, a noun or a name after it is governing it, and a 教 with
 * 了, 过, 着 or 得 after it is a verb whatever follows that. A particle in front
 * of it rules it out, since a verb does not follow one.
 */
function isTeachingAt(context: EdgeContext, at: number): boolean {
  if (tagOf(context, wordEndingAt(context, at)).startsWith(PARTICLE_TAG)) {
    return false;
  }
  return (
    ASPECT.has(context.characters[at + 1] ?? "") ||
    TAUGHT_TAGS.has(tagOf(context, wordStartingAt(context, at + 1)))
  );
}

/**
 * 教 read as `jiāo` where it is teaching rather than a religion.
 *
 * The dictionary stores 教 as `jiào` with `jiāo` as an alternate, and `jiào` is
 * right for the compounds — 教育, 教师, 宗教, 主教 — which are words and reach
 * their reading through the word. What is left is the 教 that stands as a word
 * of its own, and that one is the verb: 他在北京大学教了三年书 came out
 * `jiàole sān nián shū`, and 我教英语, 谁教你法语 and 她教我如何游泳 with it.
 * 教书 is a word and was always `jiāo shū`; nothing carried that across a 了.
 *
 * See {@link isTeachingAt} for what decides it. Forcing the single-character
 * edge is not enough on its own, because a reading spanning two characters
 * carries its own 教 into the position: 王老师教我们汉语 read `jiào` off 师教,
 * and 来教我 off 来教. Those are pairs the dictionary holds with no part of
 * speech and at the cost of a word nothing has ever counted — a reading rather
 * than a word — so a *tagged* word ending in 教 is left alone, which is every
 * one that matters: 任教, 宗教, 主教, 佛教, 传教, 执教, 请教, 家教.
 *
 * Measured over 88,866 lines of Tatoeba and zh.wikipedia, 181 教 decode as a
 * word of their own and every one of them read `jiào`. This moves 158 to
 * `jiāo` and is wrong on three: 统一教创始人, 方法教深思 and 做到了教政分离,
 * where a nominal compound takes an object's shape, the last of them because
 * 做到了 is a word and so the 了 in front is not a particle to look at. Of the
 * 21 it leaves, 8 are right — 诸教中, 教外别传, 董教总, 风教, 教青局 twice, a
 * 教室 reached through a bad split, and a 教 used as a bare noun — and 13 are
 * misses, where jieba tags the object something this does not name.
 */
export const TEACHING_JIAO: EdgeRule = {
  name: "teaching-jiao",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.text === "教") {
      return isJiao(edge.reading[0]) && isTeachingAt(context, edge.from)
        ? "force"
        : "keep";
    }
    return edge.partOfSpeech === "" &&
      edge.text.endsWith("教") &&
      edge.reading.length === edge.to - edge.from &&
      !isJiao(edge.reading.at(-1)) &&
      isTeachingAt(context, edge.to - 1)
      ? "forbid"
      : "keep";
  },
};

/**
 * The tag the dictionary gives a 量词.
 */
const MEASURE = "q";

/**
 * The mark that makes the number after it a position rather than a count.
 *
 * 第三集团军 is the Third Army Group and not three 集团军, so the 集 the
 * dictionary tags `q` is counting nothing and 集团军 is a word like any other.
 */
const ORDINAL = "第";

/**
 * Where the number counting the character at a position starts, or undefined
 * where nothing counts it.
 *
 * Two things stop a numeral in front of a 量词 from counting it. An ordinal
 * names a position, so 第十级别 is the tenth 级别 rather than ten 级; and a
 * numeral inside a longer word belongs to that word, so the 一 of 唯一道路 is
 * counting no 道 and the 二 of 十二月 no 月.
 */
function countedFrom(context: EdgeContext, at: number): number | undefined {
  const { characters } = context;
  let from = at;
  while (from > 0 && QUANTITY_CHARACTERS.has(characters[from - 1] ?? "")) {
    from--;
  }
  if (from === at || characters[from - 1] === ORDINAL) {
    return undefined;
  }
  const before = wordEndingAt(context, at);
  const held = before === undefined ? at : at - toCharacters(before).length;
  return held < from ? undefined : from;
}

/**
 * A 量词 with a number in front of it does not start the next word.
 *
 * 三个人 is three people and came out `sān gèrén`, three *personals*, because
 * 个人 is a common noun and nothing weighed it against the 个 belonging to the
 * 三 in front of it. The same swallow takes 一杯水 into 杯水, 两家俱乐部 into
 * 家俱 and 一天天 into 天天; digits reach it too, since a run decoded after a
 * number sees that number — see `decodeRun` — so 2个人 is the same case.
 *
 * What makes it decidable is that the dictionary tags the 量词: 个, 次, 天, 位,
 * 杯 and 匹 are `q`, while the characters that only look like measure words in
 * this position are not — 分 is `v`, 部 and 成 are `n`, 年 and 点 are `m`. So
 * 五分钟, 三部分, 五成分, 五年级 and 三点钟 are untouched, and those are exactly
 * the words a blanket rule would break. A word that is itself a 量词 is kept as
 * well, since 分钟 and 点钟 are units rather than something being counted.
 *
 * Only the edge *starting at the 量词* is forbidden, so a number and its
 * measure written solid survive whole where the dictionary has them: 一辈子 and
 * 一会儿 are entries covering the number too, and the decode still reaches them.
 *
 * Measured over the same 88,866 lines of Tatoeba and zh.wikipedia the other
 * rules were sized against, it forbids 561 edges across 144 shapes — 个人 203
 * of them, then 杯水, 天一, 口气, 些小 and 家人 — and moves 53 decodes, since
 * most of what it takes away the cost model was not going to choose anyway.
 * Three of the 53 are wrong: 一批评, 这一名词 and 六七股灾, where the 一 and the
 * 六七 count nothing and no tag says so. Exactly one reading changes over the
 * corpus and it is a fix, 下了两天雨 having read 天雨 as `tiān yù`.
 */
export const COUNTED_MEASURE: EdgeRule = {
  name: "counted-measure",
  verdictFor: (context: EdgeContext) => {
    const { characters, edge } = context;
    // A reading of a different length from its span says something about how
    // the characters are read rather than only about where they break: 份儿 is
    // `fènr` over two characters, and taking the edge away would take the 儿化
    // with it.
    if (
      edge.to - edge.from < 2 ||
      edge.reading.length !== edge.to - edge.from
    ) {
      return "keep";
    }
    const counted = countedFrom(context, edge.from);
    if (counted === undefined) {
      return "keep";
    }
    return tagOf(context, characters[edge.from]) === MEASURE &&
      edge.partOfSpeech !== MEASURE
      ? "forbid"
      : "keep";
  },
};

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

/**
 * The rules the lattice decode applies, in order.
 */
export const READING_RULES: readonly EdgeRule[] = [
  MODAL_DE,
  TEACHING_JIAO,
  ATTESTED_ERHUA,
  COUNTED_MEASURE,
  ADJECTIVAL_CHANG,
];
