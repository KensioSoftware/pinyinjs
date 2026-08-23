/**
 * Walking the word list, and gathering what each word came to.
 */
import { byCodeUnit } from "./artifact-format.js";
import type { Syllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import { composeLocaleDeltas } from "./locale.js";
import {
  cedictReadingsOf,
  indexCedict,
  isSpeltTraditionally,
} from "./cedict-senses.js";
import { buildCharacterDefaults } from "./character-defaults.js";
import { repairConstituentReadings } from "./constituent-repair.js";
import { mergeWord } from "./merge-word.js";
import {
  addTally,
  type MergeResult,
  type MergeSources,
  NO_TALLY,
  type WordSources,
} from "./merge-types.js";

export type { MergeResult, MergeSources, MergeStats } from "./merge-types.js";

/**
 * Build the merged dictionary from the four parsed sources.
 *
 * The order of operations is the one MERGE.md sets out, and it is not
 * arbitrary — each step depends on the one before. Spelling, tones, sandhi and
 * validation happen in {@link import("./reading.js").readAlignedReading} as each source is read;
 * {@link mergeWord} then settles one word at a time, and this walks the words
 * and gathers what each of them came to.
 */
export function mergeSources(sources: MergeSources): MergeResult {
  const { phrase, cedict } = sources;
  const cedictByWord = indexCedict(cedict, (entry) => entry.simplified);
  // Only ever read for {@link isOwnSense}. A 繁體-only headword keeps its senses
  // under whichever 简体 form each one simplifies to — 沈 is `chén` under 沉 and
  // 誰 is `shéi` under 谁 — so the 简体 index alone cannot say what a character
  // like that already reads in 普通话.
  const cedictByHant = indexCedict(cedict, (entry) => entry.traditional);

  const { traditional, defaults, reducedNeutrals } = buildCharacterDefaults(
    sources,
    cedictByWord,
    cedictByHant,
  );

  const words = new Set<string>([
    ...defaults.keys(),
    ...[...phrase.keys()].filter(
      (word) => !isSpeltTraditionally(word, cedictByWord, cedictByHant),
    ),
    ...cedictByWord.keys(),
  ]);

  const wordSources: WordSources = {
    cedictByWord,
    cedictByHant,
    phrase,
    jieba: sources.jieba,
    unihanReadings: sources.unihanReadings,
    traditional,
    defaults,
  };

  const entries: DictionaryEntry[] = [];
  const rejected = new Map<string, readonly string[]>();
  let counts = NO_TALLY;

  for (const word of [...words].toSorted(byCodeUnit)) {
    const merged = mergeWord(word, wordSources);
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

  // ── Phrase entries held to the words inside them ───────────
  // Before the locale pass, which asks whether a compound reads a constituent
  // the way that constituent's own entry reads it. A phrase entry repaired here
  // answers yes where it used to answer no.
  const sensesOf = (word: string): readonly (readonly Syllable[])[] => [
    ...cedictReadingsOf(word, cedictByWord.get(word) ?? []),
    ...cedictReadingsOf(word, cedictByHant.get(word) ?? []),
  ];
  const held = repairConstituentReadings(entries, sensesOf);

  // ── zh-TW deltas the sources marked only on a constituent ──
  // Last, because it segments each compound against the finished entries: the
  // readings, both scripts' keys and the frequencies all have to be settled
  // before a compound can be asked what it is made of.
  const localised = composeLocaleDeltas(held.entries);

  return {
    entries: localised.entries,
    rejected,
    stats: {
      ...counts,
      reducedNeutrals,
      repairedConstituents: held.repaired,
      composedTaiwanReadings: localised.composed,
      rejected: rejected.size,
    },
  };
}
