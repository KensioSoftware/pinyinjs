import { alignSequences } from "./align.js";
import {
  comparableSyllable,
  tokenisePinyin,
  tonelessSyllable,
} from "./tokenise.js";

/**
 * Raw tallies from comparing conversions against their expected pinyin.
 *
 * Counts rather than percentages, so that scores from separate runs can be
 * summed before any ratio is taken.
 */
export interface AccuracyTally {
  cases: number;
  exact: number;
  expectedSyllables: number;
  actualSyllables: number;
  /** Syllables whose reading is right once tone is set aside. */
  bases: number;
  /** Syllables whose reading is right including tone. */
  readings: number;
  /** Syllables written with the expected capitalisation. */
  capitals: number;
  /** Word boundaries found in both the expected and actual conversion. */
  boundaryHits: number;
  expectedBoundaries: number;
  actualBoundaries: number;
}

/**
 * An empty tally, ready to accumulate into.
 */
export function emptyTally(): AccuracyTally {
  return {
    cases: 0,
    exact: 0,
    expectedSyllables: 0,
    actualSyllables: 0,
    bases: 0,
    readings: 0,
    capitals: 0,
    boundaryHits: 0,
    expectedBoundaries: 0,
    actualBoundaries: 0,
  };
}

/**
 * Whether a syllable is written with a capital letter.
 *
 * Comparing the first character against its own lower case settles it without a
 * special case for empty text, which reports as uncapitalised.
 */
function isCapitalised(syllable: string): boolean {
  const first = syllable.slice(0, 1);
  return first !== first.toLowerCase();
}

/**
 * Compare one conversion against its expected pinyin, adding to a tally.
 *
 * Readings and spacing are scored separately and deliberately: a wrong reading
 * is an error, whereas wrong spacing is merely untidy, so they must not be
 * averaged into a single number that hides which one moved.
 */
export function scoreCase(
  expectedText: string,
  actualText: string,
  tally: AccuracyTally = emptyTally(),
): AccuracyTally {
  const expected = tokenisePinyin(expectedText);
  const actual = tokenisePinyin(actualText);

  tally.cases++;
  if (expectedText.trim() === actualText.trim()) {
    tally.exact++;
  }
  tally.expectedSyllables += expected.syllables.length;
  tally.actualSyllables += actual.syllables.length;
  tally.expectedBoundaries += expected.wordStarts.size;
  tally.actualBoundaries += actual.wordStarts.size;

  // Align on toneless readings so that a wrong tone costs a tone rather than
  // knocking every later syllable out of step.
  const pairs = alignSequences(
    expected.syllables.map((syllable) => tonelessSyllable(syllable)),
    actual.syllables.map((syllable) => tonelessSyllable(syllable)),
  );

  const actualToExpected = new Map<number, number>();
  for (const pair of pairs) {
    actualToExpected.set(pair.actual, pair.expected);
    const expectedSyllable = expected.syllables[pair.expected] ?? "";
    const actualSyllable = actual.syllables[pair.actual] ?? "";
    tally.bases++;
    if (
      comparableSyllable(expectedSyllable) ===
      comparableSyllable(actualSyllable)
    ) {
      tally.readings++;
    }
    if (isCapitalised(expectedSyllable) === isCapitalised(actualSyllable)) {
      tally.capitals++;
    }
  }

  for (const start of actual.wordStarts) {
    const mapped = actualToExpected.get(start);
    if (mapped !== undefined && expected.wordStarts.has(mapped)) {
      tally.boundaryHits++;
    }
  }

  return tally;
}

/**
 * Accuracy percentages derived from a tally.
 */
export interface AccuracyReport {
  /** Conversions matching their expected pinyin character for character. */
  readonly exact: number;
  /** Syllables read correctly, including tone. */
  readonly readings: number;
  /** Syllables read correctly once tone is set aside. */
  readonly bases: number;
  /** Tones correct, of the syllables that were otherwise read correctly. */
  readonly tones: number;
  /** Syllables written with the expected capitalisation. */
  readonly capitals: number;
  /** F1 over word boundaries. */
  readonly spacing: number;
}

/**
 * Turn counts into percentages, guarding against division by zero.
 */
function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : (100 * numerator) / denominator;
}

/**
 * Derive accuracy percentages from a tally.
 */
export function report(tally: AccuracyTally): AccuracyReport {
  const precision = ratio(tally.boundaryHits, tally.actualBoundaries);
  const recall = ratio(tally.boundaryHits, tally.expectedBoundaries);
  const total = precision + recall;

  // Measured against whichever sequence is longer, so that inventing a syllable
  // costs as much as dropping one. Scoring against the expected length alone
  // would let a converter emit spurious syllables for free.
  const syllables = Math.max(tally.expectedSyllables, tally.actualSyllables);

  return {
    exact: ratio(tally.exact, tally.cases),
    readings: ratio(tally.readings, syllables),
    bases: ratio(tally.bases, syllables),
    tones: ratio(tally.readings, tally.bases),
    capitals: ratio(tally.capitals, syllables),
    spacing: total === 0 ? 0 : (2 * precision * recall) / total,
  };
}
