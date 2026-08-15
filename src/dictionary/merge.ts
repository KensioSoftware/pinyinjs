import { isSingleCharacter } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { type DictionaryEntry, isSameReading } from "./entry.js";
import { composeLocaleDeltas } from "./locale.js";
import { NEUTRAL_SENSE_LOOKUP } from "./neutral-senses.js";
import { OVERRIDE_READINGS } from "./overrides.js";
import { readAlignedReading } from "./reading.js";
import {
  nearestReading,
  preferNeutralTones,
  reducesToNeutral,
} from "./reading-agreement.js";
import {
  cedictReadingsOf,
  indexCedict,
  isSpeltTraditionally,
} from "./cedict-senses.js";
import { buildCharacterDefaults } from "./character-defaults.js";
import { traditionalFormOf } from "./traditional-form.js";
import { taiwanReadingOf } from "./taiwan-reading.js";
import { properNounOf } from "./proper-noun.js";
import { repairErhua } from "./erhua-repair.js";
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
 * Build the merged dictionary from the four parsed sources.
 *
 * The order of operations is the one MERGE.md sets out, and it is not
 * arbitrary — each step depends on the one before. Spelling, tones, sandhi and
 * validation happen in {@link readAlignedReading} as each source is read; this
 * function then repairs 儿化, derives 繁體 forms, resolves the disagreements
 * between sources, and finally applies the override table.
 */
export function mergeSources(sources: MergeSources): MergeResult {
  const { unihanReadings, phrase, cedict, jieba } = sources;
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

  const entries: DictionaryEntry[] = [];
  const rejected = new Map<string, readonly string[]>();
  let neutralToneCorrections = 0;
  let erhuaRepairs = 0;
  let derivedTraditional = 0;
  let scriptPairs = 0;
  let variantSpellings = 0;
  let taiwanReadings = 0;
  let properNounVetoes = 0;
  let nameBoundaries = 0;
  let phraseWords = 0;
  let cedictWords = 0;
  let characters = 0;

  for (const word of [...words].toSorted(byCodeUnit)) {
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

    // ── The reading: phrase corpus leads, CC-CEDICT corrects ──
    let aligned = phraseAligned;
    let reading: readonly Syllable[] | undefined = aligned
      ?.map((read) => read.syllable)
      .filter((syllable) => syllable !== undefined);

    if (reading === undefined) {
      // No phrase entry. Single characters fall back to Unihan, which is the
      // better source for them anyway; everything else falls back to
      // CC-CEDICT.
      const characterDefault = defaults.get(word);
      if (isSingleCharacter(word) && characterDefault !== undefined) {
        reading = characterDefault.slice(0, 1);
        aligned = [{ characters: word, syllable: reading[0] }];
      } else if (cedictReadings[0] !== undefined) {
        reading = cedictReadings[0];
        aligned = readAlignedReading(word, cedictEntries[0]?.readings ?? []);
      }
    }

    if (reading === undefined || reading.length === 0) {
      rejected.set(word, phraseReading ?? cedictEntries[0]?.readings ?? []);
      continue;
    }

    // ── 儿化, before anything compares two readings ────────────
    const repaired = repairErhua(
      word,
      reading,
      aligned,
      cedictEntries,
      cedictReadings,
    );
    reading = repaired.reading;
    aligned = repaired.aligned;
    if (repaired.isRepaired) {
      erhuaRepairs++;
    }

    // ── Disagreements: CC-CEDICT wins on neutral tones ────────
    // Which sense to correct against is normally the nearest one. For a word on
    // the 轻声 list it is the nearest sense that *reduces* a syllable, because
    // there the nearest sense is the full-tone homograph the corpus happens to
    // have written and the everyday word is the other one — see
    // {@link NEUTRAL_SENSE_WORDS}.
    const chosen = reading;
    const nearest =
      phraseAligned === undefined
        ? undefined
        : ((NEUTRAL_SENSE_LOOKUP.has(word)
            ? nearestReading(
                chosen,
                cedictReadings.filter((candidate) =>
                  reducesToNeutral(chosen, candidate),
                ),
              )
            : undefined) ?? nearestReading(chosen, cedictReadings));
    // A sense of a different length describes a different pronunciation, so
    // there is no syllable-for-syllable correction to make against it.
    if (nearest !== undefined) {
      const corrected = preferNeutralTones(reading, nearest);
      if (!isSameReading(corrected, reading)) {
        neutralToneCorrections++;
        reading = corrected;
      }
    }

    // ── The override table has the last word ──────────────────
    const override = OVERRIDE_READINGS.get(word);
    if (override !== undefined) {
      reading = override;
    }

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

    entries.push({
      hans: word,
      hant,
      ...(hantVariants.length > 0 && { hantVariants }),
      readings: { cn: reading, ...(taiwan !== undefined && { tw: taiwan }) },
      frequency: jiebaEntry?.frequency ?? 0,
      partOfSpeech,
      isProperNoun,
      ...(boundaries.length > 0 && { nameBoundaries: boundaries }),
      ...(alternates.length > 0 && { alternates }),
    });

    if (isSingleCharacter(word)) {
      characters++;
    }
    if (phraseReading !== undefined) {
      phraseWords++;
    }
    if (cedictEntries.length > 0) {
      cedictWords++;
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
      characters,
      phraseWords,
      cedictWords,
      neutralToneCorrections,
      reducedNeutrals,
      erhuaRepairs,
      derivedTraditional,
      scriptPairs,
      variantSpellings,
      taiwanReadings,
      composedTaiwanReadings: localised.composed,
      properNounVetoes,
      nameBoundaries,
      rejected: rejected.size,
    },
  };
}
