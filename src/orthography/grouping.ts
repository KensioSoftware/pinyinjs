import type { Dictionary } from "../dictionary/dictionary.js";
import type { DecodedWord } from "../decode/word.js";
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
 * jieba's tags for the aspect particles 了, 着 and 过.
 */
const ASPECT_TAGS = new Set(["ul", "uz", "ug"]);

/**
 * jieba's tag for a suffix, which is what 们 and 者 are.
 */
const SUFFIX_TAG = "k";

/**
 * The generic half of an administrative place name.
 *
 * Both scripts, since a 繁體 name is a key in its own right and never converted
 * before lookup.
 */
const ADMINISTRATIVE_GENERICS = new Set([
  "市",
  "省",
  "县",
  "縣",
  "区",
  "區",
  "镇",
  "鎮",
  "乡",
  "鄉",
  "村",
  "州",
]);

/**
 * Join two decoded words into one.
 *
 * The first word's flags carry, because it is the head: 看了 is the verb 看
 * with an aspect particle stuck to it, not a new word of its own.
 */
function join(head: DecodedWord, tail: DecodedWord): DecodedWord {
  return {
    text: head.text + tail.text,
    reading: [...head.reading, ...tail.reading],
    isProperNoun: head.isProperNoun,
    partOfSpeech: head.partOfSpeech,
    isKnown: head.isKnown && tail.isKnown,
  };
}

/**
 * Fold every word a predicate accepts into the word before it.
 */
function joinBackwards(
  words: readonly DecodedWord[],
  isAttached: (word: DecodedWord) => boolean,
): readonly DecodedWord[] {
  const grouped: DecodedWord[] = [];
  for (const word of words) {
    const head = grouped.at(-1);
    if (head !== undefined && isAttached(word)) {
      grouped[grouped.length - 1] = join(head, word);
      continue;
    }
    grouped.push(word);
  }
  return grouped;
}

/**
 * 了, 着 and 过 attach to the verb in front of them.
 *
 * GB/T 16159: 他看了 is `tā kànle`, not `tā kàn le`. Safe as a rule because it
 * only ever joins what the decode had already separated — the dictionary has no
 * entry for 看了, so nothing the dictionary asserted is being overridden. The
 * readings do not change either way, so the worst case is untidy spacing.
 */
export const ASPECT_PARTICLES: GroupingRule = {
  name: "aspect-particles",
  apply: (words) =>
    joinBackwards(words, (word) => ASPECT_TAGS.has(word.partOfSpeech)),
};

/**
 * A suffix attaches to the word in front of it.
 *
 * 我们 is `wǒmen`, 作者 is `zuòzhě`. Same reasoning as the aspect particles: a
 * suffix that reached the decode as a word of its own was not in the
 * dictionary attached to anything.
 */
export const SUFFIXES: GroupingRule = {
  name: "suffixes",
  apply: (words) =>
    joinBackwards(words, (word) => word.partOfSpeech === SUFFIX_TAG),
};

/**
 * Split a decoded word into two at a character offset.
 *
 * Only possible where the reading has one syllable per character, which 儿化
 * does not: there is no way to cut `wánr` in half.
 */
function splitAt(
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
  return [part(0, at), part(at, characters.length)];
}

/**
 * A place name's generic half is written separately, and capitalised.
 *
 * GB/T 16159 专名和通名分写: 南京市 is `Nánjīng Shì`, 西湖区 is `Xīhú Qū`.
 *
 * Two conditions keep it from running away, both of them measured against the
 * whole dictionary rather than guessed. The word must be tagged a place name,
 * and **the part before the generic must itself be a word** — without the
 * second, 上山下乡 and 三街六市 are tagged `ns` and come apart as
 * `Shàngshānxià Xiāng` and `Sānjiēliù Shì`. Together they fire on 4,798 of the
 * dictionary's 8,781 candidates and hold back 427.
 *
 * The rule deliberately never touches a two-character name, so 上海 stays
 * `Shànghǎi` and 长城 stays `Chángchéng`: there, the generic character is part
 * of the proper name rather than a description of it, and no rule can tell the
 * two apart — 黄河 is `Huáng Hé` and 青海 is `Qīnghǎi`.
 */
export const PLACE_GENERICS: GroupingRule = {
  name: "place-generics",
  apply: (words, dictionary) =>
    words.flatMap((word) => {
      const characters = toCharacters(word.text);
      const generic = characters.at(-1) ?? "";
      if (
        word.partOfSpeech !== "ns" ||
        characters.length < 3 ||
        !ADMINISTRATIVE_GENERICS.has(generic) ||
        dictionary.lookup(characters.slice(0, -1).join("")) === undefined
      ) {
        return [word];
      }
      const split = splitAt(word, characters.length - 1);
      if (split === undefined) {
        return [word];
      }
      // Both halves are capitalised: 通名 is part of the name, not a common
      // noun trailing it.
      return split.map((part) => ({ ...part, isProperNoun: true }));
    }),
};

/**
 * The rules applied by default, in order.
 */
export const GROUPING_RULES: readonly GroupingRule[] = [
  ASPECT_PARTICLES,
  SUFFIXES,
  PLACE_GENERICS,
];

/**
 * Run the 分词连写 rules over a decoded run.
 */
export function applyGrouping(
  words: readonly DecodedWord[],
  dictionary: Dictionary,
  rules: readonly GroupingRule[] = GROUPING_RULES,
): readonly DecodedWord[] {
  let grouped = words;
  for (const rule of rules) {
    grouped = rule.apply(grouped, dictionary);
  }
  return grouped;
}
