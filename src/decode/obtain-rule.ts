/**
 * The reading rule for 得 where it means "to obtain": an illness, a score or a
 * prize.
 */
import type { Syllable } from "../syllable/syllable.js";
import { obtainsAt } from "./obtain-frames.js";
import type { EdgeContext, EdgeRule, EdgeVerdict } from "./rules.js";

/**
 * Whether a syllable is `dé`, the reading 得 takes as a verb of its own.
 */
function isDe(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "d" && syllable.final === "e" && syllable.tone === 2
  );
}

/**
 * Whether a syllable is `le`, the aspect reading of 了.
 */
function isLe(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "l" && syllable.final === "e" && syllable.tone === 5
  );
}

/**
 * What the rule says about the character of an edge at one position.
 *
 * Only edges starting at the 得 or the 了 are judged. A word ending in the 得,
 * such as 获得, already reads it `dé` or is no business of this rule.
 */
function verdictAt(context: EdgeContext, at: number): EdgeVerdict {
  const { edge } = context;
  if (obtainsAt(context, at)) {
    return edge.from === at && !isDe(edge.reading[0]) ? "forbid" : "keep";
  }
  if (obtainsAt(context, at - 1)) {
    return edge.from === at && !isLe(edge.reading[0]) ? "forbid" : "keep";
  }
  return "keep";
}

/**
 * 得了 read `dé le` in front of an illness, a score or a prize, as in
 * 他得了感冒 and 他得了几分.
 *
 * 得 is stored as the particle `de`, so a bare 得 with no word around it came
 * out `de` here too: 他得了感冒 read `tā de le gǎnmào`. After a verb it was
 * worse, since {@link import("./liao-rule.js").POTENTIAL_LIAO} took the 得 for
 * the marker of a potential complement, and 被确诊得了肺炎 read
 * `quèzhěn de liǎo fèiyán`. That rule now steps aside for the same frame, and
 * this one takes the particle and `liǎo` off the lattice.
 */
export const OBTAINING_DE: EdgeRule = {
  name: "obtaining-de",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.reading.length !== edge.to - edge.from) {
      return "keep";
    }
    for (let at = edge.from; at < edge.to; at++) {
      if (verdictAt(context, at) === "forbid") {
        return "forbid";
      }
    }
    return "keep";
  },
};
