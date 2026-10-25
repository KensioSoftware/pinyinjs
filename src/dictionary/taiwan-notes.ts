/**
 * The 國語 readings CC-CEDICT's `Taiwan pr.` notes and Unihan's `kMandarin`
 * pairs give a word, before 教育部's dictionaries are asked about them.
 */
import { isSingleCharacter } from "../script/characters.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { UnihanReadings } from "../sources/unihan.js";
import type { Syllable } from "../syllable/syllable.js";
import { isSenseScopedNote } from "./cedict-senses.js";
import { characterSyllable } from "./character-defaults.js";
import { readDictionaryReading } from "./reading.js";

/**
 * The reading CC-CEDICT's note or Unihan's pair gives, and whether it is only
 * one sense's.
 */
export interface NotedReading {
  readonly reading: readonly Syllable[];
  readonly isSenseScoped: boolean;
}

export function notedReadingOf(
  word: string,
  senses: readonly CedictEntry[],
  unihan: UnihanReadings | undefined,
): NotedReading | undefined {
  const taiwanSense = senses.find(
    (entry) => entry.taiwanReadings !== undefined,
  );
  if (taiwanSense?.taiwanReadings !== undefined) {
    const reading = readDictionaryReading(word, taiwanSense.taiwanReadings);
    return reading === undefined
      ? undefined
      : { reading, isSenseScoped: isSenseScopedNote(word, taiwanSense) };
  }
  const unihanTaiwan = unihan?.taiwanReading;
  if (isSingleCharacter(word) && unihanTaiwan !== undefined) {
    const syllable = characterSyllable(word, unihanTaiwan);
    return syllable === undefined
      ? undefined
      : { reading: [syllable], isSenseScoped: false };
  }
  return undefined;
}
