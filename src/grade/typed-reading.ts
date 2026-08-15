/**
 * The reading someone typed, as the checker compares it.
 *
 * The other side from `check-readings.ts`, and much the smaller one: there is
 * no dictionary behind a typed string, only the tokeniser and what each token
 * turns out to spell.
 */
import { tokenisePinyin } from "../accuracy/tokenise.js";
import {
  readSyllable,
  type Syllable,
  writeSyllableSpelling,
} from "../syllable/syllable.js";
import type { Tone } from "../tone/tone.js";

/**
 * One syllable of what was typed.
 */
export interface TypedSyllable {
  readonly text: string;
  readonly syllable: Syllable | undefined;
  /** The toneless spelling this is aligned and compared by. */
  readonly base: string;
  /** The tone written on it, or undefined where none was. */
  readonly tone: Tone | undefined;
  /** Whether a written word begins here. */
  readonly startsWord: boolean;
}

/**
 * Read what was typed, one syllable at a time.
 *
 * {@link tokenisePinyin} is what the decoder is scored with, and it is tolerant
 * in the two ways that matter here: word spacing is discarded, and the
 * apostrophes and hyphens inside a word are read as the syllable boundaries
 * they are and dropped. Both are orthography rather than pronunciation.
 *
 * A stretch that is not pinyin at all comes back whole, and is reported as
 * written rather than thrown away.
 */
export function typedReading(typed: string): readonly TypedSyllable[] {
  const { syllables, wordStarts } = tokenisePinyin(typed);
  return syllables.map((text, at) => {
    const syllable = readSyllable(text);
    return {
      text,
      syllable,
      base:
        syllable === undefined
          ? text.toLowerCase().normalize("NFC")
          : writeSyllableSpelling(syllable),
      tone: syllable?.tone,
      startsWord: wordStarts.has(at),
    };
  });
}
