/**
 * Finding where a pinyin query occurs in a Chinese text.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { normaliseQuery } from "./query.js";
import { type PinyinMatch, Search } from "./match-search.js";

export type { MatchRange } from "./match-scoring.js";
export type { PinyinMatch } from "./match-search.js";

/**
 * Find where a pinyin query matches a Chinese text, for filtering and
 * highlighting.
 *
 * ```ts
 * match(dictionary, "北京大学", "bjdx")?.ranges; // [{ at: 0, length: 4 }]
 * ```
 *
 * The query is what somebody types on a Latin keyboard with no Chinese input
 * method in front of them: full syllables joined or spaced, `beijing` and
 * `bei jing`; initials, `bj`; the two mixed, `beij` and `bjing`; tones as
 * digits where they are worth writing, `bei3jing1`; and `v` or `u:` for ü.
 * Returns undefined where none of it matches.
 *
 * **No index is built and none is needed.** The haystack is Chinese, so the
 * query is tested as a path over each character's readings rather than the text
 * being spelled out in advance and searched — which is what makes every reading
 * of a polyphone matchable rather than whichever one a default table picked.
 * 行 is found by `xing` and by `hang`, and 长江 by `cj` as well as by `zj`.
 *
 * The reading the decoder settles on in context is then what ranks them, so the
 * one that reads correctly here sorts above the one that merely could:
 *
 * ```ts
 * const scoreOf = (query: string) => match(dictionary, "银行", query)?.score;
 * scoreOf("yh") > scoreOf("yx"); // true — 银行 is yínháng, not yínxíng
 * ```
 *
 * Ranges rather than a boolean, so that a caller can mark what matched, in code
 * points from the start of the text. Everything this needs is in the `core`
 * dictionary, so a page that never loads a word list can still do it.
 */
export function match(
  dictionary: Dictionary,
  haystack: string,
  query: string,
): PinyinMatch | undefined {
  const normalised = normaliseQuery(query);
  if (normalised === "" || haystack === "") {
    return undefined;
  }
  return new Search(dictionary, haystack, normalised).best();
}
