import type { Syllable } from "../syllable/syllable.js";
import { cutPoints, type Lattice, READING_CHARGE } from "./lattice.js";
import {
  isSettled,
  type ReadingProjection,
  type ReadingUnit,
  settledUnits,
} from "./locking.js";
import { scoreStretch } from "./alternatives.js";

/**
 * A reading the decode considered at a position and did not take.
 *
 * The span is carried because a rejected reading need not cover the same
 * characters as the one that won: 玩儿 read as `wánr` competes with 玩 `wán`
 * followed by 儿 `ér`, and those are claims about different stretches.
 */
export interface ReadingAlternative {
  readonly from: number;
  readonly to: number;
  readonly reading: readonly Syllable[];
  /**
   * How much more the cheapest decode taking this reading would have cost.
   *
   * In the reading decode's own units, where a step of one is one frequency
   * bucket. Zero means a tie: another reading was available for the same price
   * and the decode had nothing to separate them by.
   */
  readonly cost: number;
}

/**
 * How settled one decoded reading was.
 */
export interface ReadingConfidence {
  /**
   * Whether the reading projection locked this reading before any scoring.
   *
   * A locked reading is not a confident guess but the only reading on offer:
   * every path through the lattice agrees on it, so no cost model could have
   * changed it. Locked implies no alternatives.
   */
  readonly isLocked: boolean;
  /** What the decode rejected, cheapest first. */
  readonly alternatives: readonly ReadingAlternative[];
}

/**
 * A decoded reading unit together with what choosing it rejected.
 */
export interface ScoredUnit extends ReadingUnit, ReadingConfidence {}

/**
 * Whether a reading was settled by something weaker than dictionary evidence.
 *
 * The reading decode charges {@link READING_CHARGE} per edge, which is the
 * price of one more word boundary, so a rival costing less than that was
 * available without breaking any dictionary word apart: the decode picked
 * between readings of the same stretch on the strength of a prior — the order
 * `readingsOf` happens to list them in — and nothing more. A dearer rival could
 * only be had by rejecting a word the dictionary attests.
 *
 * **Measured** against the CPP dataset's 20,139 hand-labelled polyphones: a
 * reading this reports uncertain is wrong 27.2% of the time, against 4.5% for
 * one backed by a word and 1.5% for a locked one. It lands on 18.7% of the
 * syllables of everyday text and 13.2% of encyclopedic text — see ROADMAP.md.
 */
export function isUncertain(confidence: ReadingConfidence): boolean {
  return (confidence.alternatives[0]?.cost ?? Infinity) < READING_CHARGE;
}
/**
 * Decode the run's readings, keeping what each choice rejected.
 *
 * The decode `decodeReadings` runs, kept for its losers as well as its winner.
 * ALGORITHM.md asks for per-syllable confidence on the grounds that greedy
 * matching cannot tell you when it is guessing; this is where the guessing is
 * visible, because the information is in the lattice and is thrown away the
 * moment the shortest path is read back.
 *
 * A settled stretch is still skipped, and costs nothing extra here. Every
 * position in it locked, so there was never anything to reject.
 */
export function scoreReadings(
  lattice: Lattice,
  projection: ReadingProjection,
): readonly ScoredUnit[] {
  const cuts = cutPoints(lattice);
  const units: ScoredUnit[] = [];

  for (const [index, from] of cuts.entries()) {
    const to = cuts[index + 1];
    if (to === undefined) {
      break;
    }
    if (isSettled(projection, from, to)) {
      units.push(
        ...settledUnits(projection, from, to).map((unit) => ({
          ...unit,
          isLocked: true,
          alternatives: [],
        })),
      );
      continue;
    }
    units.push(...scoreStretch(lattice, projection, from, to));
  }

  return units;
}
