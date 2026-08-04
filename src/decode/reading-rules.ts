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
 * The rules the lattice decode applies, in order.
 */
export const READING_RULES: readonly EdgeRule[] = [MODAL_DE, ATTESTED_ERHUA];
