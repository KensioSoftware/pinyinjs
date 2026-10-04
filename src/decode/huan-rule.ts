/**
 * Whether a 还 is giving something back or is the adverb.
 *
 * The adverb `hái` comes in front of a verb or an adjective. The verb `huán`
 * takes an object, and what is given back is most often money, a book or a
 * debt.
 */
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordsStartingAt,
} from "./rules.js";

/**
 * Whether a syllable is `huán`, the verbal reading of 还.
 */
export function isHuan(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "h" && syllable.final === "uan" && syllable.tone === 2
  );
}

/**
 * The character in both scripts.
 */
const RETURNING = new Set(["还", "還"]);

/**
 * What a 还 gives back, in both scripts.
 *
 * Money, a book and an account. The full tier holds 还钱, 还书 and 还账 as
 * words, all three `huán`, and the standard tier holds none of them. 还债 and
 * 还款 are in both tiers and need nothing here.
 *
 * Written out because the tags will not do it. jieba tags 有点, 客气, 问 and
 * 头 `n`, and 还有点, 还客气, 还问 and 还头一回 are all the adverb. Over 88,866
 * lines of Tatoeba and zh.wikipedia, the standard tier decodes 39 standalone
 * 还 in front of a word with a noun tag, and 30 of them are the adverb.
 */
const RETURNED = new Set(["钱", "錢", "书", "書", "账", "賬", "帳"]);

/**
 * Whether the 还 at a position has something given back after it.
 *
 * The object has to stand clear of a tagged word of its own. 他还书法很好 has
 * 书法 after the 还, and that 还 is the adverb.
 */
function isReturningAt(context: EdgeContext, at: number): boolean {
  if (!RETURNED.has(context.characters[at + 1] ?? "")) {
    return false;
  }
  return !wordsStartingAt(context, at + 1).some(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * 还 read as `huán` where it gives back money, a book or an account.
 *
 * The character is stored `hái` with `huán` as an alternate, and the adverb is
 * by far the commoner of the two. The verb mostly lives in words that carry
 * their own reading (还给, 归还, 偿还, 还债). 还钱 is a word in the full tier
 * only, since no frequency list counts it, so the standard tier read
 * 我得去银行还钱 as `hái qián`. See {@link RETURNED} for the objects.
 *
 * An untagged pair ending in 还 is taken off the lattice where it reads the 还
 * `hái`, for the reason {@link TEACHING_JIAO} gives. 倒还 is a key the full
 * tier holds with no part of speech.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia and both CPP splits, this
 * moves 5 decodes in the standard tier and all 5 are corrections (還錢 three
 * times, 还钱 and 還書). Each now reads what the full tier reads through the
 * word. Nothing moves in the full tier.
 */
export const RETURNING_HUAN: EdgeRule = {
  name: "returning-huan",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (RETURNING.has(edge.text)) {
      return isHuan(edge.reading[0]) && isReturningAt(context, edge.from)
        ? "force"
        : "keep";
    }
    return edge.partOfSpeech === "" &&
      RETURNING.has(toCharacters(edge.text).at(-1) ?? "") &&
      edge.reading.length === edge.to - edge.from &&
      !isHuan(edge.reading.at(-1)) &&
      isReturningAt(context, edge.to - 1)
      ? "forbid"
      : "keep";
  },
};
