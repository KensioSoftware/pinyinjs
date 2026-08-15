/**
 * What a rule can ask about the words around an edge.
 *
 * The lookups every edge rule shares: which word ends here, which starts here,
 * and what part of speech the dictionary gives it.
 */
import type { EdgeContext } from "./rules.js";

/**
 * The word ending at a position, longest first, or undefined.
 *
 * What a rule needs when it asks about the word *before* an edge. The decode
 * has not run yet, so there is no settled answer; the longest dictionary word
 * ending here is the closest thing available, and it is what the decode will
 * usually choose, since the reading charge prefers fewer words.
 */
export function wordEndingAt(
  context: EdgeContext,
  at: number,
  longest = 4,
): string | undefined {
  for (let length = longest; length > 0; length--) {
    const from = at - length;
    if (from < 0) {
      continue;
    }
    const text = context.characters.slice(from, at).join("");
    if (context.dictionary.lookup(text) !== undefined) {
      return text;
    }
  }
  return undefined;
}

/**
 * The word starting at a position, longest first, or undefined.
 */
export function wordStartingAt(
  context: EdgeContext,
  at: number,
  longest = 4,
): string | undefined {
  for (let length = longest; length > 0; length--) {
    // Nothing starts at the end of a run, which is where a 得 closing a
    // sentence asks from.
    const text = context.characters.slice(at, at + length).join("");
    if (text !== "" && context.dictionary.lookup(text) !== undefined) {
      return text;
    }
  }
  return undefined;
}

/**
 * The part of speech the dictionary gives a word, or the empty string.
 */
export function tagOf(context: EdgeContext, word: string | undefined): string {
  return word === undefined
    ? ""
    : (context.dictionary.lookup(word)?.partOfSpeech ?? "");
}

/**
 * What follows a 教 that is teaching where no object does: aspect and the
 * complement marker, which only a verb takes.
 *
 * 他教了三年书, 他教过我英语, 她教书教得很快乐. Matched as characters rather
 * than through their tags, because what the dictionary has starting at a 得 is
 * as likely to be 得很 as the particle itself.
 */
export const ASPECT = new Set(["了", "过", "過", "着", "著", "得"]);

/**
 * The tag prefix jieba gives a particle, which nothing teaching can follow.
 */
export const PARTICLE_TAG = "u";
