/**
 * The order the merge does its work in.
 *
 * Which spellings get an entry and how each one is settled is `merge-walk.ts`.
 * What is here is the sequence: the indexes and character defaults everything
 * else reads, the walk, and the two passes that run over the finished entries.
 */
import { composeLocaleDeltas } from "./locale.js";
import { indexCedict, senseLookup } from "./cedict-senses.js";
import { buildCharacterDefaults } from "./character-defaults.js";
import { repairConstituentReadings } from "./constituent-repair.js";
import { settleMeasureTones } from "./measure-tone.js";
import { mergeWords, wordList } from "./merge-walk.js";
import { carryToTraditional } from "./traditional-carry.js";
import type { MergeResult, MergeSources, WordSources } from "./merge-types.js";

export type { MergeResult, MergeSources, MergeStats } from "./merge-types.js";

/**
 * Build the merged dictionary from the four parsed sources.
 *
 * The order of operations is the one MERGE.md sets out, and it is not
 * arbitrary — each step depends on the one before. Spelling, tones, sandhi and
 * validation happen in {@link import("./reading.js").readAlignedReading} as each source is read;
 * {@link mergeWords} then settles one word at a time, and the passes after it
 * see every entry at once.
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

  const wordSources: WordSources = {
    cedictByWord,
    cedictByHant,
    phrase,
    jieba: sources.jieba,
    unihanReadings: sources.unihanReadings,
    traditional,
    defaults,
  };
  const { entries, rejected, counts } = mergeWords(
    wordList(phrase, defaults, cedictByWord, cedictByHant),
    wordSources,
  );

  // ── 个 given one tone per position ─────────────────────────
  // Before the repair below, which reads a phrase's constituents off these same
  // entries: settling first is what lets 那个人 be held to a settled 那个.
  const measured = settleMeasureTones(entries);

  // ── Phrase entries held to the words inside them ───────────
  // Before the locale pass, which asks whether a compound reads a constituent
  // the way that constituent's own entry reads it. A phrase entry repaired here
  // answers yes where it used to answer no.
  const held = repairConstituentReadings(
    measured.entries,
    senseLookup(cedictByWord, cedictByHant),
  );

  // ── zh-TW deltas the sources marked only on a constituent ──
  // Last, because it segments each compound against the finished entries: the
  // readings, both scripts' keys and the frequencies all have to be settled
  // before a compound can be asked what it is made of.
  const localised = composeLocaleDeltas(held.entries);

  // ── 繁體 spellings given their 简体 word's tag and count ────
  // Last, and over the finished key set, because the pairing it reads is the
  // 繁體 form each entry names and every pass above can still change one.
  const carried = carryToTraditional(localised.entries);

  return {
    entries: carried.entries,
    rejected,
    stats: {
      ...counts,
      reducedNeutrals,
      settledMeasureTones: measured.settled,
      repairedConstituents: held.repaired,
      composedTaiwanReadings: localised.composed,
      carriedTags: carried.carriedTags,
      carriedCounts: carried.carriedCounts,
      rejected: rejected.size,
    },
  };
}
