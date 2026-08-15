/**
 * What the merge takes in and what it hands back.
 *
 * Their own module so that a step of the merge can name them without
 * importing the merge itself.
 */
import type { CedictEntry } from "../sources/cedict.js";
import type { JiebaEntry } from "../sources/jieba.js";
import type { UnihanReadings, UnihanVariants } from "../sources/unihan.js";
import type { DictionaryEntry } from "./entry.js";

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
