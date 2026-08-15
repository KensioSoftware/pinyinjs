/**
 * The 繁體 pairing table.
 *
 * Built from CC-CEDICT's own pairings and asked, character by character,
 * which 繁體 form a 简体 one takes for a given reading.
 */
import { toCharacters } from "../script/characters.js";
import type { UnihanReadings, UnihanVariants } from "../sources/unihan.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import type { ReadCharacters } from "./reading.js";
import {
  ANY_READING,
  mostFrequent,
  readingKey,
  type ScriptPairing,
  type VariantCounts,
} from "./variant-counts.js";

/**
 * Derives the 繁體 form of a 简体 word, using the reading to disambiguate.
 *
 * 简体 → 繁體 is the ambiguous direction, which is what normally makes automatic
 * conversion unreliable: 发 is either 發 (fā, to send) or 髮 (fà, hair). But the
 * dictionary already knows the reading, and the reading settles it — 头发 is
 * `tóu fà`, so its 发 is 髮 and the word is 頭髮.
 *
 * Two sources of evidence, in order:
 *
 * 1. **CC-CEDICT's own pairings.** It carries 124,754 entries with both scripts
 *    written out, which is a large observed sample of how each character is
 *    converted at each reading. This is preferred because it is evidence rather
 *    than inference, and because it settles cases the reading cannot: 干扰 is
 *    `gān rǎo` and stays 干擾, while 干燥 is also `gān` and becomes 乾燥.
 * 2. **Unihan's `kTraditionalVariant`,** ranked by where the word's reading
 *    appears in each candidate's reading list. 髮 reads only `fà`, whereas 發
 *    reads `fā` first and `fà` only as a minor variant, so `fà` picks 髮.
 *
 * Characters no source knows a variant for are left alone, which is the right
 * answer for the overwhelming majority: simplification changed a minority of
 * characters.
 */
export class TraditionalTable {
  /**
   * Build the table from observed script pairings and Unihan's variant lists.
   *
   * Pairings should include the cases where the character is *unchanged*, since
   * that is what stops a character with a rare traditional variant from always
   * being converted to it.
   */
  static build(
    pairings: Iterable<ScriptPairing>,
    variants: UnihanVariants,
    unihanReadings: ReadonlyMap<string, UnihanReadings>,
  ): TraditionalTable {
    const observed = new Map<string, Map<string, VariantCounts>>();
    for (const { hans, hant, syllable } of pairings) {
      const byReading = observed.get(hans) ?? new Map<string, VariantCounts>();
      const keys = new Set([ANY_READING, readingKey(syllable)]);
      for (const key of keys) {
        const counts = byReading.get(key) ?? new Map<string, number>();
        counts.set(hant, (counts.get(hant) ?? 0) + 1);
        byReading.set(key, counts);
      }
      observed.set(hans, byReading);
    }
    return new TraditionalTable(observed, variants, unihanReadings);
  }

  readonly #observed: ReadonlyMap<string, ReadonlyMap<string, VariantCounts>>;
  readonly #variants: UnihanVariants;
  readonly #unihanReadings: ReadonlyMap<string, UnihanReadings>;
  readonly #parsed = new Map<string, Syllable | undefined>();

  /**
   * Wrap prepared tables. Use {@link TraditionalTable.build}.
   */
  private constructor(
    observed: ReadonlyMap<string, ReadonlyMap<string, VariantCounts>>,
    variants: UnihanVariants,
    unihanReadings: ReadonlyMap<string, UnihanReadings>,
  ) {
    this.#observed = observed;
    this.#variants = variants;
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
   * The 繁體 form of one character, given the syllable it is read as.
   */
  convertCharacter(hans: string, syllable: Syllable | undefined): string {
    const byReading = this.#observed.get(hans);
    // Evidence at this exact reading first, then evidence at any reading.
    const observed =
      mostFrequent(byReading?.get(readingKey(syllable)), hans) ??
      mostFrequent(byReading?.get(ANY_READING), hans);
    if (observed !== undefined) {
      return observed;
    }

    const candidates = this.#variants.traditional.get(hans) ?? [];
    if (candidates.length === 0) {
      return hans;
    }

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

  /**
   * The 繁體 form of a whole word, read as the given syllables.
   */
  convert(aligned: readonly ReadCharacters[]): string {
    let converted = "";
    for (const read of aligned) {
      const group = toCharacters(read.characters);
      for (const character of group) {
        // A syllable covering two characters — 儿化 — is not evidence about the
        // second of them, so only the first is disambiguated by it.
        const syllable =
          group.length === 1 || character === group[0]
            ? read.syllable
            : undefined;
        converted += this.convertCharacter(character, syllable);
      }
    }
    return converted;
  }
}
