/**
 * Everything the merge decides about one word.
 *
 * The phases run in the order MERGE.md sets out and each depends on the one
 * before, so they stay in one function rather than becoming a pipeline of
 * small ones. What has changed is that the counts come back as a tally
 * instead of being written into eleven variables the caller owns.
 */
import { isSingleCharacter } from "../script/characters.js";
import { type DictionaryEntry, isSameReading } from "./entry.js";
import { readAlignedReading } from "./reading.js";
import { cedictReadingsOf } from "./cedict-senses.js";
import { traditionalFormOf } from "./traditional-form.js";
import { taiwanReadingOf } from "./taiwan-reading.js";
import { properNounOf } from "./proper-noun.js";
import { settleReading } from "./word-reading.js";
import { type MergedWord, NO_TALLY, type WordSources } from "./merge-types.js";

export type { MergedWord, WordSources, WordTally } from "./merge-types.js";

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
  if (settled.reading === undefined) {
    return {
      entry: undefined,
      rejected: phraseReading ?? cedictEntries[0]?.readings ?? [],
      tally: NO_TALLY,
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

  // ── zh-TW delta ───────────────────────────────────────────
  const taiwan = taiwanReadingOf(
    word,
    senses,
    senseReadings,
    reading,
    unihanReadings.get(word),
  );

  // ── Frequency, part of speech and the proper noun bit ─────
  const jiebaEntry = jieba.get(word);
  const { isProperNoun, boundaries, isVetoed } = properNounOf(
    word,
    jiebaEntry,
    cedictEntries,
    senses,
    reading,
  );

  // ── Polyphone priors, for single characters only ──────────
  const isCharacter = isSingleCharacter(word);
  const characterReadings = defaults.get(word) ?? [];
  const alternates = isCharacter
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
    partOfSpeech: jiebaEntry?.partOfSpeech ?? "",
    isProperNoun,
    ...(boundaries.length > 0 && { nameBoundaries: boundaries }),
    ...(alternates.length > 0 && { alternates }),
  };

  // Read off the decisions above rather than counted as they were made: every
  // one of these is a fact about the finished entry, so a running total would
  // only be a second place for it to be recorded.
  return {
    entry,
    rejected: undefined,
    tally: {
      neutralToneCorrections: settled.neutralToneCorrections,
      erhuaRepairs: settled.erhuaRepairs,
      derivedTraditional: isDerived ? 1 : 0,
      scriptPairs: hant === word ? 0 : 1,
      variantSpellings: hantVariants.length > 0 ? 1 : 0,
      taiwanReadings: taiwan === undefined ? 0 : 1,
      properNounVetoes: isVetoed ? 1 : 0,
      nameBoundaries: boundaries.length > 0 ? 1 : 0,
      characters: isCharacter ? 1 : 0,
      phraseWords: phraseReading === undefined ? 0 : 1,
      cedictWords: cedictEntries.length > 0 ? 1 : 0,
    },
  };
}
