/**
 * What every frame of {@link import("./verbal-rule.js").VERBAL_READING} is made
 * of, and the questions about neighbouring words the frames share.
 */
import { toCharacters } from "../script/characters.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  tagOf,
  wordsEndingAt,
  wordsStartingAt,
} from "./rules.js";

/**
 * One character whose verb has a reading of its own, and when the verb is the
 * one meant.
 *
 * `characters` holds the character in each script where both scripts read it
 * the same way. `isVerbalAt` is asked about a position holding one of them,
 * and answers from the words around it.
 *
 * `boundBefore` and `boundAfter` are the characters that make a compound with
 * it, on that side, reading it the other way: the 联 of 联系 and the 果 of
 * 结果. The full tier holds those compounds and decides them through the word.
 * The core tier holds few of them, and a frame asking what stands beside the
 * character would otherwise take 我们联系上他们 for tying something.
 */
export interface VerbalFrame {
  readonly characters: ReadonlySet<string>;
  readonly reading: Syllable;
  readonly boundBefore: ReadonlySet<string>;
  readonly boundAfter: ReadonlySet<string>;
  readonly isVerbalAt: (context: EdgeContext, at: number) => boolean;
}

/**
 * Whether the character at a position is bound into a compound by its
 * neighbour on either side.
 */
export function isBoundAt(
  context: EdgeContext,
  at: number,
  frame: VerbalFrame,
): boolean {
  return (
    frame.boundBefore.has(context.characters[at - 1] ?? "") ||
    frame.boundAfter.has(context.characters[at + 1] ?? "")
  );
}

/**
 * A set of the characters of a string, for a frame's bound characters.
 */
export function charactersOf(text: string): ReadonlySet<string> {
  return new Set(toCharacters(text));
}

/**
 * A syllable written out in tone marks, for a frame's reading.
 */
export function syllableOf(text: string): Syllable {
  const syllable = readSyllable(text);
  /* c8 ignore next 3 -- every frame names a syllable */
  if (syllable === undefined) {
    throw new Error(`${text} is not a syllable`);
  }
  return syllable;
}

/**
 * Whether a tagged word of more than one character starts at a position.
 *
 * The test a frame puts to the character after the verb. 系在 is tying, and
 * 系在于 would be no such thing, since 在于 is a word. Untagged keys are left
 * out, since the full tier holds pairs such as 进地 with no part of speech.
 */
export function opensTaggedWord(context: EdgeContext, at: number): boolean {
  return wordsStartingAt(context, at).some(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * Whether a tagged word of more than one character ends at a position.
 */
export function closesTaggedWord(context: EdgeContext, at: number): boolean {
  return wordsEndingAt(context, at).some(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * Whether the character at a position is one of a set and starts no tagged
 * word of its own.
 */
export function isBareAt(
  context: EdgeContext,
  at: number,
  characters: ReadonlySet<string>,
): boolean {
  return (
    characters.has(context.characters[at] ?? "") &&
    !opensTaggedWord(context, at)
  );
}

/**
 * Whether the text starting at a position is one of a set of words.
 *
 * Asked of the characters rather than of the dictionary, because what follows
 * a verb is often a word the decode would join to something else: 一下 is a
 * word, and 一下子 is a longer one starting at the same place.
 */
export function startsWithAny(
  context: EdgeContext,
  at: number,
  words: readonly string[],
): boolean {
  const rest = context.characters.slice(at, at + 4).join("");
  return words.some((word) => rest.startsWith(word));
}

/**
 * Whether a position is the end of the run.
 *
 * A run stops at punctuation, so the end of the run is the end of the clause.
 */
export function isRunEnd(context: EdgeContext, at: number): boolean {
  return at >= context.characters.length;
}
