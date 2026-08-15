/**
 * Everything the merge decides about one word.
 *
 * The phases run in the order MERGE.md sets out and each depends on the one
 * before, so they stay in one function rather than becoming a pipeline of
 * small ones. What has changed is that the counts come back as a tally
 * instead of being written into eleven variables the caller owns.
 */
import { isSingleCharacter } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { type DictionaryEntry, isSameReading } from "./entry.js";
import { readAlignedReading } from "./reading.js";
import { cedictReadingsOf } from "./cedict-senses.js";
import { traditionalFormOf } from "./traditional-form.js";
import { taiwanReadingOf } from "./taiwan-reading.js";
import { properNounOf } from "./proper-noun.js";
import { settleReading } from "./word-reading.js";

import type { CedictEntry } from "../sources/cedict.js";
import type { JiebaEntry } from "../sources/jieba.js";
import type { UnihanReadings } from "../sources/unihan.js";
import type { TraditionalTable } from "./traditional-table.js";

/**
 * What one word contributed to the build's counts.
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
const NOTHING: WordTally = {
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
 * What the sources between them say, indexed once for every word.
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
 * One word's entry, or the reading that failed.
 */
export interface MergedWord {
  readonly entry: DictionaryEntry | undefined;
  /** The reading no source could make sense of, where that is what happened. */
  readonly rejected: readonly string[] | undefined;
  readonly tally: WordTally;
}

/**
 * Merge one word.
 */
export function mergeWord(word: string, sources: WordSources): MergedWord {
  const {
    cedictByWord,
    cedictByHant,
    phrase,
    jieba,
    unihanReadings,
    traditional,
    defaults,
  } = sources;
  let neutralToneCorrections = 0;
  let erhuaRepairs = 0;
  let derivedTraditional = 0;
  let scriptPairs = 0;
  let variantSpellings = 0;
  let taiwanReadings = 0;
  let properNounVetoes = 0;
  let nameBoundaries = 0;
  let characters = 0;
  let phraseWords = 0;
  let cedictWords = 0;

  const cedictEntries = cedictByWord.get(word) ?? [];
  const cedictReadings = cedictReadingsOf(word, cedictEntries);
  // Every reading CC-CEDICT gives this spelling, under either script.
  const senseReadings = [
    ...cedictReadings,
    ...cedictReadingsOf(word, cedictByHant.get(word) ?? []),
  ];
  const phraseReading = phrase.get(word);
  const phraseAligned =
    phraseReading === undefined
      ? undefined
      : readAlignedReading(word, phraseReading);

  const settled = settleReading(
    word,
    defaults,
    cedictEntries,
    cedictReadings,
    phraseAligned,
  );
  neutralToneCorrections += settled.neutralToneCorrections;
  erhuaRepairs += settled.erhuaRepairs;
  if (settled.reading === undefined) {
    return {
      entry: undefined,
      rejected: phraseReading ?? cedictEntries[0]?.readings ?? [],
      tally: NOTHING,
    };
  }
  const reading = settled.reading;
  const aligned = settled.aligned;

  // ── 繁體: taken from CC-CEDICT, derived where it is silent ─
  const { senses, hant, hantVariants, isDerived } = traditionalFormOf(
    word,
    cedictEntries,
    reading,
    aligned,
    traditional,
  );
  if (isDerived) {
    derivedTraditional++;
  }
  if (hant !== word) {
    scriptPairs++;
  }
  if (hantVariants.length > 0) {
    variantSpellings++;
  }

  // ── zh-TW delta ───────────────────────────────────────────
  const taiwan = taiwanReadingOf(
    word,
    senses,
    senseReadings,
    reading,
    unihanReadings.get(word),
  );
  if (taiwan !== undefined) {
    taiwanReadings++;
  }

  // ── Frequency, part of speech and the proper noun bit ─────
  const jiebaEntry = jieba.get(word);
  const partOfSpeech = jiebaEntry?.partOfSpeech ?? "";
  const { isProperNoun, boundaries, isVetoed } = properNounOf(
    word,
    jiebaEntry,
    cedictEntries,
    senses,
    reading,
  );
  if (isVetoed) {
    properNounVetoes++;
  }
  if (boundaries.length > 0) {
    nameBoundaries++;
  }

  // ── Polyphone priors, for single characters only ──────────
  const characterReadings = defaults.get(word) ?? [];
  const alternates = isSingleCharacter(word)
    ? characterReadings
        .filter((syllable) => !isSameReading([syllable], reading))
        .map((syllable) => [syllable])
    : [];

  const entry: DictionaryEntry = {
    hans: word,
    hant,
    ...(hantVariants.length > 0 && { hantVariants }),
    readings: { cn: reading, ...(taiwan !== undefined && { tw: taiwan }) },
    frequency: jiebaEntry?.frequency ?? 0,
    partOfSpeech,
    isProperNoun,
    ...(boundaries.length > 0 && { nameBoundaries: boundaries }),
    ...(alternates.length > 0 && { alternates }),
  };

  if (isSingleCharacter(word)) {
    characters++;
  }
  if (phraseReading !== undefined) {
    phraseWords++;
  }
  if (cedictEntries.length > 0) {
    cedictWords++;
  }

  const tally: WordTally = {
    neutralToneCorrections,
    erhuaRepairs,
    derivedTraditional,
    scriptPairs,
    variantSpellings,
    taiwanReadings,
    properNounVetoes,
    nameBoundaries,
    characters,
    phraseWords,
    cedictWords,
  };
  return { entry, rejected: undefined, tally };
}
