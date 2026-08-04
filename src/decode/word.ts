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
  /**
   * What is written in front of this word, where it is not a space.
   *
   * Only 分词连写 sets it, and only to a hyphen: the two halves of 干干净净
   * are written `gāngān-jìngjìng`, one orthographic word with a boundary
   * inside it rather than two words. Keeping them two decoded words and
   * recording the mark between them is what lets the halves carry their own
   * readings and capitals — see {@link WordSeparator}.
   */
  readonly separator?: WordSeparator;
}

/**
 * A mark GB/T 16159 writes between two words instead of a space.
 *
 * A hyphen is the only one, and it does not mean the same thing as a space: a
 * hyphenated pair is read back as a single word, which is why
 * `splitSyllables` treats it as a syllable boundary rather than a word one.
 */
export type WordSeparator = "-";

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
