/**
 * Whether a 教 is teaching or is the noun 教.
 *
 * Teaching takes an object or is followed by aspect, and only a verb takes
 * either, so the tags around it are the evidence.
 */
import type { Syllable } from "../syllable/syllable.js";
import {
  ASPECT,
  PARTICLE_TAG,
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
  wordStartingAt,
} from "./rules.js";

/**
 * Whether a syllable is `jiāo`, the verbal reading of 教.
 */
export function isJiao(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "j" && syllable.final === "iao" && syllable.tone === 1
  );
}

/**
 * What a 教 that is teaching governs: the thing or the person taught.
 *
 * A pronoun, a common noun, a name or one of the tags jieba gives a subject —
 * 教我, 教英语, 教历史, 教孩子, 教玛丽. `ns` is deliberately absent, since the
 * only 教 with a place tag after it over the corpus is 教青局, an office.
 */
export const TAUGHT_TAGS = new Set(["r", "n", "nz", "nr", "nt", "ng"]);

/**
 * Whether the 教 at a position is teaching something to somebody.
 *
 * The object is what says so, which is the same shape the modal 得 rule takes:
 * a 教 with a pronoun, a noun or a name after it is governing it, and a 教 with
 * 了, 过, 着 or 得 after it is a verb whatever follows that. A particle in front
 * of it rules it out, since a verb does not follow one.
 */
export function isTeachingAt(context: EdgeContext, at: number): boolean {
  if (tagOf(context, wordEndingAt(context, at)).startsWith(PARTICLE_TAG)) {
    return false;
  }
  return (
    ASPECT.has(context.characters[at + 1] ?? "") ||
    TAUGHT_TAGS.has(tagOf(context, wordStartingAt(context, at + 1)))
  );
}

/**
 * 教 read as `jiāo` where it is teaching rather than a religion.
 *
 * The dictionary stores 教 as `jiào` with `jiāo` as an alternate, and `jiào` is
 * right for the compounds — 教育, 教师, 宗教, 主教 — which are words and reach
 * their reading through the word. What is left is the 教 that stands as a word
 * of its own, and that one is the verb: 他在北京大学教了三年书 came out
 * `jiàole sān nián shū`, and 我教英语, 谁教你法语 and 她教我如何游泳 with it.
 * 教书 is a word and was always `jiāo shū`; nothing carried that across a 了.
 *
 * See {@link isTeachingAt} for what decides it. Forcing the single-character
 * edge is not enough on its own, because a reading spanning two characters
 * carries its own 教 into the position: 王老师教我们汉语 read `jiào` off 师教,
 * and 来教我 off 来教. Those are pairs the dictionary holds with no part of
 * speech and at the cost of a word nothing has ever counted — a reading rather
 * than a word — so a *tagged* word ending in 教 is left alone, which is every
 * one that matters: 任教, 宗教, 主教, 佛教, 传教, 执教, 请教, 家教.
 *
 * Measured over 88,866 lines of Tatoeba and zh.wikipedia, 181 教 decode as a
 * word of their own and every one of them read `jiào`. This moves 158 to
 * `jiāo` and is wrong on three: 统一教创始人, 方法教深思 and 做到了教政分离,
 * where a nominal compound takes an object's shape, the last of them because
 * 做到了 is a word and so the 了 in front is not a particle to look at. Of the
 * 21 it leaves, 8 are right — 诸教中, 教外别传, 董教总, 风教, 教青局 twice, a
 * 教室 reached through a bad split, and a 教 used as a bare noun — and 13 are
 * misses, where jieba tags the object something this does not name.
 */
export const TEACHING_JIAO: EdgeRule = {
  name: "teaching-jiao",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.text === "教") {
      return isJiao(edge.reading[0]) && isTeachingAt(context, edge.from)
        ? "force"
        : "keep";
    }
    return edge.partOfSpeech === "" &&
      edge.text.endsWith("教") &&
      edge.reading.length === edge.to - edge.from &&
      !isJiao(edge.reading.at(-1)) &&
      isTeachingAt(context, edge.to - 1)
      ? "forbid"
      : "keep";
  },
};
