import type { DecodedWord } from "../decode/word.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";

/**
 * One 分词连写 rule, rewriting the words a decode produced.
 *
 * Typed and individually testable, which is the point ALGORITHM.md makes about
 * rules: the old project patched the output string with regexes, so its rules
 * were order-dependent and could not be tested apart from each other.
 */
export interface GroupingRule {
  readonly name: string;
  readonly apply: (
    words: readonly DecodedWord[],
    dictionary: Dictionary,
  ) => readonly DecodedWord[];
}

/**
 * Join two decoded words into one.
 *
 * The first word's flags carry, because it is the head: 看了 is the verb 看
 * with an aspect particle stuck to it, not a new word of its own.
 */
export function join(head: DecodedWord, tail: DecodedWord): DecodedWord {
  return {
    text: head.text + tail.text,
    reading: [...head.reading, ...tail.reading],
    isProperNoun: head.isProperNoun,
    partOfSpeech: head.partOfSpeech,
    isKnown: head.isKnown && tail.isKnown,
    ...(head.separator !== undefined && { separator: head.separator }),
  };
}

/**
 * Write a word as two halves with a hyphen between them.
 *
 * The 重叠 and 成语 hyphens are the same operation on different evidence: cut
 * the word, mark the second half, and leave the reading exactly as it was. The
 * word is returned untouched where its reading cannot be cut — 儿化 has no
 * halves.
 */
export function hyphenate(
  word: DecodedWord,
  at: number,
): readonly DecodedWord[] {
  const split = splitAt(word, at);
  if (split === undefined) {
    return [word];
  }
  const [head, tail] = split;
  return [head, { ...tail, separator: "-" }];
}

/**
 * Divide a decoded word at every one of a list of character offsets.
 *
 * {@link splitAt} generalised, for the proper names whose parts CC-CEDICT marks
 * more than two of: 上海交通大学 divides at 2 and 4, and cutting only at the
 * first would leave `Shànghǎi Jiāotōngdàxué`.
 *
 * The word comes back whole where its reading cannot be cut — the same 儿化
 * condition {@link splitAt} has — or where an offset is out of order or outside
 * the word, since a boundary that does not describe this word cannot be applied
 * to it.
 */
export function divideAt(
  word: DecodedWord,
  offsets: readonly number[],
): readonly DecodedWord[] {
  const characters = toCharacters(word.text);
  if (word.reading.length !== characters.length) {
    return [word];
  }
  const cuts = [0, ...offsets, characters.length];
  const isOrdered = cuts.every(
    (at, index) => index === 0 || at > (cuts[index - 1] ?? 0),
  );
  if (!isOrdered || (offsets.at(-1) ?? 0) >= characters.length) {
    return [word];
  }
  return cuts.slice(0, -1).map((from, index) => {
    const to = cuts[index + 1] ?? characters.length;
    const part: DecodedWord = {
      text: characters.slice(from, to).join(""),
      reading: word.reading.slice(from, to),
      isProperNoun: word.isProperNoun,
      partOfSpeech: word.partOfSpeech,
      isKnown: word.isKnown,
    };
    // Only the head keeps what was written in front of the word: every later
    // part is written against the part before it rather than against that.
    return index === 0 && word.separator !== undefined
      ? { ...part, separator: word.separator }
      : part;
  });
}

/**
 * Split a decoded word into two at a character offset.
 *
 * Only possible where the reading has one syllable per character, which 儿化
 * does not: there is no way to cut `wánr` in half.
 */
export function splitAt(
  word: DecodedWord,
  at: number,
): readonly [DecodedWord, DecodedWord] | undefined {
  const characters = toCharacters(word.text);
  if (word.reading.length !== characters.length) {
    return undefined;
  }
  const part = (from: number, to: number): DecodedWord => ({
    text: characters.slice(from, to).join(""),
    reading: word.reading.slice(from, to),
    isProperNoun: word.isProperNoun,
    partOfSpeech: word.partOfSpeech,
    isKnown: word.isKnown,
  });
  const head = part(0, at);
  return [
    // Only the head keeps whatever was written in front of the word, since the
    // tail is now written against the head rather than against what came
    // before it.
    word.separator === undefined
      ? head
      : { ...head, separator: word.separator },
    part(at, characters.length),
  ];
}
