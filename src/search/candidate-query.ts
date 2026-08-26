/**
 * Reading a search query into the tokens it is matched by.
 *
 * A query is written with or without tones, with or without separators, and
 * with v for ü, so it is normalised before anything is looked up.
 */
import { stripToneMarks } from "../tone/tone-mark.js";
import { readingKey } from "./reverse-index-format.js";
import { SEPARATORS } from "./candidate-writings.js";
import { normaliseUmlaut } from "../syllable/syllable.js";

/**
 * A query in the one form the index is searched by, and the one it is filtered
 * by.
 */
export interface Query {
  /** The folded spelling, which is a reading key: toneless, no ü, no spaces. */
  readonly key: string;
  /** What was typed, with `v` and `u:` resolved and any tone still on it. */
  readonly written: string;
}

/**
 * Put a typed query into both the forms a search needs.
 *
 * Case, spacing and the ways of writing ü are all noise on the way to the key,
 * and the tone is noise there too — the index is keyed toneless. None of it is
 * noise on the way to the *filter*, which is what honours a tone the query
 * wrote, so the resolved spelling is kept alongside.
 *
 * A tone written as a mark counts here, unlike in `match`. The reason it cannot
 * count there is that a mark says nothing about where its syllable ends and a
 * half-typed query is exactly where that is unsettled; here the candidate's own
 * reading says where every syllable ends, so the mark has somewhere to land.
 */
export function readQuery(query: string): Query {
  return { key: foldReading(query), written: writtenQuery(query) };
}

/**
 * Fold pinyin as a person writes it into the key the index holds it under.
 *
 * `readingKey` folds the notation the artifact stores, and this folds every
 * other way the same reading gets written. `Rèn'shí`, `REN4 SHI2` and `renshi`
 * all key `renshi`. A search whose two sides are spelled differently (a corpus
 * written in tone marks against a query typed in digits) needs one fold over
 * both of them.
 *
 * The tone goes whether it was written as a mark or as a digit, the case goes,
 * the separators go, and `v`, `u:` and ü all become u. The 儿化 r stays, as it
 * does in the index.
 */
export function foldReading(text: string): string {
  return readingKey(stripToneMarks(writtenQuery(text)));
}

/**
 * The typed query with everything resolved that is not the tone.
 */
function writtenQuery(query: string): string {
  return normaliseUmlaut(query.normalize("NFC").toLowerCase()).replaceAll(
    SEPARATORS,
    "",
  );
}
