/**
 * The two rules about 得 and 的, which are one character each and three jobs.
 *
 * 得 is stored as the structural particle with `dé` and `děi` as alternates,
 * and 的 is stored as the particle full stop. Both are among the commonest
 * characters in the language, so the words they begin and end are numerous and
 * mostly wrong.
 */
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
 * The tags a word carries when the 的 after it is the structural particle.
 *
 * A pronoun, a noun, an adjective, a verb or a distinguishing word: 他的,
 * 图书馆的, 伟大的, 见过面的, 男的. What the particle marks is a modifier, and
 * these are what a modifier is.
 */
const MODIFIED_TAGS = /^(?:r|n|a|v|b|z)/u;

/**
 * A word beginning with 的 does not start where the particle 的 does.
 *
 * The structural particle attaches to the modifier in front of it and the head
 * follows, so a dictionary key spanning that 的 and the head's first character
 * is describing some other sentence: 没有人知道他的真名字 came out
 * `tā dí zhēn míngzi` on the strength of 的真, 图书馆的卡 on 的卡, and 你說的對
 * came out as one word, `deduì`.
 *
 * Only a key **no source has tagged** is forbidden, which is the same line
 * {@link TEACHING_JIAO} draws for a word ending in 教. 的确, 的士 and 的哥 are
 * words jieba counted and tagged, and every one of them can genuinely begin
 * where this fires: 我的确知道, 我要一辆的士, 那个的哥. That leaves 我的哥哥们
 * reading `wǒ dī gēgē men`, since 的哥 is a taxi driver and jieba has counted
 * them. What this does reach is the untagged tail — a reading somebody asserted
 * rather than a word anybody counted — where the 的 is the particle every time.
 *
 * Measured over the 88,866 lines of Tatoeba and zh.wikipedia it forbids edges
 * in 40 runs: 的筆 13, 的這 11, 的真 6, 的對 4, 的卡 4 and 的歷 once. Every one
 * is a correction, and half of them are corrections to the spacing as much as
 * to the reading — 你說的對 was one word `deduì` and is now two.
 */
export const PARTICLE_DE: EdgeRule = {
  name: "particle-de",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (
      edge.to - edge.from < 2 ||
      edge.partOfSpeech !== "" ||
      !edge.text.startsWith("的")
    ) {
      return "keep";
    }
    const before = wordEndingAt(context, edge.from);
    return MODIFIED_TAGS.test(tagOf(context, before)) ? "forbid" : "keep";
  },
};
