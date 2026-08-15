/**
 * Reconciling the phrase corpus's reading of a word with CC-CEDICT's.
 *
 * The two sources disagree, and almost always about 轻声. These are the
 * measurements the merge uses to decide which of CC-CEDICT's senses is talking
 * about the same pronunciation, and how much of it to take.
 */
import type { CedictEntry } from "../sources/cedict.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { isErFinal, NON_ERHUA_ER_WORDS } from "./erhua.js";
import { readDictionaryReading } from "./reading.js";

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
export function preferNeutralTones(
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
export function isErhua(
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
 * Whether a candidate reads a syllable 轻声 that the chosen reading tones.
 *
 * What separates a sense that is the same word said more carefully from one
 * that is a different word: 东西's `dong1 xi5` reduces the `dōng xī` the corpus
 * wrote, while its `dong1 xi1` is that same reading and 行长's `háng zhang` has
 * a different initial. Length is checked because a reading of another length
 * describes another pronunciation entirely.
 */
export function reducesToNeutral(
  reading: readonly Syllable[],
  candidate: readonly Syllable[],
): boolean {
  if (reading.length !== candidate.length) {
    return false;
  }
  return reading.some((syllable, at) => {
    const other = candidate[at];
    return (
      other !== undefined &&
      syllable.initial === other.initial &&
      syllable.final === other.final &&
      syllable.tone !== NEUTRAL_TONE &&
      other.tone === NEUTRAL_TONE
    );
  });
}

/**
 * The candidate reading nearest the chosen one, or undefined if none compares.
 *
 * Undefined covers both having no candidates at all and having only candidates
 * of a different length, which describe a different pronunciation rather than a
 * more careful transcription of this one.
 */
export function nearestReading(
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
 * The CC-CEDICT senses describing the pronunciation chosen for a word.
 *
 * A word with several pronunciations has several CC-CEDICT entries, and they
 * can disagree about more than the reading: 万 is written 萬 when read `wàn` and
 * 万 when read `mò`. Everything taken from CC-CEDICT for an entry — its 繁體
 * form, its Taiwan reading — has to come from a sense that matches the reading,
 * or the entry ends up describing two different words at once.
 *
 * Every sense equally near the reading is returned, most useful first, because
 * senses can agree about the pronunciation and still differ about the script:
 * 重复 is `chóng fù` whether it is written 重複 or 重覆, and both spellings are
 * this word. The first is the entry's 繁體 form and the rest are its
 * {@link import("./entry.js").DictionaryEntry.hantVariants}.
 *
 * Where nothing compares — no sense has a readable reading of the same length —
 * only the first is returned. A tie between senses that could not be measured
 * is not evidence that they are the same word.
 */
export function sensesForReading(
  word: string,
  entries: readonly CedictEntry[],
  reading: readonly Syllable[],
): readonly CedictEntry[] {
  const measured = entries.map((entry) => {
    const candidate = readDictionaryReading(word, entry.readings);
    return {
      entry,
      gap: candidate === undefined ? Infinity : readingGap(reading, candidate),
    };
  });
  const nearest = Math.min(...measured.map(({ gap }) => gap));
  if (measured.length === 0 || nearest === Infinity) {
    return entries.slice(0, 1);
  }
  return measured
    .filter(({ gap }) => gap === nearest)
    .map(({ entry }) => entry);
}
