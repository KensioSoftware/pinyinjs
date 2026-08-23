/**
 * What the merge takes in and what it hands back.
 *
 * Their own module so that a step of the merge can name them without
 * importing the merge itself.
 */
import type { CedictEntry } from "../sources/cedict.js";
import type { JiebaEntry } from "../sources/jieba.js";
import type { UnihanReadings, UnihanVariants } from "../sources/unihan.js";
import type { Syllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import type { TraditionalTable } from "./traditional-table.js";

/**
 * The parsed sources the merge combines.
 */
export interface MergeSources {
  readonly unihanReadings: ReadonlyMap<string, UnihanReadings>;
  readonly unihanVariants: UnihanVariants;
  readonly phrase: ReadonlyMap<string, readonly string[]>;
  readonly cedict: readonly CedictEntry[];
  readonly jieba: ReadonlyMap<string, JiebaEntry>;
}

/**
 * Counts describing what the merge did, for the build to report and check.
 */
export interface MergeStats {
  readonly characters: number;
  readonly phraseWords: number;
  readonly cedictWords: number;
  /** Words whose reading CC-CEDICT corrected to a neutral tone. */
  readonly neutralToneCorrections: number;
  /**
   * Characters whose default was a 轻声 the frequency field only counted inside
   * words — see {@link import("./frequency-tones.js").demoteReducedNeutrals}.
   */
  readonly reducedNeutrals: number;
  /** Words whose trailing 儿 was folded into the syllable before it. */
  readonly erhuaRepairs: number;
  /** Words whose 繁體 form was derived rather than taken from CC-CEDICT. */
  readonly derivedTraditional: number;
  /** Entries with a 繁體 form differing from their 简体 one. */
  readonly scriptPairs: number;
  /** Entries a source writes more than one 繁體 spelling of. */
  readonly variantSpellings: number;
  /**
   * Phrase entries read as a corroborated word inside them reads them — see
   * {@link import("./constituent-repair.js").repairConstituentReadings}.
   */
  readonly repairedConstituents: number;
  /** Entries carrying a zh-TW reading delta a source stated. */
  readonly taiwanReadings: number;
  /** Compounds given a zh-TW delta composed from their constituents. */
  readonly composedTaiwanReadings: number;
  /**
   * Words jieba tagged a proper noun that CC-CEDICT's lowercase pinyin vetoed.
   */
  readonly properNounVetoes: number;
  /** Entries whose parts CC-CEDICT's capitalisation divides. */
  readonly nameBoundaries: number;
  /** Words dropped because no source gave a usable reading. */
  readonly rejected: number;
}

/**
 * What the merge produced.
 */
export interface MergeResult {
  /** Entries, ordered by their 简体 form. */
  readonly entries: readonly DictionaryEntry[];
  /** Words no source could be read, with the reading that failed. */
  readonly rejected: ReadonlyMap<string, readonly string[]>;
  readonly stats: MergeStats;
}

/**
 * What the sources between them say about one word, indexed once for all of
 * them.
 *
 * The per-word view of {@link MergeSources}: the same data, turned inside out
 * so that merging a word is a handful of map reads rather than a scan.
 */
export interface WordSources {
  readonly cedictByWord: ReadonlyMap<string, readonly CedictEntry[]>;
  readonly cedictByHant: ReadonlyMap<string, readonly CedictEntry[]>;
  readonly phrase: ReadonlyMap<string, readonly string[]>;
  readonly jieba: ReadonlyMap<string, JiebaEntry>;
  readonly unihanReadings: ReadonlyMap<string, UnihanReadings>;
  readonly traditional: TraditionalTable;
  readonly defaults: ReadonlyMap<string, readonly Syllable[]>;
}

/**
 * What one word contributed to the build's counts.
 *
 * The per-word view of {@link MergeStats}, minus the counts no single word can
 * move: `reducedNeutrals`, `repairedConstituents` and `composedTaiwanReadings`
 * are settled by passes over the whole dictionary, and `rejected` is counted by
 * the caller.
 */
export interface WordTally {
  readonly neutralToneCorrections: number;
  readonly erhuaRepairs: number;
  readonly derivedTraditional: number;
  readonly scriptPairs: number;
  readonly variantSpellings: number;
  readonly taiwanReadings: number;
  readonly properNounVetoes: number;
  readonly nameBoundaries: number;
  readonly characters: number;
  readonly phraseWords: number;
  readonly cedictWords: number;
}

/**
 * A word that contributed nothing, because no source could read it.
 */
export const NO_TALLY: WordTally = {
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
 * One word's entry, or the reading that failed.
 */
export interface MergedWord {
  readonly entry: DictionaryEntry | undefined;
  /** The reading no source could make sense of, where that is what happened. */
  readonly rejected: readonly string[] | undefined;
  readonly tally: WordTally;
}

/**
 * Add one word's tally to the running total.
 */
export function addTally(total: WordTally, tally: WordTally): WordTally {
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
