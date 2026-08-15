import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { TEACHING_JIAO } from "./jiao-rule.js";

export { TEACHING_JIAO } from "./jiao-rule.js";
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

import { ADJECTIVAL_CHANG, PLAYING_TAN } from "./polyphone-rules.js";

export { ADJECTIVAL_CHANG, PLAYING_TAN } from "./polyphone-rules.js";

/**
 * The rules the lattice decode applies, in order.
 */
export const READING_RULES: readonly EdgeRule[] = [
  MODAL_DE,
  TEACHING_JIAO,
  ATTESTED_ERHUA,
  COUNTED_MEASURE,
  ADJECTIVAL_CHANG,
  PLAYING_TAN,
];
