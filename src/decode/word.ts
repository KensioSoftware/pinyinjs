import type { Syllable } from "../syllable/syllable.js";

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
