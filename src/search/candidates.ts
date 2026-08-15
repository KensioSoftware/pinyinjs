import { encodeReading } from "../dictionary/artifact.js";
import { readQuery } from "./candidate-query.js";
import { ERHUA, spells } from "./candidate-writings.js";
import {
  narrowCandidates,
  type CandidateOptions,
} from "./candidate-narrowing.js";
import { convertCharacters } from "../script/conversion.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
import { readingKey, type ReverseIndex } from "./reverse-index.js";

export type {
  CandidateOptions,
  ScriptPreference,
} from "./candidate-narrowing.js";

/**
 * The reading the dictionary itself reports for a word, in numbered spelling.
 *
 * Asked of the dictionary rather than re-derived, which is what makes the
 * filter also the answer to the ghost keys: 校覈 is a key, `Dictionary.lookup`
 * folds it to 校核 before it searches, and the reading that comes back is
 * `jiao4 he2` rather than the `xiao4 he2` the raw key derives to. So a candidate
 * the dictionary would disown does not survive being checked against it.
 */
function readingOf(index: ReverseIndex, word: string): string {
  const entry = index.dictionary.lookup(word);
  /* c8 ignore next -- only asked of a canonical key, which always looks up */
  return entry === undefined ? "" : encodeReading(entry.reading);
}

/**
 * The positions in every group a query can reach, likeliest first.
 *
 * Two groups, not one: the query as typed, and the query with the 儿化 r on the
 * end. `wan` has to reach 玩儿 as well as 玩, and the r is kept in the key so
 * that `wanr` can still reach only 玩儿. Whatever the second group brings in is
 * then made honest by the filter, which is what stops `e` answering with 儿.
 */
function rankedPositions(index: ReverseIndex, key: string): readonly number[] {
  const found = [
    ...index.positionsFor(key),
    ...index.positionsFor(`${key}${ERHUA}`),
  ];
  // Both groups are already ranked, so this only has to interleave them. Sorted
  // rather than merged because the comparison is one array read and the lists
  // are short: the busiest reading in the full dictionary has 805 words in it.
  return found.toSorted(
    (left, right) =>
      index.dictionary.frequencyAt(right) - index.dictionary.frequencyAt(left),
  );
}

/**
 * The words a pinyin query could be spelling, likeliest first.
 *
 * ```ts
 * candidates(index, "shi"); // 是, 时, 事, 使, 市, …
 * candidates(index, "shi4"); // narrowed by tone
 * candidates(index, "shì"); // the same, written the other way
 * candidates(index, "yinhang"); // 銀行, 银行, 引吭, 引航, 印航
 * ```
 *
 * This is the half of search that has no haystack: `match` filters Chinese text
 * you already hold, and this answers a query with nothing but the dictionary
 * behind it — pinyin-only lookup, a homophone list, or an input method for
 * somebody with no Chinese keyboard.
 *
 * **A query is a whole reading, not a prefix.** `yinhang` finds 银行 and `yinha`
 * finds nothing, because a reading key is a key rather than a stem. What a query
 * may leave out is the parts a keyboard makes awkward: the tones, the ü, the
 * spaces between syllables, and the r of 儿化.
 *
 * Both scripts are dictionary keys, so 银行 and 銀行 both come back unless a
 * {@link import("./candidate-narrowing.js").ScriptPreference} says which to
 * keep.
 */
export function candidates(
  index: ReverseIndex,
  query: string,
  options: CandidateOptions = {},
): readonly string[] {
  const { key, written } = readQuery(query);
  if (key === "") {
    return [];
  }

  const writings = new Map<string, readonly string[]>();
  const found: string[] = [];
  for (const position of rankedPositions(index, key)) {
    const word = index.dictionary.wordAt(position);
    // A key whose glyphs are not the canonical ones can never be returned by
    // `Dictionary.lookup`, which folds them before it searches, so offering it
    // would be offering 中峯 beside the 中峰 that is already here. 281 of the
    // full tier's keys are like that, and dropping them at the query rather
    // than the build is what makes it free: filtering the whole key list with
    // `toCanonicalGlyphs` costs 52.9 ms, and filtering one answer costs nothing.
    if (toCanonicalGlyphs(word) !== word) {
      continue;
    }
    if (spells(written, readingOf(index, word), writings)) {
      found.push(word);
    }
  }

  return narrowCandidates(found, options);
}

/**
 * The other words read exactly as this one is, likeliest first.
 *
 * ```ts
 * homophonesOf(index, "长城"); // 長城, 長程, 长程, 常程 — everything read chángchéng
 * ```
 *
 * A homophone list wants the tone, where a typist's query does not, and it gets
 * one without a second index: the toneless group is narrowed to the words whose
 * stored reading is the same string. Over the eight busiest readings in the full
 * dictionary — 4,659 candidates — that narrowing costs 1.2 ms in total.
 *
 * The word itself is never in its own list. Neither is its other-script writing
 * where a {@link import("./candidate-narrowing.js").ScriptPreference} is given,
 * since 銀行 is not a homophone of 银行 but the same word spelled for a
 * different reader.
 *
 * Returns nothing for a word the dictionary does not hold, since a word with no
 * reading has no homophones rather than all of them.
 */
export function homophonesOf(
  index: ReverseIndex,
  word: string,
  options: CandidateOptions = {},
): readonly string[] {
  const entry = index.dictionary.lookup(word);
  if (entry === undefined) {
    return [];
  }
  const reading = encodeReading(entry.reading);
  const same = new Set([word, entry.word]);
  if (options.script !== undefined) {
    same.add(convertCharacters(options.script.tables.toSimplified, word));
  }

  const found: string[] = [];
  for (const position of rankedPositions(index, readingKey(reading))) {
    const candidate = index.dictionary.wordAt(position);
    if (toCanonicalGlyphs(candidate) !== candidate) {
      continue;
    }
    const pairing =
      options.script === undefined
        ? candidate
        : convertCharacters(options.script.tables.toSimplified, candidate);
    if (same.has(candidate) || same.has(pairing)) {
      continue;
    }
    if (readingOf(index, candidate) === reading) {
      found.push(candidate);
    }
  }

  return narrowCandidates(found, options);
}
