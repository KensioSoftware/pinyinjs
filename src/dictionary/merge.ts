import { isSingleCharacter } from "../script/characters.js";
import type { CedictEntry } from "../sources/cedict.js";
import { isProperNounTag, type JiebaEntry } from "../sources/jieba.js";
import {
  FREQUENCY_FIELD,
  type UnihanReadings,
  type UnihanVariants,
} from "../sources/unihan.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { type DictionaryEntry, isSameReading } from "./entry.js";
import { attachErhua, isErFinal, NON_ERHUA_ER_WORDS } from "./erhua.js";
import { OVERRIDE_READINGS } from "./overrides.js";
import {
  ERHUA_TOKEN,
  readAlignedReading,
  readDictionaryReading,
} from "./reading.js";
import {
  pairScripts,
  type ScriptPairing,
  TraditionalTable,
} from "./traditional.js";

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
  /** Words whose trailing 儿 was folded into the syllable before it. */
  readonly erhuaRepairs: number;
  /** Words whose 繁體 form was derived rather than taken from CC-CEDICT. */
  readonly derivedTraditional: number;
  /** Entries with a 繁體 form differing from their 简体 one. */
  readonly scriptPairs: number;
  /** Entries carrying a zh-TW reading delta. */
  readonly taiwanReadings: number;
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
 * Order two strings by UTF-16 code unit, matching the key index's ordering.
 */
