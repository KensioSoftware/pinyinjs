import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";

/**
 * A reading this package asserts against every upstream source.
 */
export interface ReadingOverride {
  /** The word, in 简体. */
  readonly word: string;
  /** The correct reading, space-separated. */
  readonly reading: string;
  /** Why every source is wrong about it. */
  readonly reason: string;
}

/**
 * Words where every source is wrong, and the reading this package uses instead.
 *
 * This replaces the old PHP project's `$forces` array. The difference is that
 * each entry here carries a reason and is covered by a test, so the table can be
 * reviewed rather than merely inherited.
 *
 * **Keep this small.** Anything a rule can fix belongs in a rule: 一 and 不
 * sandhi is normalised out by {@link import("./reading.js")}, and 儿化 is
 * repaired from CC-CEDICT's `r5` token, so neither needs entries here. An
 * override is for the case where the sources agree with each other and are
 * still wrong, which is rare and almost always means a word whose everyday
 * sense has been displaced by an archaic one.
 */
export const READING_OVERRIDES: readonly ReadingOverride[] = [
  {
    word: "大夫",
    reading: "dài fu",
    reason:
      "Both sources give dà fū, the ancient court title. The everyday sense, doctor, is dàifu and is overwhelmingly the more common.",
  },
];

/**
 * Read an override's reading into syllables, throwing if it is malformed.
 *
 * Throwing rather than skipping is deliberate: an override exists because
 * every source is wrong, so one that silently fails to parse would restore the
 * wrong reading and leave nothing to notice it by. This runs at import, so a
 * typo here fails the build rather than the dictionary.
 */
export function readOverrideReading(
  override: ReadingOverride,
): readonly Syllable[] {
  const syllables = override.reading
    .split(/\s+/u)
    .filter((token) => token !== "")
    .map((token) => readSyllable(token));
  if (syllables.length === 0) {
    throw new Error(`override for ${override.word} has no reading`);
  }

  const read: Syllable[] = [];
  for (const syllable of syllables) {
    if (syllable === undefined) {
      throw new Error(
        `override for ${override.word} is not a reading: ${override.reading}`,
      );
    }
    // An unwritten tone in an override means the neutral tone, as it does in a
    // source dictionary: dàifu is dài + fu5, not dài + an unknown tone.
    read.push({ ...syllable, tone: syllable.tone ?? NEUTRAL_TONE });
  }
  return read;
}

/**
 * The override table, keyed by word and parsed into syllables.
 */
export const OVERRIDE_READINGS: ReadonlyMap<string, readonly Syllable[]> =
  new Map(
    READING_OVERRIDES.map((override) => [
      override.word,
      readOverrideReading(override),
    ]),
  );
