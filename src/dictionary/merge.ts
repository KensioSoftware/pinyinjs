import type { DictionaryEntry } from "./entry.js";
import { composeLocaleDeltas } from "./locale.js";
import { indexCedict, isSpeltTraditionally } from "./cedict-senses.js";
import { buildCharacterDefaults } from "./character-defaults.js";
import { mergeWord, type WordSources, type WordTally } from "./merge-word.js";
import type { MergeResult, MergeSources } from "./merge-types.js";

export type { MergeResult, MergeSources, MergeStats } from "./merge-types.js";

/**
 * Order two strings by UTF-16 code unit, matching the key index's ordering.
 */
function byCodeUnit(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * Nothing counted yet.
 */
const NO_COUNTS: WordTally = {
  neutralToneCorrections: 0,
  erhuaRepairs: 0,
  derivedTraditional: 0,
  scriptPairs: 0,
  variantSpellings: 0,
  taiwanReadings: 0,
  properNounVetoes: 0,
  nameBoundaries: 0,
  characters: 0,
  phraseWords: 0,
  cedictWords: 0,
};

/**
 * Add one word's tally to the running total.
 */
function added(total: WordTally, tally: WordTally): WordTally {
  return {
    neutralToneCorrections:
      total.neutralToneCorrections + tally.neutralToneCorrections,
    erhuaRepairs: total.erhuaRepairs + tally.erhuaRepairs,
    derivedTraditional: total.derivedTraditional + tally.derivedTraditional,
    scriptPairs: total.scriptPairs + tally.scriptPairs,
    variantSpellings: total.variantSpellings + tally.variantSpellings,
    taiwanReadings: total.taiwanReadings + tally.taiwanReadings,
    properNounVetoes: total.properNounVetoes + tally.properNounVetoes,
    nameBoundaries: total.nameBoundaries + tally.nameBoundaries,
    characters: total.characters + tally.characters,
    phraseWords: total.phraseWords + tally.phraseWords,
    cedictWords: total.cedictWords + tally.cedictWords,
  };
}

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
  let counts = NO_COUNTS;

  for (const word of [...words].toSorted(byCodeUnit)) {
    const merged = mergeWord(word, wordSources);
    counts = added(counts, merged.tally);
    if (merged.rejected !== undefined) {
      rejected.set(word, merged.rejected);
      continue;
    }
    /* c8 ignore next 3 -- a word is either rejected or gives an entry */
    if (merged.entry !== undefined) {
      entries.push(merged.entry);
    }
  }

  // ── zh-TW deltas the sources marked only on a constituent ──
  // Last, because it segments each compound against the finished entries: the
  // readings, both scripts' keys and the frequencies all have to be settled
  // before a compound can be asked what it is made of.
  const localised = composeLocaleDeltas(entries);

  return {
    entries: localised.entries,
    rejected,
    stats: {
      ...counts,
      reducedNeutrals,
      composedTaiwanReadings: localised.composed,
      rejected: rejected.size,
    },
  };
}
