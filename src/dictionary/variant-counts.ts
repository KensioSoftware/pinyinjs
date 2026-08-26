/**
 * Counting which 繁體 form a 简体 character is paired with.
 *
 * The tally the pairing table is built from, and the rule for reading a
 * winner out of it.
 */
import type { Syllable } from "../syllable/syllable.js";

/**
 * How often one 简体 character was written as a given 繁體 one.
 */
export type VariantCounts = Map<string, number>;

/**
 * The key standing for "whatever the reading", used when the reading is unknown
 * or when no reading-specific evidence exists.
 */
export const ANY_READING = "*";

/**
 * A reading key that ignores 儿化, which never bears on which variant is meant.
 *
 * Local to the variant table and named for what it keys. The `readingKey` the
 * package exports is a different function, folding a written reading into the
 * key the reverse index holds it under.
 */
export function readingKey(syllable: Syllable | undefined): string {
  if (syllable === undefined) {
    return ANY_READING;
  }
  return `${syllable.initial}|${syllable.final}|${String(syllable.tone)}`;
}

/**
 * One 简体 → 繁體 pairing observed in a source, at one reading.
 */
export interface ScriptPairing {
  readonly hans: string;
  readonly hant: string;
  readonly syllable: Syllable | undefined;
}

/**
 * Pick the most frequent variant, breaking ties by preferring the 繁體 form.
 *
 * The tie-break matters for a character that is its own traditional form in one
 * sense and has a distinct one in another. Where the counts cannot separate
 * them, the traditional form is the better guess in a traditional-form table,
 * and a wrong guess costs only whether a 繁體 text matches this key — never the
 * reading it is given.
 */
export function mostFrequent(
  counts: VariantCounts | undefined,
  hans: string,
): string | undefined {
  let best: string | undefined;
  let bestCount = 0;
  const tally = counts ?? new Map<string, number>();
  for (const [variant, count] of tally) {
    const isBetter =
      count > bestCount ||
      (count === bestCount && best === hans && variant !== hans);
    if (isBetter) {
      best = variant;
      bestCount = count;
    }
  }
  return best;
}
