/**
 * Matching the expected syllables up with the typed ones.
 *
 * Aligned on the toneless spellings, so one dropped syllable is one mistake
 * rather than a mistake on every syllable after it.
 */
import type { PinyinVerdict, SpacingVerdict } from "./check.js";
import { alignSequences } from "../accuracy/align.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import type { ExpectedSyllable, TypedSyllable } from "./check-readings.js";

/**
 * Which expected syllable a typed one was matched with, where either has one.
 */
interface Pairing {
  readonly expected: number | undefined;
  readonly actual: number | undefined;
}

/**
 * Match the expected syllables up with the typed ones.
 *
 * Aligned on the toneless spellings, for the reason
 * {@link import("../accuracy/score.js").scoreCase} aligns on them: a syllable
 * dropped or invented halfway through would otherwise knock everything after it
 * out of step, and be reported as a mistake on every syllable rather than on
 * the one.
 *
 * What the alignment leaves over is then paired off within each gap, which is
 * what turns two unrelated stretches into substitutions: 银行 typed `yínxíng`
 * anchors on `yín`, leaving one expected `háng` against one typed `xíng` — one
 * wrong syllable rather than one missing and one invented.
 */
export function pairSyllables(
  expected: readonly string[],
  actual: readonly string[],
): readonly Pairing[] {
  const pairs: Pairing[] = [];
  let held = 0;
  let typed = 0;

  const gap = (untilExpected: number, untilActual: number): void => {
    while (held < untilExpected || typed < untilActual) {
      const takesExpected = held < untilExpected;
      const takesActual = typed < untilActual;
      pairs.push({
        expected: takesExpected ? held : undefined,
        actual: takesActual ? typed : undefined,
      });
      held += takesExpected ? 1 : 0;
      typed += takesActual ? 1 : 0;
    }
  };

  for (const anchor of alignSequences(expected, actual)) {
    gap(anchor.expected, anchor.actual);
    pairs.push({ expected: held, actual: typed });
    held++;
    typed++;
  }
  gap(expected.length, actual.length);

  return pairs;
}

/**
 * What a typed syllable is, against what was expected in its place.
 *
 * The neutral tone is the one tone pinyin writes with no mark at all, so a
 * syllable expected in it and typed without one has had its tone written
 * correctly rather than left off.
 */
export function verdictFor(
  expected: ExpectedSyllable,
  actual: TypedSyllable,
): PinyinVerdict {
  const tones = expected.accepted.get(actual.base);
  if (tones === undefined) {
    return "wrong";
  }
  if (actual.tone === undefined) {
    return tones.has(NEUTRAL_TONE) ? "correct" : "toneless";
  }
  return tones.has(actual.tone) ? "correct" : "tone";
}

/**
 * Where a typed syllable falls against the word boundaries.
 */
export function spacingFor(
  expected: ExpectedSyllable,
  actual: TypedSyllable,
): SpacingVerdict {
  if (actual.startsWord) {
    return expected.acceptsBreak ? "correct" : "split";
  }
  return expected.acceptsJoin ? "correct" : "joined";
}

/**
 * What is required of a check beyond reading the syllables right.
 */
