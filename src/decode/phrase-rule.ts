/**
 * Words jieba counts that a learner reads as two or three: 好多了, 太好了 and a
 * pronoun's 家.
 *
 * 妈妈好多了 is *Mum is much better*, 好 *well* and 多 *much* with 了 marking
 * the change, and the decode read 好多 *a great many*. 太好了 is 太, 好 and 了,
 * and jieba counts it as one idiom. 我家很大 and 国兴比他家的狗快 read 我家 and
 * 他家 as words, where 你家 and 她家, which jieba never counted, came out as
 * the pronoun and 家. A caller filing a sentence under its words found 好多,
 * 太好了 and 我家 where a learner would look up 好, 太 and 家.
 */
import { toCharacters } from "../script/characters.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordsStartingAt,
} from "./rules.js";

/**
 * 好多, which is *a great many* except before the 了 of a change.
 */
const HAODUO = new Set(["好多"]);

/**
 * The 了 that follows 好多 when it means *much better*.
 */
const LE = new Set(["了"]);

/**
 * The aspect a verb carries before an object of 好多: 吃了好多了 is *eaten a
 * great deal already*, and 好多 is the amount.
 */
const ASPECT_BEFORE = new Set(toCharacters("了过過"));

/**
 * The phrases jieba counts as one word that are their characters' words.
 */
const COMPOSED = new Set(["太好了"]);

/**
 * The pronouns before 家, whose 家 is the home or family they have.
 *
 * 咱家 is left out. CC-CEDICT gives it as *I* in early vernacular as well as
 * *our home*, and it is a word in its own right.
 */
const PRONOUNS = new Set(toCharacters("我你他她它您俺"));
const JIA = "家";

/**
 * Whether a tagged word of more than one character starts at a position.
 *
 * 好多了解 has 了解 starting at its 了, which is no particle.
 */
function opensTaggedWord(context: EdgeContext, at: number): boolean {
  return wordsStartingAt(context, at).some(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * Whether a 好多 is *much better*: before a 了 that is the particle, and
 * after no aspect that would make it a verb's object.
 */
function isMuchBetter(context: EdgeContext): boolean {
  const { characters, edge } = context;
  return (
    HAODUO.has(edge.text) &&
    LE.has(characters[edge.to] ?? "") &&
    !opensTaggedWord(context, edge.to) &&
    !ASPECT_BEFORE.has(characters[edge.from - 1] ?? "")
  );
}

/**
 * The tag jieba gives an abbreviation, which 家小 *wife and children* carries.
 */
const ABBREVIATION_TAG = "j";

/**
 * Whether an edge is a pronoun and 家.
 *
 * Not where an abbreviation starts at the 家: 我家小的不喜欢去看牙 would hand
 * 家小 the 家 and read *my wife and children's little one*. 家人, 家里 and 家乡
 * are welcome to it, since 我 家人 is what the sentence says.
 */
function isPronounsHome(context: EdgeContext): boolean {
  const { edge } = context;
  const [pronoun = "", jia, ...rest] = toCharacters(edge.text);
  return (
    PRONOUNS.has(pronoun) &&
    jia === JIA &&
    rest.length === 0 &&
    !wordsStartingAt(context, edge.from + 1).some((word) =>
      tagOf(context, word).startsWith(ABBREVIATION_TAG),
    )
  );
}

/**
 * 好多 before the 了 of a change, 太好了, and a pronoun's 家 are taken apart.
 *
 * The readings are the same either way, so this changes the segmentation and
 * the spacing. A 好多 after 了 or 过 is the amount a verb took and is kept, as
 * is one whose 了 opens 了解.
 */
export const COMPOSED_PHRASE: EdgeRule = {
  name: "composed-phrase",
  verdictFor: (context: EdgeContext) =>
    COMPOSED.has(context.edge.text) ||
    isMuchBetter(context) ||
    isPronounsHome(context)
      ? "forbid"
      : "keep",
};
