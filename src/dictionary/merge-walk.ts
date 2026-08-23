/**
 * The word list the merge walks, and what walking it comes to.
 *
 * Which spellings get an entry at all, and the loop that settles each of them.
 * `merge.ts` is the order of the passes; this is the pass over the words.
 */
import { byCodeUnit } from "./artifact-format.js";
import { isSpeltTraditionally } from "./cedict-senses.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { DictionaryEntry } from "./entry.js";
import { mergeWord } from "./merge-word.js";
import {
  addTally,
  NO_TALLY,
  type WordSources,
  type WordTally,
} from "./merge-types.js";

/**
 * Every spelling the merge will try to give an entry.
 *
 * The characters Unihan knows, the phrase corpus's headwords and CC-CEDICT's,
 * less the phrase headwords that are really 繁體 spellings of another word —
 * see {@link isSpeltTraditionally}. jieba is absent on purpose: it carries
 * frequencies and tags rather than readings, so a word only it has would arrive
 * with nothing to read it by.
 */
export function wordList(
  phrase: ReadonlyMap<string, readonly string[]>,
  defaults: ReadonlyMap<string, unknown>,
  cedictByWord: ReadonlyMap<string, readonly CedictEntry[]>,
  cedictByHant: ReadonlyMap<string, readonly CedictEntry[]>,
): readonly string[] {
  const words = new Set<string>([
    ...defaults.keys(),
    ...[...phrase.keys()].filter(
      (word) => !isSpeltTraditionally(word, cedictByWord, cedictByHant),
    ),
    ...cedictByWord.keys(),
  ]);
  return [...words].toSorted(byCodeUnit);
}

/**
 * What the walk produced: the entries, what it turned away, and the counts.
 */
export interface MergedWords {
  readonly entries: readonly DictionaryEntry[];
  /** Spellings no source gave a usable reading, and what it gave instead. */
  readonly rejected: ReadonlyMap<string, readonly string[]>;
  readonly counts: WordTally;
}

/**
 * Settle every word in the list.
 */
export function mergeWords(
  words: readonly string[],
  sources: WordSources,
): MergedWords {
  const entries: DictionaryEntry[] = [];
  const rejected = new Map<string, readonly string[]>();
  let counts = NO_TALLY;

  for (const word of words) {
    const merged = mergeWord(word, sources);
    counts = addTally(counts, merged.tally);
    if (merged.rejected !== undefined) {
      rejected.set(word, merged.rejected);
      continue;
    }
    /* c8 ignore next 3 -- a word is either rejected or gives an entry */
    if (merged.entry !== undefined) {
      entries.push(merged.entry);
    }
  }

  return { entries, rejected, counts };
}
