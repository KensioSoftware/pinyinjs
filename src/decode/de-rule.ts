/**
 * The two rules about 得 and 的, which are one character each and three jobs.
 *
 * 得 is stored as the structural particle with `dé` and `děi` as alternates,
 * and 的 is stored as the particle full stop. Both are among the commonest
 * characters in the language, so the words they begin and end are numerous and
 * mostly wrong.
 */
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
  wordStartingAt,
  wordsStartingAt,
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
 * What a potential complement is made of, after the 得 that marks it.
 *
 * 算得上, 买得起, 看得住, 说得过去. The complement is a resultative or a
 * directional, and this is the closed set of the ones that take a 得 in front of
 * them rather than a verb of their own.
 *
 * 了 and 过 are deliberately absent, and for the same reason: both are aspect
 * markers as well as complements, and the aspect is the commoner by a wide
 * margin. Over 88,866 lines of Tatoeba and zh.wikipedia, including 了 broke 70
 * conversions and fixed none — 获得了, 取得了 and 赢得了 all became 获 得 了 —
 * and 过 broke 赢得过 twice. 吃得了 and 说得过去 are the shapes that gives up.
 */
const COMPLEMENTS = new Set(["上", "起", "下", "住"]);

/**
 * The tag prefix jieba gives a verb, which is what a complement attaches to.
 */
const VERB_TAG = "v";

/**
 * Whether a syllable is `dé`, the reading 得 takes as a verb of its own.
 */
function isDe(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "d" && syllable.final === "e" && syllable.tone === 2
  );
}

/**
 * Whether a word starting at the complement takes it away from the 得.
 *
 * The one thing that separates 算得上一个作家 from 取得上级批准, since both put a
 * verb, a 得 and a 上 in the same order. 上级 is a word and nothing follows it
 * that starts another, so the 上 belongs to it; 上道 is also a word, but 道歉
 * follows and is the better claim on the 道, so the 上 is left to the 得.
 *
 * Only multi-character words are asked, because every character is a word of its
 * own and a test that counted those would answer yes everywhere.
 */
function isSwallowed(context: EdgeContext, at: number): boolean {
  const longer = (from: number): boolean =>
    wordsStartingAt(context, from).some(
      (word) => toCharacters(word).length > 1,
    );
  return longer(at) && !longer(at + 1);
}

/**
 * A verb and a 得 in front of a complement is not a word reading `dé`.
 *
 * 他算得上一个作家 came out `suàn dé shàng`, because 算得 is a key jieba counted
 * and the phrase corpus reads it `suàn dé`. In a potential complement the 得 is
 * the particle: 算得上, 吃得了, 买得起 and 看得住 are all `de`, and the reading
 * the key carries is the one 算得 has standing alone, which is not what a
 * complement leaves it doing.
 *
 * Both sides are needed and neither is enough. A verb before the 得 rules out
 * 只得上山 and 不得下车, where the 得 belongs to an adverb and the character
 * after it starts a verb phrase of its own; the complement after it rules out
 * 取得上级批准, where 上 is the first character of 上级 rather than a complement.
 * That second test is why the complement has to be the whole of the word
 * starting there.
 *
 * Over the 88,866 lines it changes 5 conversions and all 5 are 算得上, which is
 * the only word of this shape the corpus holds. CPP does not move.
 */
export const POTENTIAL_DE: EdgeRule = {
  name: "potential-de",
  verdictFor: (context: EdgeContext) => {
    const { characters, edge } = context;
    if (
      edge.to - edge.from !== 2 ||
      edge.text.at(-1) !== "得" ||
      edge.reading.length !== 2 ||
      !isDe(edge.reading[1])
    ) {
      return "keep";
    }
    if (!tagOf(context, characters[edge.from]).startsWith(VERB_TAG)) {
      return "keep";
    }
    return COMPLEMENTS.has(characters[edge.to] ?? "") &&
      !isSwallowed(context, edge.to)
      ? "forbid"
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
