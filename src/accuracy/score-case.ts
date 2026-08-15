/**
 * Scoring how a transcription capitalised, against how this library would.
 *
 * Aligned on the toneless spellings so that one dropped syllable is one
 * mistake rather than every syllable after it.
 */
import { type AccuracyTally, emptyTally } from "./score.js";
import { alignSequences } from "./align.js";
import {
  comparableSyllable,
  tokenisePinyin,
  tonelessSyllable,
} from "./tokenise.js";

/**
 * Whether a syllable is written with a capital letter.
 *
 * Comparing the first character against its own lower case settles it without a
 * special case for empty text, which reports as uncapitalised.
 */
export function isCapitalised(syllable: string): boolean {
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
