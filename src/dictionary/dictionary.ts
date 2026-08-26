import { toCanonicalGlyphs } from "../script/glyphs.js";
import type { Syllable } from "../syllable/syllable.js";
import type { DictionaryArtifact } from "./artifact.js";
import { decodeEntry, type WordEntry } from "./dictionary-entry.js";
import {
  alternateReadings,
  type DictionaryReadings,
  readingsCursor,
  storedReadingOf,
} from "./dictionary-readings.js";
import { EntryLines } from "./entry-lines.js";
import { FrequencyTable } from "./frequency-table.js";
import { KeyIndex } from "./key-index.js";

export type { WordEntry } from "./dictionary-entry.js";
export type { DictionaryReadings } from "./dictionary-readings.js";

/**
 * A compiled dictionary, queried without being parsed.
 *
 * The blobs stay exactly as they were fetched. Only two things are computed on
 * load — the key offsets and the line offsets — and both are scans for a
 * separator rather than a parse. Individual entries are decoded lazily, the
 * first time a word is asked about, because a decode of all 722,934 would cost
 * far more than the lookups a page ever performs.
 *
 * A word is found under either script: 繁體 forms are keys in their own right,
 * so no 简体 ↔ 繁體 conversion happens on the lookup path. See
 * SCRIPTS-AND-LOCALES.md for why that shortcut would destroy accuracy.
 *
 * Regional 繁體 glyph forms *are* normalised here, and that is a different
 * thing: 裏 and 裡 are the same character in two standards with one reading, so
 * folding them together loses nothing and is what lets Hong Kong text find keys
 * at all. Only the reading is taken from the normalised form — callers keep the
 * characters the text was written with.
 */
export class Dictionary {
  /**
   * Wrap an artifact's three blobs.
   */
  static from(artifact: DictionaryArtifact): Dictionary {
    return new Dictionary(artifact);
  }

  readonly #index: KeyIndex;
  readonly #lines: EntryLines;
  readonly #frequencies: FrequencyTable;
  readonly #decoded = new Map<number, WordEntry>();

  /**
   * Wrap an artifact's blobs. Use {@link Dictionary.from}.
   */
  private constructor(artifact: DictionaryArtifact) {
    this.#index = KeyIndex.from(artifact.keys);
    this.#lines = EntryLines.from(artifact.entries);
    this.#frequencies = FrequencyTable.from(
      artifact.frequencies,
      this.#index.size,
    );
  }

  /**
   * How many words the dictionary holds, counting each script's key.
   */
  get size(): number {
    return this.#index.size;
  }

  /**
   * The word at a position, or the empty string where there is none.
   *
   * Positions are what a second index over the dictionary stores, since a
   * position is one number where a word is a string — the reverse index in
   * `src/search/` is built on that. The same position indexes
   * {@link Dictionary.frequencyAt} and {@link DictionaryReadings.readingAt}.
   */
  wordAt(at: number): string {
    return this.#index.keyAt(at);
  }

  /**
   * The frequency bucket of the word at a position, 0 rarest to 15 commonest.
   *
   * The bucket rather than {@link WordEntry.cost}, because ranking a candidate
   * list wants the sixteen-value scale a counting sort runs on — and because
   * reading it costs no decode, where asking for the entry would decode every
   * candidate to learn one number. See {@link FrequencyTable.bucketOf}.
   */
  frequencyAt(at: number): number {
    return this.#frequencies.bucketOf(at);
  }

  /**
   * The frequency bucket of a word under either script, or undefined.
   *
   * What {@link Dictionary.frequencyAt} answers by position, answered by the
   * word itself and off the same search {@link Dictionary.lookup} runs. Ranking
   * a word list against itself is what asks for it, and reading a bucket
   * decodes no entry.
   *
   * Regional 繁體 glyph forms are normalised the way `lookup` normalises them,
   * so 裏面 and 裡面 report alike. A word the dictionary lacks reports
   * undefined. Bucket 0 says something else. The word is a key the corpus
   * never counted, which two thirds of the full tier's keys are.
   */
  frequencyOf(word: string): number | undefined {
    const found = this.#index.lookup(toCanonicalGlyphs(word));
    return found.isKey ? this.#frequencies.bucketOf(found.index) : undefined;
  }

  /**
   * A cursor over every key's reading, in key order.
   */
  readingsInOrder(): DictionaryReadings {
    return readingsCursor(this.#index, this.#lines);
  }

  /**
   * Whether any word begins with this text. An exact match counts.
   *
   * This is the question the lattice asks at every position, and answering it
   * is what lets a scan stop as soon as no word can extend.
   */
  hasPrefix(text: string): boolean {
    return this.#index.hasPrefix(toCanonicalGlyphs(text));
  }

  /**
   * The entry for a word under either script, or undefined.
   *
   * A 繁體 word written in Hong Kong's glyph forms is normalised to the
   * Taiwan-standard forms the keys are built from, so 裏面 and 看着 find the
   * entries for 裡面 and 看著 rather than falling back to their characters. The
   * entry names the canonical spelling; the caller keeps the original text.
   */
  lookup(word: string): WordEntry | undefined {
    const canonical = toCanonicalGlyphs(word);
    const found = this.#index.lookup(canonical);
    if (!found.isKey) {
      return undefined;
    }
    const held = this.#decoded.get(found.index);
    if (held !== undefined) {
      return held;
    }
    const entry = decodeEntry(
      canonical,
      this.#lines.columnsAt(found.index),
      (character) => storedReadingOf(this.#index, this.#lines, character),
      this.#frequencies.costOf(found.index),
    );
    this.#decoded.set(found.index, entry);
    return entry;
  }

  /**
   * Every reading a single character is known to take, most likely first.
   *
   * The alternates are read off the canonical form's line, the same form
   * {@link Dictionary.lookup} found the entry under. Searching the index for
   * the raw character instead would land on the insertion point for a Hong Kong
   * glyph form that is not itself a key — 裏 sits between whatever keys
   * surround it — and take some unrelated entry's alternates.
   */
  readingsOf(character: string): readonly (readonly Syllable[])[] {
    const entry = this.lookup(character);
    if (entry === undefined) {
      return [];
    }
    const found = this.#index.lookup(toCanonicalGlyphs(character));
    return [entry.reading, ...alternateReadings(this.#lines, found.index)];
  }
}
