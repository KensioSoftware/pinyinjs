/**
 * The 话 after a structural 的, which is the noun *words* and not half of 的话.
 *
 * 的话 is a word, the clause-final *if* of 要是下雨的话, and every source counts
 * it. The same two characters are just as often the particle 的 and the noun 话
 * it modifies: 他说的话, 听妈妈的话. The decode had no way to tell the two
 * apart and read every one of them as the conditional, so 你听得懂从我嘴里出来的话吗
 * came out `chūlái dehuà ma`.
 */
import { toCharacters } from "../script/characters.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
  wordsEndingAt,
} from "./rules.js";
import {
  DE_HUA,
  AFTER_NOUN,
  PERSONS,
  OWNER_TAGS,
  RECEIVING,
  NEGATION,
  RECEIVING_TAIL,
  EARLIER,
} from "./hua-words.js";
import { at, followsSpeaking, isCounted, saysKind } from "./hua-speaking.js";

/**
 * Whether the 的 marks whose words they are, 他的话 and 听老师的话.
 *
 * The owner is a person, and it either opens the run with something said about
 * the words after them (他的话让我吃惊) or is the object of a verb that takes
 * words (听妈妈的话, 相信你的话, 听她叔叔的话). A noun owner is a word of two
 * characters or more, since 热的话就脱衣服 is tagged as a noun and is the
 * conditional.
 *
 * A negated verb counts as the verb. 不听 is a word of its own, and
 * 为什么不听我的话 has to find 听 in it.
 */
function isOwned(context: EdgeContext, from: number, to: number): boolean {
  const owner = wordEndingAt(context, from, 3);
  if (owner === undefined) {
    return false;
  }
  const isPerson = PERSONS.has(owner);
  if (
    !isPerson &&
    (toCharacters(owner).length < 2 || !OWNER_TAGS.test(tagOf(context, owner)))
  ) {
    return false;
  }
  let start = from - toCharacters(owner).length;
  if (start === 0) {
    return to < context.characters.length;
  }
  const possessor = wordEndingAt(context, start, 2);
  if (!isPerson && possessor !== undefined && PERSONS.has(possessor)) {
    start -= toCharacters(possessor).length;
  }
  let verb = start;
  while (verb > start - 2 && RECEIVING_TAIL.has(at(context, verb - 1))) {
    verb -= 1;
  }
  return wordsEndingAt(context, verb).some(
    (word) => RECEIVING.has(word) || RECEIVING.has(word.replace(NEGATION, "")),
  );
}

/**
 * 的话 is taken off the lattice where the 话 is the noun its 的 modifies.
 *
 * The conditional is the default, since it is what the word is, and the rule
 * names the contexts where it cannot be: a 吗 or 里 after the 话, a time the
 * words were said, a verb of speaking before the 的, a kind of words that verb
 * is saying, a 句 counting them, or a person whose words they are. Taking the edge away leaves 的 and 话
 * to read as themselves, which they already did, so this changes the spacing
 * and the segmentation rather than any syllable: `shuō de huà`, not
 * `shuō dehuà`.
 *
 * Over the 472 distinct lines of Tatoeba, zh.wikipedia and the Chinese Boost
 * example sentences that hold 的话, the full tier read 463 runs as the word.
 */
export const NOUN_HUA: EdgeRule = {
  name: "noun-hua",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (!DE_HUA.has(edge.text)) {
      return "keep";
    }
    const { from, to } = edge;
    const before = wordEndingAt(context, from, 2);
    return AFTER_NOUN.has(at(context, to)) ||
      (before !== undefined && EARLIER.has(before)) ||
      followsSpeaking(context, from) ||
      saysKind(context, from) ||
      isCounted(context, from) ||
      isOwned(context, from, to)
      ? "forbid"
      : "keep";
  },
};
