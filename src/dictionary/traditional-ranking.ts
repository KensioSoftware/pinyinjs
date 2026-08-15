/**
 * Choosing between the 繁體 variants Unihan lists, by how a character is read.
 *
 * The second of the two sources of evidence `TraditionalTable` weighs, and the
 * only one that is inference rather than observation. Kept apart because it is
 * a different question from the pairings above it: not "how has this character
 * been converted before" but "which of these candidates is read this way".
 */
import type { UnihanReadings } from "../sources/unihan.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";

/**
 * Unihan's reading lists, ranked against a syllable.
 */
export class VariantRanking {
  readonly #unihanReadings: ReadonlyMap<string, UnihanReadings>;
  readonly #parsed = new Map<string, Syllable | undefined>();

  constructor(unihanReadings: ReadonlyMap<string, UnihanReadings>) {
    this.#unihanReadings = unihanReadings;
  }

  /**
   * Parse a Unihan reading string, remembering the result.
   *
   * Worth caching: the fallback path reads the same few thousand strings once
   * per candidate per word.
   */
  #syllableOf(reading: string): Syllable | undefined {
    if (this.#parsed.has(reading)) {
      return this.#parsed.get(reading);
    }
    const syllable = readSyllable(reading);
    this.#parsed.set(reading, syllable);
    return syllable;
  }

  /**
   * How well a candidate character's readings match the one we want.
   *
   * Lower is better. A candidate whose most likely reading is the one we want
   * beats one that merely lists it among its rarer readings, which is exactly
   * what separates 髮 (`fà` alone) from 發 (`fā` first, `fà` third).
   */
  #rank(candidate: string, syllable: Syllable | undefined): number {
    const readings = this.#unihanReadings.get(candidate)?.readings ?? [];
    if (syllable === undefined) {
      return readings.length === 0 ? Infinity : 0;
    }
    let tonelessMatch = Infinity;
    for (const [at, reading] of readings.entries()) {
      const parsed = this.#syllableOf(reading);
      if (parsed === undefined) {
        continue;
      }
      if (
        parsed.initial !== syllable.initial ||
        parsed.final !== syllable.final
      ) {
        continue;
      }
      if (parsed.tone === syllable.tone) {
        return at;
      }
      // A match on the syllable but not the tone still beats no match at all,
      // since sources disagree about tone far more often than about spelling.
      tonelessMatch = Math.min(tonelessMatch, readings.length + at);
    }
    return tonelessMatch;
  }

  /**
   * The best-ranked candidate, or the character itself where there are none.
   */
  best(
    candidates: readonly string[],
    hans: string,
    syllable: Syllable | undefined,
  ): string {
    let best = hans;
    let bestRank = Infinity;
    for (const candidate of candidates) {
      const rank = this.#rank(candidate, syllable);
      // Ties prefer a form other than the character itself, for the same reason
      // mostFrequent does.
      if (rank < bestRank || (rank === bestRank && best === hans)) {
        best = candidate;
        bestRank = rank;
      }
    }
    return best;
  }
}
