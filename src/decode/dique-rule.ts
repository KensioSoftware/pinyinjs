/**
 * Whether a 的确 is the adverb or a 的 closing a verb before 确实.
 *
 * 的确 is `díquè`, *indeed*, and 确实 is a word meaning the same. Written
 * together as 的确实, either can take the 确: 战争的确实在是功不可没 is 的确 and
 * 实在, and 你说的确实有道理 is 说的 and 确实. The decode took the adverb in
 * both, which reads the 的 of the second `dí`.
 */
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
} from "./rules.js";

/** The word, in both scripts. */
const DIQUE = new Set(["的确", "的確"]);

/** The character that starts 确实 after the 确. */
const SHI = new Set(["实", "實"]);

/**
 * 的确 taken apart where a verb stands before it and 实 after it.
 *
 * A 的 after a verb closes a 的 phrase, so 他说的确实在理 is "what he says is
 * indeed reasonable", and the 确 belongs to 确实. Taking the edge away leaves
 * the 的 its own reading, `de`. A noun or a pronoun before it keeps the adverb:
 * 战争的确实在, 我的确实在不知道. The verb is the longest word ending there, so
 * the 争 of 战争 does not count as one.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia and both CPP splits, the one
 * 的确实 is the 战争的确实在 above, which the rule leaves alone.
 */
export const VERBAL_DE_QUESHI: EdgeRule = {
  name: "verbal-de-queshi",
  verdictFor: (context: EdgeContext) => {
    const { edge, characters } = context;
    if (!DIQUE.has(edge.text) || !SHI.has(characters[edge.to] ?? "")) {
      return "keep";
    }
    return tagOf(context, wordEndingAt(context, edge.from)).startsWith("v")
      ? "forbid"
      : "keep";
  },
};
