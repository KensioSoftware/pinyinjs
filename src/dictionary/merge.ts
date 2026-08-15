import { characterCount, isSingleCharacter } from "../script/characters.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
import { type CedictEntry, nameBoundariesOf } from "../sources/cedict.js";
import { isProperNounTag, type JiebaEntry } from "../sources/jieba.js";
import type { UnihanReadings, UnihanVariants } from "../sources/unihan.js";
import type { Syllable } from "../syllable/syllable.js";
import { type DictionaryEntry, isSameReading } from "./entry.js";
import { attachErhua } from "./erhua.js";
import { composeLocaleDeltas } from "./locale.js";
import { NEUTRAL_SENSE_LOOKUP } from "./neutral-senses.js";
import { OVERRIDE_READINGS } from "./overrides.js";
import {
  ERHUA_TOKEN,
  readAlignedReading,
  readDictionaryReading,
} from "./reading.js";
import {
  isErhua,
  nearestReading,
  preferNeutralTones,
  reducesToNeutral,
  sensesForReading,
} from "./reading-agreement.js";
import {
  cedictReadingsOf,
  indexCedict,
  isOwnSense,
  isSenseScopedNote,
  isSpeltTraditionally,
} from "./cedict-senses.js";
import {
  buildCharacterDefaults,
  characterSyllable,
} from "./character-defaults.js";

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
    // Which sense matters: 万 is 萬 when read wàn but stays 万 when read mò, and
    // CC-CEDICT carries both as separate entries. Taking whichever came first
    // in the file would pair the chosen reading with another sense's script.
    const senses = sensesForReading(word, cedictEntries, reading);
    const sense = senses[0];
    let hant: string;
    if (sense === undefined) {
      // Canonicalised because the derivation settles each word against Unihan's
      // variant lists with no single standard behind it, so 里 derives as 裏
      // where the corpus overwhelmingly writes 裡. Both are the same character
      // with the same reading, and a key written in the form the lookup path
      // normalises *away from* can never be found — see the note below.
      hant = toCanonicalGlyphs(traditional.convert(aligned ?? []));
      if (hant !== word) {
        derivedTraditional++;
      }
    } else {
      hant = toCanonicalGlyphs(sense.traditional);
    }
    if (hant !== word) {
      scriptPairs++;
    }

    // Other spellings of the same word, so that a 繁體 reader of either finds
    // it. Only what a source writes out: composing spellings from per-character
    // variants instead would add 229,482 keys to the full tier, almost all of
    // them forms nobody writes — 方麵 for 方面, 公裡 for 公里 — because the
    // reading that picks the right variant for one word does not generalise to
    // every word the character appears in.
    //
    // Canonicalised for the same reason `hant` is, and deduplicated after:
    // 裏面 and 裡面 are one spelling once the glyph forms are folded, and
    // keying both would claim a variant that does not exist.
    //
    // The 简体 headword's own canonical spelling joins them where it differs,
    // and that is not a nicety: the lookup path normalises 繁體 glyph forms
    // before it searches, so a key written in a form it normalises *away from*
    // can never be found. The phrase corpus carries a few hundred headwords
    // spelled with 峯, 藴 or 枱 — 鹫峯寺, 义藴, 写字枱 — and without this they
    // are entries nothing can reach.
    const hantVariants = [
      ...new Set([
        ...senses.map((other) => toCanonicalGlyphs(other.traditional)),
        toCanonicalGlyphs(word),
      ]),
    ].filter((form) => form !== hant && form !== word);
    if (hantVariants.length > 0) {
      variantSpellings++;
    }

    // ── zh-TW delta ───────────────────────────────────────────
    // Only from a sense that reads the way this entry reads. CC-CEDICT hangs
    // `Taiwan pr.` on one sense of a headword and the others know nothing about
    // it: 著 is marked `zhuó` on the chess-move sense that reads `zhāo`, and
    // reaching across for it gave the aspect particle 着 a 國語 reading of
    // `zhuó`.
    //
    // A note can also sit on a sense of the *right* reading and still not be
    // about the character — see `isSenseScopedNote`.
    const taiwanSense = senses.find(
      (entry) => entry.taiwanReadings !== undefined,
    );
    const taiwanTokens = isSenseScopedNote(word, taiwanSense)
      ? undefined
      : taiwanSense?.taiwanReadings;
    const unihanTaiwan = unihanReadings.get(word)?.taiwanReading;
    let taiwan: readonly Syllable[] | undefined;
    if (taiwanTokens !== undefined) {
      taiwan = readDictionaryReading(word, taiwanTokens);
    } else if (isSingleCharacter(word) && unihanTaiwan !== undefined) {
      const syllable = characterSyllable(word, unihanTaiwan);
      taiwan = syllable === undefined ? undefined : [syllable];
    }
    if (
      taiwan !== undefined &&
      (isSameReading(taiwan, reading) || isOwnSense(taiwan, senseReadings))
    ) {
      taiwan = undefined;
    }
    if (taiwan !== undefined) {
      taiwanReadings++;
    }

    // ── Frequency, part of speech and the proper noun bit ─────
    const jiebaEntry = jieba.get(word);
    const partOfSpeech = jiebaEntry?.partOfSpeech ?? "";
    // jieba's tags propose a proper noun and CC-CEDICT's capitalisation can
    // veto it. The tags on their own are noisy enough to be worth correcting:
    // 沙发, 城市, 阿姨, 智能卡 and 花生仁 are all tagged nr or nz, and the
    // decoder capitalises straight off this bit, so 我买了一个沙发 came out as
    // `Wǒ mǎile yīge Shāfā`.
    //
    // The veto only ever demotes, never promotes. CC-CEDICT capitalises the
    // pinyin of a proper noun, which is a claim about the word rather than a
    // category it was sorted into — but it also capitalises any headword
    // written with Latin letters, so a capital there is not proof on its own.
    // A lowercase one is much better evidence, since nothing else would write
    // it that way.
    const isProperNoun =
      jiebaEntry === undefined
        ? cedictEntries.some((entry) => entry.isProperNoun)
        : isProperNounTag(partOfSpeech) &&
          (senses.length === 0 || senses.some((entry) => entry.isProperNoun));
    if (isProperNounTag(partOfSpeech) && !isProperNoun) {
      properNounVetoes++;
    }

    // ── Where the 姓 ends, where CC-CEDICT says so ────────────
    // Only for a word that survived the veto above: an entry no one takes for a
    // proper noun has no 姓 to end. The boundary counts characters, so it is
    // only meaningful where this word reads one syllable per character — 儿化
    // reads two characters as one syllable and could not be cut by it.
    const isAligned = characterCount(word) === reading.length;
    const boundaries =
      isProperNoun && isAligned
        ? (cedictEntries
            .map((entry) => nameBoundariesOf(entry.readings))
            .find((found) => found.length > 0) ?? [])
        : [];
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
