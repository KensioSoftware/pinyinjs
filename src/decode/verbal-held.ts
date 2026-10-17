/**
 * Whether a word the dictionary holds has a claim on a frame's character.
 */
import { isSameSyllable } from "../dictionary/entry.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { type EdgeContext, tagOf, wordsStartingAt } from "./rules.js";

/**
 * The tagged words of more than one character starting at a position.
 */
function taggedWordsAt(context: EdgeContext, from: number): readonly string[] {
  return wordsStartingAt(context, from).filter(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * Whether a commoner tagged word crosses a word, taking its first or its last
 * character into a word of its own.
 *
 * 冷气调高 holds 气调 as well as 冷气, and the decode takes 冷气, the commoner
 * of the two, every time. A word crossed like that is no claim on the
 * characters it covers. The commoner word has to win: 关系上 holds 系上 too,
 * and 关系 is the word there.
 */
function isCrossed(context: EdgeContext, from: number, word: string): boolean {
  const to = from + toCharacters(word).length;
  /* c8 ignore next -- the word came out of the dictionary */
  const own = context.dictionary.frequencyOf(word) ?? 0;
  for (let start = Math.max(0, from - 3); start < to; start++) {
    for (const rival of taggedWordsAt(context, start)) {
      const end = start + toCharacters(rival).length;
      const left = start < from && end > from && end < to;
      const right = start > from && end > to;
      /* c8 ignore next -- the rival came out of the dictionary */
      const commoner = (context.dictionary.frequencyOf(rival) ?? 0) > own;
      if ((left || right) && commoner) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Whether a tagged word of more than one character holds the position and
 * reads it some other way.
 *
 * A frame is about a character standing as a word of its own. 词汇量 and 数量
 * are words, and whatever stands after them is no evidence about their 量. A
 * word another word crosses is left out (see {@link isCrossed}).
 */
export function isHeldAgainst(
  context: EdgeContext,
  at: number,
  reading: Syllable,
): boolean {
  for (let from = Math.max(0, at - 3); from <= at; from++) {
    for (const word of taggedWordsAt(context, from)) {
      if (
        from + toCharacters(word).length <= at ||
        isCrossed(context, from, word)
      ) {
        continue;
      }
      const held = context.dictionary.lookup(word)?.reading[at - from];
      if (held !== undefined && !isSameSyllable(held, reading)) {
        return true;
      }
    }
  }
  return false;
}
