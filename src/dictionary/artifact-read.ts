/**
 * Reading the dictionary artifact back.
 *
 * The mirror of buildArtifact, and held to it by the round-trip check at the
 * end of the build.
 */
import { claimKeys } from "./artifact.js";
import { toCharacters } from "../script/characters.js";
import type { DictionaryEntry } from "./entry.js";
import { isSameReading } from "./entry.js";
import { FrequencyTable } from "./frequency-table.js";
import { KeyIndex } from "./key-index.js";
import {
  ALTERNATE,
  COLUMN,
  decodeReading,
  type DictionaryArtifact,
  encodeReading,
  LINE,
  nameBoundariesIn,
  PROPER_NOUN_FLAG,
} from "./artifact-format.js";

export {
  decodeReading,
  type DictionaryArtifact,
  encodeReading,
  traditionalForms,
} from "./artifact-format.js";

/**
 * Read an artifact back into entries, for tests and for the loader.
 *
 * The reverse of {@link buildArtifact} but for the two things it does not
 * store: frequency comes back as a bucket rather than a count, since it is
 * quantised on the way out, and 简体/繁體 pairing is absent, so every entry
 * reports its key as both. Entries are returned in key order.
 */
export function readArtifact(
  artifact: DictionaryArtifact,
): readonly DictionaryEntry[] {
  const index = KeyIndex.from(artifact.keys);
  const lines = artifact.entries === "" ? [] : artifact.entries.split(LINE);
  const frequencies = FrequencyTable.from(artifact.frequencies, index.size);

  // Two passes: a derivable reading needs its characters' readings, which are
  // themselves entries in the same artifact.
  const defaults = new Map<string, string>();
  for (let at = 0; at < index.size; at++) {
    const key = index.keyAt(at);
    const reading = (lines[at] ?? "").split(COLUMN)[0] ?? "";
    if (toCharacters(key).length === 1 && reading !== "") {
      defaults.set(key, reading);
    }
  }

  const entries: DictionaryEntry[] = [];
  for (let at = 0; at < index.size; at++) {
    const key = index.keyAt(at);
    const [
      reading = "",
      taiwan = "",
      partOfSpeech = "",
      flags = "",
      alternates = "",
    ] = (lines[at] ?? "").split(COLUMN);
    const nameBoundaries = nameBoundariesIn(flags);

    const stored =
      reading === ""
        ? toCharacters(key)
            .map((character) => defaults.get(character) ?? "")
            .join(" ")
        : reading;
    const cn = decodeReading(stored);
    if (cn === undefined) {
      throw new Error(`artifact entry for ${key} has no readable reading`);
    }
    const tw = decodeReading(taiwan);

    // The artifact stores keys, not pairs, so a key read back is both scripts
    // as far as it knows. See buildArtifact for what that leaves out and why.
    entries.push({
      hans: key,
      hant: key,
      readings: { cn, ...(tw !== undefined && { tw }) },
      frequency: frequencies.bucketOf(at),
      partOfSpeech,
      isProperNoun: flags.includes(PROPER_NOUN_FLAG),
      ...(nameBoundaries.length > 0 && { nameBoundaries }),
      ...(alternates !== "" && {
        alternates: alternates
          .split(ALTERNATE)
          .map((text) => decodeReading(text))
          .filter((decoded) => decoded !== undefined),
      }),
    });
  }
  return entries;
}

/**
 * The reading every key in an artifact resolves to, in tone-numbered notation.
 *
 * Resolved rather than read off the line, since 87.8% of multi-character lines
 * store no reading at all and mean "the characters' defaults, in order" — and
 * those defaults are whatever *this* artifact holds. That is exactly what makes
 * the comparison between tiers worth doing: a tier missing a character does not
 * only lose that character, it changes every derived reading that stands on it.
 */
export function readingsByKey(
  artifact: DictionaryArtifact,
): ReadonlyMap<string, string> {
  const index = KeyIndex.from(artifact.keys);
  const readings = new Map<string, string>();
  for (const [at, entry] of readArtifact(artifact).entries()) {
    readings.set(index.keyAt(at), encodeReading(entry.readings.cn));
  }
  return readings;
}

/**
 * The first key an artifact does not read back the same, or undefined.
 *
 * Only the fields the artifact stores are compared: frequency is quantised on
 * the way out, and the 简体/繁體 labelling of a pair is not recoverable from a
 * key alone, so neither is checked here.
 *
 * Returns the offending key rather than a bare false so that a build failure
 * names the word to go and look at.
 */
export function findRoundTripFailure(
  entries: readonly DictionaryEntry[],
  artifact: DictionaryArtifact,
): string | undefined {
  const index = KeyIndex.from(artifact.keys);
  const read = readArtifact(artifact);
  const byKey = new Map<string, DictionaryEntry>();
  for (const [at, entry] of read.entries()) {
    byKey.set(index.keyAt(at), entry);
  }

  for (const [key, entry] of claimKeys(entries)) {
    const other = byKey.get(key);
    if (
      other === undefined ||
      !isSameReading(entry.readings.cn, other.readings.cn)
    ) {
      return key;
    }
  }
  return undefined;
}
