/**
 * Reading a listed name's pinyin into the words it writes.
 */
import type { DecodedWord } from "../decode/word.js";
import { toCharacters } from "../script/characters.js";
import { readWord } from "../syllable/split.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";

/**
 * One written word of a listed text.
 */
export interface ListedWord {
  readonly text: string;
  readonly reading: readonly Syllable[];
  readonly isProperNoun: boolean;
}

/**
 * Cut a listed text into the words its pinyin writes.
 *
 * Throws where the pinyin does not read one syllable per character, which a
 * test over the whole table catches before anything ships.
 */
export function listedWords(
  text: string,
  pinyin: string,
): readonly ListedWord[] {
  const characters = toCharacters(text);
  let at = 0;
  const words = pinyin.split(" ").map((written) => {
    const reading = (readWord(written) ?? []).map((syllable) => ({
      ...syllable,
      tone: syllable.tone ?? NEUTRAL_TONE,
    }));
    const word = {
      text: characters.slice(at, at + reading.length).join(""),
      reading,
      isProperNoun: written !== written.toLowerCase(),
    };
    at += reading.length;
    return word;
  });
  if (at !== characters.length || words.some((word) => word.text === "")) {
    throw new Error(`${pinyin} does not spell ${text}`);
  }
  return words;
}

/**
 * Whether a position counted from a start was hinted, given the run's hinted
 * positions.
 */
export function hintedFrom(
  hinted: ReadonlySet<number>,
  start: number,
): (position: number) => boolean {
  return (position) => hinted.has(start + position);
}

/**
 * A listed text's words, keeping the decode's syllable wherever a caller
 * asserted one.
 *
 * 藏王 hinted `cáng` keeps `cáng` and still takes the table's capital and
 * spacing. Where the decode did not read one syllable per character, the
 * syllables cannot be matched to positions, and a hinted text is left alone.
 */
export function keepingHinted(
  listed: readonly ListedWord[],
  covered: readonly DecodedWord[],
  isHinted: (position: number) => boolean,
): readonly ListedWord[] | undefined {
  const decoded = covered.flatMap((word) => [...word.reading]);
  const length = listed.reduce((sum, word) => sum + word.reading.length, 0);
  const hasHint = Array.from({ length }, (_unused, at) => isHinted(at)).some(
    Boolean,
  );
  if (!hasHint) {
    return listed;
  }
  if (decoded.length !== length) {
    return undefined;
  }
  let at = 0;
  return listed.map((word) => ({
    ...word,
    reading: word.reading.map((syllable) => {
      const kept = isHinted(at) ? (decoded[at] ?? syllable) : syllable;
      at += 1;
      return kept;
    }),
  }));
}
