/**
 * The reading this library produces for a text, as the checker compares it.
 *
 * One of the two sides `check.ts` pairs up; `typed-reading.ts` is the other.
 * They are separate because they are reduced from different things — this from
 * a conversion, that from a string somebody typed — and meet only in being the
 * same shape, a syllable at a time with what was on offer beside it.
 */
import type { ConvertOptions } from "../decode/convert.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import type { Syllable } from "../syllable/syllable.js";
import type { Tone } from "../tone/tone.js";
import {
  acceptedReadings,
  readingsThreeWays,
  rejectedReadings,
} from "./reading-tolerance.js";

/**
 * An expected syllable, with everything a typed one is allowed to be.
 */
export interface ExpectedSyllable {
  readonly syllable: Syllable;
  /**
   * Which tones each acceptable spelling may carry.
   *
   * Keyed by the toneless spelling, because the two questions a verdict asks
   * are separate: an unknown spelling is the wrong syllable, and a known
   * spelling with an unlisted tone is the right syllable in the wrong tone.
   */
  readonly accepted: ReadonlyMap<string, ReadonlySet<Tone | undefined>>;
  /** Whether a word may begin here. */
  readonly acceptsBreak: boolean;
  /** Whether this may be written on to the syllable before it. */
  readonly acceptsJoin: boolean;
  readonly source: string | undefined;
  readonly at: number;
}

/**
 * Read the text, and work out what a typed syllable is allowed to be.
 *
 * The three conversions each answer a different question; see
 * {@link readingsThreeWays}. What is left here is putting one syllable's worth
 * of all three together.
 */
export function expectedReading(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions,
): readonly ExpectedSyllable[] {
  const { written, said, spaced } = readingsThreeWays(
    dictionary,
    text,
    options,
  );

  return written.map(({ piece, at, junction }, index) => {
    // Sliced rather than indexed, so that a conversion somehow reporting fewer
    // syllables than the others contributes nothing rather than needing a
    // fallback: the caller's own conversion decides alone.
    const alternate = said
      .slice(index, index + 1)
      .map((one) => one.piece.syllable);
    const other = spaced.slice(index, index + 1).map((one) => one.junction);
    return {
      syllable: piece.syllable,
      accepted: acceptedReadings([
        piece.syllable,
        ...alternate,
        ...rejectedReadings(piece),
      ]),
      // A hyphen is neither a break nor a join, and so allows both: it is a
      // boundary the standard writes inside a word, and a learner rendering it
      // as a space has not invented one.
      acceptsBreak: junction !== "join" || other.some((one) => one !== "join"),
      acceptsJoin: junction !== "break" || other.some((one) => one !== "break"),
      source: piece.source,
      at,
    };
  });
}
