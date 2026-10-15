/**
 * The reading rule for 了 where it closes a potential complement.
 */
import type { Syllable } from "../syllable/syllable.js";
import { isPotentialAt } from "./liao-frames.js";
import type { EdgeContext, EdgeRule, EdgeVerdict } from "./rules.js";

/**
 * Whether a syllable is `liǎo`, the complement "able to finish".
 */
function isLiao(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "l" && syllable.final === "iao" && syllable.tone === 3
  );
}

/**
 * Whether a syllable is the neutral `de` of the structural particle.
 */
function isParticleDe(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "d" && syllable.final === "e" && syllable.tone === 5
  );
}

/**
 * The verdict for an edge covering the 了 of a potential complement.
 *
 * The 了 is a word of its own, so 了了 and 得了 are taken apart and only the
 * single `liǎo` is left. A word holding the whole complement, such as 受得了,
 * keeps its place where it reads the 了 `liǎo`.
 */
function verdictForComplement(context: EdgeContext, at: number): EdgeVerdict {
  const { edge } = context;
  if (!isLiao(edge.reading[at - edge.from])) {
    return "forbid";
  }
  if (edge.from === at) {
    return edge.to - edge.from === 1 ? "force" : "forbid";
  }
  return "keep";
}

/**
 * The verdict for an edge covering the 得 in front of that 了.
 *
 * The 得 is the particle. 来得 is taken apart so that 来得了 reads like
 * 吃得了, `lái de liǎo`.
 */
function verdictForMarker(context: EdgeContext, at: number): EdgeVerdict {
  const { edge } = context;
  if (!isParticleDe(edge.reading[at - edge.from])) {
    return "forbid";
  }
  return edge.to === at + 1 && edge.from < at ? "forbid" : "keep";
}

/**
 * What the rule says about the character of an edge at one position.
 */
function verdictAt(context: EdgeContext, at: number): EdgeVerdict {
  if (isPotentialAt(context, at)) {
    return verdictForComplement(context, at);
  }
  return isPotentialAt(context, at + 1)
    ? verdictForMarker(context, at)
    : "keep";
}

/**
 * 了 read `liǎo` where it closes a potential complement after a verb.
 *
 * 了 is stored `le` with `liǎo` and `liào` as alternates. 吃不了 and 受不了 read
 * `liǎo` through 不了, a dictionary word, but 吃得了 has no word to go through,
 * so 你吃得了吗 came out `nǐ chī de le ma`. 得了 is a word too, `dé le`, and
 * that is the reading 得了吧 and 他得了病 need.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia, the rule moves 12 decodes in
 * the full tier, 14 in the standard tier and 15 in the core tier. All of them
 * are corrections except 你去办公室睡得了呗, where 得了 is "and be done with
 * it", `déle`, and no reading was right before the rule either. None of CPP's
 * 69 sentences holding 得了 moves.
 */
export const POTENTIAL_LIAO: EdgeRule = {
  name: "potential-liao",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.reading.length !== edge.to - edge.from) {
      return "keep";
    }
    let verdict: EdgeVerdict = "keep";
    for (let at = edge.from; at < edge.to; at++) {
      const settled = verdictAt(context, at);
      if (settled === "forbid") {
        return "forbid";
      }
      if (settled === "force") {
        verdict = "force";
      }
    }
    return verdict;
  },
};
