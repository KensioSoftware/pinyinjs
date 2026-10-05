/**
 * The reading rule for 干 where it means "to concern".
 */
import { isConcerningAt, isGan } from "./gan-frames.js";
import type { EdgeContext, EdgeRule, EdgeVerdict } from "./rules.js";

/**
 * 干 read `gān` where it means "to concern".
 *
 * The character is stored `gàn` with `gān` as an alternate, so 这不干你的事
 * came out `Zhè bú gàn nǐ de shì`. 无干 and 干卿底事 are keys in the full
 * tier and read `gān` through the word. The standard tier holds neither, and
 * no tier holds 干卿何事. The full tier holds 不干 as `bù gàn`, which is right
 * for 我不干了, and an edge reading `gàn` across a frame is taken off the
 * lattice with the rest. See {@link isConcerningAt} for the frames.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia and both CPP splits, the
 * frames match twice, in 這不干你的事 and 不干我的事. Both move to `gān` in
 * the standard and full tiers, and nothing else moves.
 */
export const CONCERNING_GAN: EdgeRule = {
  name: "concerning-gan",
  verdictFor: (context: EdgeContext) => {
    const { characters, dictionary, edge } = context;
    if (edge.reading.length !== edge.to - edge.from) {
      return "keep";
    }
    let verdict: EdgeVerdict = "keep";
    for (let at = edge.from; at < edge.to; at++) {
      if (!isConcerningAt(dictionary, characters, at)) {
        continue;
      }
      if (!isGan(edge.reading[at - edge.from])) {
        return "forbid";
      }
      if (edge.to - edge.from === 1) {
        verdict = "force";
      }
    }
    return verdict;
  },
};
