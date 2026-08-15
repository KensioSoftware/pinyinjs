import type { Dictionary } from "../dictionary/dictionary.js";
import type { DecodedWord } from "../decode/word.js";
import { IDIOM_HYPHENS } from "./idioms.js";
import { AABB_REDUPLICATION, ABAB_REDUPLICATION } from "./reduplication.js";
import type { GroupingRule } from "./rule.js";
import {
  ADDRESS_PREFIX,
  NAME_PARTS,
  SPACED_WORD_LIST,
} from "./word-grouping.js";

export {
  ADDRESS_PREFIX,
  NAME_PARTS,
  SPACED_WORD_LIST,
} from "./word-grouping.js";

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

import { joinBackwards, PLACE_GENERICS } from "./place-grouping.js";

export { PLACE_GENERICS } from "./place-grouping.js";
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
 * The rules applied by default, in order.
 *
 * The hyphens come last, because every rule before them moves word boundaries
 * and a hyphen is a statement about where a boundary ended up.
 */
export const GROUPING_RULES: readonly GroupingRule[] = [
  ASPECT_PARTICLES,
  SUFFIXES,
  PLACE_GENERICS,
  NAME_PARTS,
  SPACED_WORD_LIST,
  ADDRESS_PREFIX,
  AABB_REDUPLICATION,
  ABAB_REDUPLICATION,
  IDIOM_HYPHENS,
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
