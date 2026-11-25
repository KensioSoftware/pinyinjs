/**
 * Reading a listed name's pinyin into the words it writes.
 */
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
