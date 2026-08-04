import type { Dictionary } from "../dictionary/dictionary.js";
import type { DecodedWord } from "../decode/word.js";
import { characterCount, toCharacters } from "../script/characters.js";
import { AABB_REDUPLICATION, ABAB_REDUPLICATION } from "./reduplication.js";
import { type GroupingRule, join, splitAt } from "./rule.js";
import { LONGEST_SPACED_WORD, SPACED_WORD_FORMS } from "./word-list.js";

/**
 * jieba's tags for the aspect particles 了, 着 and 过.
 */
const ASPECT_TAGS = new Set(["ul", "uz", "ug"]);

/**
 * Whether a word is one an aspect particle can attach to.
 *
 * jieba's verb tags all begin `v`; an adjective takes one too, as 好了 does.
 * Anything else in front of a 了 is a sentence-final 了 rather than an aspect
 * marker, and is written on its own: 我还给你了 is `Wǒ huán gěi nǐ le`, not
 * `nǐle`.
 */
function isAspectHost(word: DecodedWord): boolean {
  return word.partOfSpeech.startsWith("v") || word.partOfSpeech === "a";
}

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
 * Fold every word a predicate accepts into the word before it.
 */
function joinBackwards(
  words: readonly DecodedWord[],
  isAttached: (word: DecodedWord, head: DecodedWord) => boolean,
): readonly DecodedWord[] {
  const grouped: DecodedWord[] = [];
  for (const word of words) {
    const head = grouped.at(-1);
    if (head !== undefined && isAttached(word, head)) {
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
    joinBackwards(
      words,
      (word, head) => ASPECT_TAGS.has(word.partOfSpeech) && isAspectHost(head),
    ),
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
 * The character span each decoded word covers, in order.
 */
function spansOf(
  words: readonly DecodedWord[],
): readonly { readonly at: number; readonly word: DecodedWord }[] {
  let at = 0;
  return words.map((word) => {
    const span = { at, word };
    at += toCharacters(word.text).length;
    return span;
  });
}

/**
 * Rewrite the words covering a span into the parts the standard writes.
 *
 * The readings are redistributed by character count, so this only applies where
 * every covered word reads one syllable per character. 儿化 cannot be
 * redistributed and is left alone.
 */
function respace(
  covered: readonly DecodedWord[],
  parts: readonly string[],
): readonly DecodedWord[] | undefined {
  const reading = covered.flatMap((word) => [...word.reading]);
  const characters = covered.flatMap((word) => toCharacters(word.text));
  if (reading.length !== characters.length) {
    return undefined;
  }
  const head = covered[0];
  /* c8 ignore next 3 -- the caller only passes a span it matched */
  if (head === undefined) {
    return undefined;
  }

  let at = 0;
  return parts.map((part) => {
    const length = toCharacters(part).length;
    const written = {
      text: part,
      reading: reading.slice(at, at + length),
      isProperNoun: head.isProperNoun,
      partOfSpeech: head.partOfSpeech,
      isKnown: head.isKnown,
    };
    at += length;
    return written;
  });
}

/**
 * The longest listed form starting at a word, with how many words it consumed.
 *
 * Longest-first, so 一个人 would beat 一个 if both were listed. A listed entry
 * has to end on a word boundary too: it is a claim about whole words, not
 * about the middle of one.
 */
function longestListedFrom(
  spans: readonly { readonly at: number; readonly word: DecodedWord }[],
  index: number,
):
  | { readonly written: readonly DecodedWord[]; readonly consumed: number }
  | undefined {
  for (let end = spans.length; end > index; end--) {
    const covered = spans.slice(index, end).map((span) => span.word);
    const text = covered.map((word) => word.text).join("");
    if (characterCount(text) <= LONGEST_SPACED_WORD) {
      const parts = SPACED_WORD_FORMS.get(text);
      const written = parts === undefined ? undefined : respace(covered, parts);
      if (written !== undefined) {
        return { written, consumed: end - index - 1 };
      }
    }
  }
  return undefined;
}

/**
 * Write the words GB/T 16159 spaces in a way no rule reaches.
 *
 * Matches longest-first at each word boundary, and only where the entry ends on
 * a word boundary too: a table entry is a claim about a whole word or several,
 * not about the middle of one.
 */
export const SPACED_WORD_LIST: GroupingRule = {
  name: "spaced-word-list",
  apply: (words) => {
    const spans = spansOf(words);
    const grouped: DecodedWord[] = [];

    for (let index = 0; index < spans.length; index++) {
      const start = spans[index];
      /* c8 ignore next 3 -- index stays inside the array */
      if (start === undefined) {
        continue;
      }
      const matched = longestListedFrom(spans, index);
      grouped.push(...(matched?.written ?? [start.word]));
      index += matched?.consumed ?? 0;
    }

    return grouped;
  },
};

/**
 * The rules applied by default, in order.
 *
 * The hyphens come last, because every rule before them moves word boundaries
 * and a hyphen is a statement about where a boundary ended up.
 */
export const GROUPING_RULES: readonly GroupingRule[] = [
  ASPECT_PARTICLES,
  SUFFIXES,
  PLACE_GENERICS,
  SPACED_WORD_LIST,
  AABB_REDUPLICATION,
  ABAB_REDUPLICATION,
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