function byCodeUnit(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * CC-CEDICT's entries for a word, keyed by its 简体 form.
 */
function indexCedict(
  cedict: readonly CedictEntry[],
): ReadonlyMap<string, readonly CedictEntry[]> {
  const byWord = new Map<string, CedictEntry[]>();
  for (const entry of cedict) {
    const existing = byWord.get(entry.simplified);
    if (existing === undefined) {
      byWord.set(entry.simplified, [entry]);
    } else {
      existing.push(entry);
    }
  }
  return byWord;
}

/**
 * How far apart two readings of the same length are.
 *
 * Used to pick which of CC-CEDICT's senses to compare against, since a word
 * with several senses has several readings and only the nearest one is talking
 * about the same pronunciation.
 *
 * A difference in spelling counts for more than a difference in tone, and the
 * distinction decides real cases. 行长 is `xíng zhǎng` in one CC-CEDICT sense
 * and `háng zhang` in another; against the phrase corpus's `háng zhǎng` the two
 * differ in one syllable each, but only the second is the same word — the first
 * has a different initial, so it is a different word that happens to be
 * written the same way.
 */
function readingGap(
  left: readonly Syllable[],
  right: readonly Syllable[],
): number {
  if (left.length !== right.length) {
    return Infinity;
  }
  let spelling = 0;
  let tones = 0;
  for (const [at, syllable] of left.entries()) {
    /* c8 ignore next -- the lengths match, so the fallback is unreachable */
    const other = right[at] ?? syllable;
    if (syllable.initial !== other.initial || syllable.final !== other.final) {
      spelling++;
    } else if (syllable.tone !== other.tone) {
      tones++;
    }
  }
  // Scaled so that any number of tone differences still beats one spelling
  // difference.
  return spelling * (left.length + 1) + tones;
}

/**
 * Take CC-CEDICT's neutral tones where it and the phrase corpus disagree.
 *
 * The disagreements between the two are almost entirely about 轻声, and
 * CC-CEDICT is the more careful source there: it has 头发 as `tou2 fa5` and
 * 还是 as `hai2 shi5` where the phrase corpus writes full tones on both. Only
 * the tone is taken, and only when it is neutral — a disagreement about the
 * syllable itself is left to the phrase corpus, which has three times the
 * coverage and is the primary source.
 *
 * The two readings must be the same length, which the caller establishes by
 * only passing a sense {@link readingGap} scored as finite.
 */
function preferNeutralTones(
  phrase: readonly Syllable[],
  cedict: readonly Syllable[],
): readonly Syllable[] {
  return phrase.map((syllable, at) => {
    /* c8 ignore next -- the caller only passes a sense of the same length */
    const other = cedict[at] ?? syllable;
    const isSameSound =
      syllable.initial === other.initial && syllable.final === other.final;
    return isSameSound &&
      other.tone === NEUTRAL_TONE &&
      syllable.tone !== NEUTRAL_TONE
      ? { ...syllable, tone: NEUTRAL_TONE }
      : syllable;
  });
}

/**
 * Whether a word's trailing 儿 is an r suffix rather than a syllable.
 *
 * CC-CEDICT decides wherever it has the word, because its `r5` token is an
 * explicit and reliable marker. Only where it is silent does the checked-in
 * exception list get a say, and there the default is 儿化 — a trailing 儿 is
 * far more often a diminutive suffix than the word 儿 itself.
 */
function isErhua(
  word: string,
  cedictReadings: readonly (readonly Syllable[])[],
): boolean {
  if (!isErFinal(word)) {
    return false;
  }
  if (cedictReadings.length > 0) {
    return cedictReadings.some((reading) => reading.at(-1)?.erhua === true);
  }
  return !NON_ERHUA_ER_WORDS.has(word);
}

/**
 * The candidate reading nearest the chosen one, or undefined if none compares.
 *
 * Undefined covers both having no candidates at all and having only candidates
 * of a different length, which describe a different pronunciation rather than a
 * more careful transcription of this one.
 */
function nearestReading(
  reading: readonly Syllable[],
  candidates: readonly (readonly Syllable[])[],
): readonly Syllable[] | undefined {
  let nearest: readonly Syllable[] | undefined;
  let smallest = Infinity;
  for (const candidate of candidates) {
    const gap = readingGap(reading, candidate);
    if (gap < smallest) {
      nearest = candidate;
      smallest = gap;
    }
  }
  return nearest;
}

/**
 * The CC-CEDICT sense whose reading is nearest the one chosen for a word.
 *
 * A word with several pronunciations has several CC-CEDICT entries, and they
 * can disagree about more than the reading: 万 is written 萬 when read `wàn` and
 * 万 when read `mò`. Everything taken from CC-CEDICT for an entry — its 繁體
 * form, its Taiwan reading — has to come from the sense that matches the
 * reading, or the entry ends up describing two different words at once.
 */
function nearestSense(
  word: string,
  entries: readonly CedictEntry[],
  reading: readonly Syllable[],
): CedictEntry | undefined {
  let best: CedictEntry | undefined;
  let bestDistance = Infinity;
  for (const entry of entries) {
    const candidate = readDictionaryReading(word, entry.readings);
    const gap =
      candidate === undefined ? Infinity : readingGap(reading, candidate);
    if (best === undefined || gap < bestDistance) {
      best = entry;
      bestDistance = gap;
    }
  }
  return best;
}

/**
 * A word's readings as CC-CEDICT gives them, one per sense.
 */
function cedictReadingsOf(
  word: string,
  entries: readonly CedictEntry[],
): readonly (readonly Syllable[])[] {
  return entries
    .map((entry) => readDictionaryReading(word, entry.readings))
    .filter((reading) => reading !== undefined);
}

/**
 * Strip the tone marks from a reading, for comparing two spellings.
 */
function tonelessReading(reading: string): string {
  return reading.normalize("NFD").replaceAll(/[̀́̄̌]/gu, "").normalize("NFC");
}

/**
 * Whether a reading carries a tone mark.
 */
function isToneMarked(reading: string): boolean {
  return tonelessReading(reading) !== reading;
}

/**
 * Put back a tone that `kHanyuPinlu` left off.
 *
 * The frequency field writes some readings without their tone mark: 李 is
 * `li(36)` there where every dictionary field writes `lǐ`. Read as 轻声 — which
 * is what an unmarked reading means in source data — that makes 李华 come out
 * `Li Huá`, and it is the only Unihan field this happens in.
 *
 * The other fields settle which it is. If they also write the spelling bare,
 * the neutral tone is real and 么, 们, 吧, 裳 keep it. If every one of them
 * writes it with a tone, the frequency field simply omitted the mark, and the
 * tone is taken back. Measured over the real file, 3,799 characters have a
 * `kHanyuPinlu` entry, 60 of those have only unmarked readings, and the split
 * is 45 that should carry a tone against 15 genuine 轻声.
 */
function resolveFrequencyTones(unihan: UnihanReadings): readonly string[] {
  const frequencyReadings = unihan.fields.get(FREQUENCY_FIELD) ?? [];
  // A character whose frequency field marks any tone is already trustworthy:
  // there the unmarked readings sit alongside marked ones and mean 轻声.
  if (
    frequencyReadings.length === 0 ||
    frequencyReadings.some((reading) => isToneMarked(reading))
  ) {
    return unihan.readings;
  }

  const elsewhere = [...unihan.fields]
    .filter(([field]) => field !== FREQUENCY_FIELD)
    .flatMap(([, readings]) => readings);

  return unihan.readings.map((reading) => {
    if (isToneMarked(reading)) {
      return reading;
    }
    const sameSpelling = elsewhere.filter(
      (other) => tonelessReading(other) === reading,
    );
    if (sameSpelling.length === 0 || sameSpelling.includes(reading)) {
      return reading;
    }
    return sameSpelling.find((other) => isToneMarked(other)) ?? reading;
  });
}

/**
 * Parse a Unihan reading string for one character.
 *
 * Goes through the dictionary reader so that a Unihan reading gets the same
 * treatment as any other source's: an unmarked tone means neutral, and 一 and
 * 不 are restored to their underlying tones.
 */
function characterSyllable(
  character: string,
  reading: string,
): Syllable | undefined {
  return readDictionaryReading(character, [reading])?.[0];
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
  const { unihanReadings, unihanVariants, phrase, cedict, jieba } = sources;
  const cedictByWord = indexCedict(cedict);

  // ── Character defaults, which every later step leans on ────
  const defaults = new Map<string, readonly Syllable[]>();
  for (const [character, readings] of unihanReadings) {
    const parsed = resolveFrequencyTones(readings)
      .map((reading) => characterSyllable(character, reading))
      .filter((syllable) => syllable !== undefined);
    if (parsed.length > 0) {
      defaults.set(character, parsed);
    }
  }

  // ── 繁體 evidence, mined from CC-CEDICT's own pairings ──────
  const pairings: ScriptPairing[] = [];
  for (const entry of cedict) {
    const aligned = readAlignedReading(entry.simplified, entry.readings);
    pairings.push(...pairScripts(entry.simplified, entry.traditional, aligned));
  }
  const traditional = TraditionalTable.build(
    pairings,
    unihanVariants,
    unihanReadings,
  );

  const words = new Set<string>([
    ...defaults.keys(),
    ...phrase.keys(),
    ...cedictByWord.keys(),
  ]);

  const entries: DictionaryEntry[] = [];
  const rejected = new Map<string, readonly string[]>();
  let neutralToneCorrections = 0;
  let erhuaRepairs = 0;
  let derivedTraditional = 0;
  let scriptPairs = 0;
  let taiwanReadings = 0;
  let phraseWords = 0;
  let cedictWords = 0;
  let characters = 0;

  for (const word of [...words].toSorted(byCodeUnit)) {
    const cedictEntries = cedictByWord.get(word) ?? [];
    const cedictReadings = cedictReadingsOf(word, cedictEntries);
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
    if (isErhua(word, cedictReadings)) {
      const attached = attachErhua(reading);
      if (attached !== reading) {
        erhuaRepairs++;
        reading = attached;
        // Fold the alignment the same way, so the 繁體 derivation still knows
        // which character each syllable reads.
        const last = aligned?.at(-1);
        const previous = aligned?.at(-2);
        if (
          aligned !== undefined &&
          last !== undefined &&
          previous !== undefined
        ) {
          aligned = [
            ...aligned.slice(0, -2),
            {
              characters: previous.characters + last.characters,
              syllable: attached.at(-1),
            },
          ];
        }
      }
    } else if (reading.every((syllable) => syllable.erhua !== true)) {
      // 儿化 in the middle of a word, which the trailing repair above cannot
      // reach: 一点儿事 is `yìdiǎnr shì`, three syllables over four characters,
      // and the phrase corpus writes four. Only CC-CEDICT's `r5` marks it, and
      // only it knows where, so where it does the whole reading is taken from
      // it — 53 of its 683 `r5` entries carry the marker mid-word.
      const marked = cedictEntries.find((entry) =>
        entry.readings.includes(ERHUA_TOKEN),
      );
      const markedAligned =
        marked === undefined
          ? undefined
          : readAlignedReading(word, marked.readings);
      if (markedAligned !== undefined) {
        erhuaRepairs++;
        aligned = markedAligned;
        reading = markedAligned
          .map((read) => read.syllable)
          .filter((syllable) => syllable !== undefined);
      }
    }

    // ── Disagreements: CC-CEDICT wins on neutral tones ────────
    const nearest =
      phraseAligned === undefined
        ? undefined
        : nearestReading(reading, cedictReadings);
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
    // Which sense matters: 万 is 萬 when read wàn but stays 万 when read mò, and
    // CC-CEDICT carries both as separate entries. Taking whichever came first
    // in the file would pair the chosen reading with another sense's script.
    const sense = nearestSense(word, cedictEntries, reading);
    let hant: string;
    if (sense === undefined) {
      hant = traditional.convert(aligned ?? []);
      if (hant !== word) {
        derivedTraditional++;
      }
    } else {
      hant = sense.traditional;
    }
    if (hant !== word) {
      scriptPairs++;
    }

    // ── zh-TW delta ───────────────────────────────────────────
    const taiwanTokens =
      sense?.taiwanReadings ??
      cedictEntries.find((entry) => entry.taiwanReadings !== undefined)
        ?.taiwanReadings;
    const unihanTaiwan = unihanReadings.get(word)?.taiwanReading;
    let taiwan: readonly Syllable[] | undefined;
    if (taiwanTokens !== undefined) {
      taiwan = readDictionaryReading(word, taiwanTokens);
    } else if (isSingleCharacter(word) && unihanTaiwan !== undefined) {
      const syllable = characterSyllable(word, unihanTaiwan);
      taiwan = syllable === undefined ? undefined : [syllable];
    }
    if (taiwan !== undefined && isSameReading(taiwan, reading)) {
      taiwan = undefined;
    }
    if (taiwan !== undefined) {
      taiwanReadings++;
    }

    // ── Frequency, part of speech and the proper noun bit ─────
    const jiebaEntry = jieba.get(word);
    const partOfSpeech = jiebaEntry?.partOfSpeech ?? "";
    // jieba's tags are the primary signal. CC-CEDICT's capitalisation only gets
    // a say where jieba has no entry at all, since it is corroboration rather
    // than proof: a headword with Latin letters reads as capitalised without
    // being a proper noun.
    const isProperNoun =
      jiebaEntry === undefined
        ? cedictEntries.some((entry) => entry.isProperNoun)
        : isProperNounTag(partOfSpeech);

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
      readings: { cn: reading, ...(taiwan !== undefined && { tw: taiwan }) },
      frequency: jiebaEntry?.frequency ?? 0,
      partOfSpeech,
      isProperNoun,
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

  return {
    entries,
    rejected,
    stats: {
      characters,
      phraseWords,
      cedictWords,
      neutralToneCorrections,
      erhuaRepairs,
      derivedTraditional,
      scriptPairs,
      taiwanReadings,
      rejected: rejected.size,
    },
  };
}
