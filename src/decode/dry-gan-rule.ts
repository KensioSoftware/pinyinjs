/**
 * The reading rule for 干 where it means "dry".
 */
import { isGan } from "./gan-frames.js";
import { isDryAt } from "./dry-gan-frames.js";
import type { EdgeContext, EdgeRule, EdgeVerdict } from "./rules.js";

/**
 * 干 read `gān` where it means "dry".
 *
 * The character is stored `gàn` with `gān` as an alternate, so 西北的冬天又干
 * 又冷 came out `yòu gàn yòu lěng` and was written 又幹又冷 in 繁體. The words
 * that hold the dry sense (干燥, 晒干, 干净) were already right. A 干 standing
 * alone took the verb's reading. See {@link isDryAt} for the frames.
 *
 * The 繁體 follows the reading: a lone 干 read `gān` is written 乾 unless it
 * means "to concern", which the frames here never match.
 */
export const DRY_GAN: EdgeRule = {
  name: "dry-gan",
  verdictFor: (context: EdgeContext) => {
    const { characters, dictionary, edge } = context;
    if (edge.reading.length !== edge.to - edge.from) {
      return "keep";
    }
    let verdict: EdgeVerdict = "keep";
    for (let at = edge.from; at < edge.to; at++) {
      if (!isDryAt(dictionary, characters, at)) {
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
