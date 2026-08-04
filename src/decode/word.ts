import type { Syllable } from "../syllable/syllable.js";
import type { ReadingConfidence } from "./confidence.js";

/**
 * One decoded word: the characters it covers and how they are read.
 */
export interface DecodedWord {
  /** The characters this word is written with. */
  readonly text: string;
  readonly reading: readonly Syllable[];
  /** Whether the dictionary marks it a proper noun. */
  readonly isProperNoun: boolean;
  /** jieba's tag, or the empty string when unknown. */
  readonly partOfSpeech: string;
  /** Whether a dictionary entry was found, rather than a character fallback. */
  readonly isKnown: boolean;
}

/**
 * A decoded word together with how settled each of its syllables was.
 */
export interface ScoredWord {
  readonly word: DecodedWord;
  /**
   * One entry per syllable of the word's reading, in the same order.
   *
   * Per syllable rather than per character, because a reading need not have one
   * syllable per character: 玩儿 is two characters and one syllable, and the
   * choice the decode made there was about both of them at once.
   */
  readonly confidence: readonly ReadingConfidence[];
}
