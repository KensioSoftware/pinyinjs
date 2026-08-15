/**
 * The 國語 reading an entry carries, where a source states one.
 *
 * Both sources hedge it. CC-CEDICT hangs `Taiwan pr.` on one sense of a
 * headword and the others know nothing about it, and a note can sit on the
 * right sense and still be about that sense rather than the character. What
 * survives both tests, and is not simply another 普通话 sense of the word, is
 * the delta.
 */
import { isSingleCharacter } from "../script/characters.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { UnihanReadings } from "../sources/unihan.js";
import type { Syllable } from "../syllable/syllable.js";
import { isOwnSense, isSenseScopedNote } from "./cedict-senses.js";
import { characterSyllable } from "./character-defaults.js";
import { isSameReading } from "./entry.js";
import { readDictionaryReading } from "./reading.js";

/**
 * Settle it for one word, or undefined where no source states one.
 */
export function taiwanReadingOf(
  word: string,
  senses: readonly CedictEntry[],
  senseReadings: readonly (readonly Syllable[])[],
  reading: readonly Syllable[],
  unihan: UnihanReadings | undefined,
): readonly Syllable[] | undefined {
  const taiwanSense = senses.find(
    (entry) => entry.taiwanReadings !== undefined,
  );
  const taiwanTokens = isSenseScopedNote(word, taiwanSense)
    ? undefined
    : taiwanSense?.taiwanReadings;
  const unihanTaiwan = unihan?.taiwanReading;
  let taiwan: readonly Syllable[] | undefined;
  if (taiwanTokens !== undefined) {
    taiwan = readDictionaryReading(word, taiwanTokens);
  } else if (isSingleCharacter(word) && unihanTaiwan !== undefined) {
    const syllable = characterSyllable(word, unihanTaiwan);
    taiwan = syllable === undefined ? undefined : [syllable];
  }
  if (
    taiwan !== undefined &&
    (isSameReading(taiwan, reading) || isOwnSense(taiwan, senseReadings))
  ) {
    return undefined;
  }
  return taiwan;
}
