/**
 * The rules about words that begin at an aspect particle or at the adverbial
 * 地.
 *
 * {@link import("./de-rule.js").PARTICLE_DE} and
 * {@link import("./complement-rule.js").COMPLEMENT_DE} settle the same fault for 的 and
 * 得: the full tier keeps keys no source tagged, many of them from the phrase
 * corpus, and one that starts at a particle reads that particle as whatever it
 * is at the head of a phrase.
 */
import { toCharacters } from "../script/characters.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
} from "./rules.js";

/**
 * Whether an edge is a word of more than one character that no source tagged
 * and that begins with one of the given characters.
 */
function isUntaggedFrom(
  context: EdgeContext,
  characters: ReadonlySet<string>,
): boolean {
  const { edge } = context;
  return (
    edge.to - edge.from >= 2 &&
    edge.partOfSpeech === "" &&
    characters.has(context.characters[edge.from] ?? "")
  );
}

/**
 * 着 and 了, in both scripts.
 *
 * 过 is left out. It is an aspect particle after a verb, but a verb of its own
 * after one too, and 她怕过马路 and 设置过马路警察 lost `guò` to the particle's
 * neutral tone when it was in.
 */
const ASPECT_PARTICLES = new Set(["着", "著", "了"]);

/**
 * The tag prefix jieba gives a verb, which is what an aspect particle follows.
 */
const VERB_TAG = "v";

/**
 * A word beginning with 着 or 了 does not start where the aspect particle does.
 *
 * 她手里拿着花 came out `ná zháo huā` on the strength of 着花, and 终于还清了债
 * came out `huánqīng liǎo zhài` on 了债. Both keys are real words — 着花 is a
 * plant coming into bloom and 了债 is settling a debt — and both read the
 * particle as the verb it is at the head of a phrase. After a verb it is the
 * aspect particle.
 *
 * Only an untagged key is forbidden, so 着急, 着火 and 了解 are left to the
 * decode. 猜着了 and 睡着了 keep `zháo`, since the word there is 猜着 or 睡着
 * and does not start at the 着.
 *
 * Over the 88,612 sentences of Tatoeba and the 43,367 Chinese Boost 例句 it
 * changes 6 runs in the full tier and all 6 are corrections: 拿着花 twice,
 * 逆着风 and 追著風, which become `zhe`, and 还清了债 and 付了賬, which become
 * `le`.
 */
export const ASPECTUAL_PARTICLE: EdgeRule = {
  name: "aspectual-particle",
  verdictFor: (context: EdgeContext) => {
    if (!isUntaggedFrom(context, ASPECT_PARTICLES)) {
      return "keep";
    }
    const before = wordEndingAt(context, context.edge.from);
    return tagOf(context, before).startsWith(VERB_TAG) ? "forbid" : "keep";
  },
};

/** The adverbial particle, which is the same in both scripts. */
const DI = new Set(["地"]);

/**
 * The tags a word carries when the 地 after it is the adverbial particle.
 *
 * An adjective, a descriptive word or an adverb: 惆怅地, 悠哉地, 慢慢地. A verb
 * is left out, because 地 after a verb is far more often the ground: 发射到
 * 地球轨道.
 */
const ADVERBIAL_TAGS = /^(?:a|z|d)/u;

/** The numeral that starts a count said twice over: 一点儿一点儿, 一步一步. */
const ONE = "一";

/**
 * The tags of a reduplicated word that says how something is done: 慢慢 and
 * 渐渐 are `d`, 悄悄 and 匆匆 are `z`, and 断断续续 is `i`.
 */
const MANNER_TAGS = /^(?:d|z|i)/u;

/**
 * The reduplicated adverbs that say when or how often rather than how, and
 * stand in front of a 地震 or a 地铁 as readily as in front of the particle.
 */
const TEMPORAL_REDUPLICATIONS = new Set([
  "常常",
  "刚刚",
  "剛剛",
  "每每",
  "偏偏",
  "仅仅",
  "僅僅",
  "恰恰",
]);

/**
 * Whether the words ending at a position are a reduplication that 地 makes
 * into an adverbial.
 *
 * Two shapes qualify. A count said twice, 一点儿一点儿 or 一步一步, is a
 * manner of doing something and nothing else. A word that is itself
 * reduplicated, 慢慢 or 渐渐, qualifies where its tag makes it an adverb of
 * manner. Repeated characters alone are not enough: 学学 in 大学学地质 ends a
 * 大学, and the 嚐嚐 of 嚐嚐地道的四川菜 is a verb whose object is 地道.
 */
function isReduplicatedBefore(context: EdgeContext, at: number): boolean {
  const word = wordEndingAt(context, at);
  if (word === undefined) {
    return false;
  }
  const characters = toCharacters(word);
  const length = characters.length;
  if (
    characters[0] === ONE &&
    length >= 2 &&
    context.characters.slice(at - 2 * length, at - length).join("") === word
  ) {
    return true;
  }
  const isDoubled =
    (length === 2 || length === 4) &&
    characters[0] === characters[1] &&
    characters[2] === characters[3];
  return (
    isDoubled &&
    MANNER_TAGS.test(tagOf(context, word)) &&
    !TEMPORAL_REDUPLICATIONS.has(word)
  );
}

/**
 * A word beginning with 地 does not start where the adverbial particle does.
 *
 * 她惆怅地望着窗外 came out `chóuchàng dì wàng` on the strength of 地望, a word
 * for a family's place of origin. After an adjective or an adverb 地 is the
 * particle that makes it modify a verb, and reads `de`.
 *
 * Only an untagged key is forbidden there, since a tagged one such as 地方 can
 * follow an adjective as a noun: 这么大地方. After a reduplication any key is
 * forbidden, since the 地 after 一点儿一点儿 or 慢慢 is always the particle.
 * 跟着丈夫一点儿一点儿地学 and 他慢慢地学 came out `dì xué` on the noun 地学.
 *
 * Over the 88,612 sentences of Tatoeba and the 43,367 Chinese Boost 例句 it
 * changes 2 runs in the full tier, both corrections: 惆怅地望着 and 悠哉地坐.
 * The reduplication changes 1 more of the 17,825 distinct runs holding a 地 in
 * Tatoeba, zh.wikipedia and the 47,848 例句 there are now, also a correction:
 * 斷斷續續地下了.
 */
export const ADVERBIAL_DI: EdgeRule = {
  name: "adverbial-di",
  verdictFor: (context: EdgeContext) => {
    const { characters, edge } = context;
    if (edge.to - edge.from < 2 || !DI.has(characters[edge.from] ?? "")) {
      return "keep";
    }
    if (isReduplicatedBefore(context, edge.from)) {
      return "forbid";
    }
    if (!isUntaggedFrom(context, DI)) {
      return "keep";
    }
    const before = wordEndingAt(context, edge.from);
    return ADVERBIAL_TAGS.test(tagOf(context, before)) ? "forbid" : "keep";
  },
};
