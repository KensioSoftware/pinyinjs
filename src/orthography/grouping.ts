import type { Dictionary } from "../dictionary/dictionary.js";
import type { DecodedWord } from "../decode/word.js";
import { IDIOM_HYPHENS } from "./idioms.js";
import { AABB_REDUPLICATION, ABAB_REDUPLICATION } from "./reduplication.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import type { GroupingRule } from "./rule.js";
import {
  ADDRESS_PREFIX,
  COUNTED_UNIT,
  NAME_PARTS,
  SPACED_WORD_LIST,
} from "./word-grouping.js";

export {
  ADDRESS_PREFIX,
  COUNTED_UNIT,
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
 * jieba's tag for 着 and the catch-all tag it gives thousands of characters.
 *
 * 穿 is tagged `zg`, and so are 很 and 块, which no aspect particle follows. A
 * `zg` word takes 着 alone: 穿着 is `chuānzhe`, the way 看着 is `kànzhe`. 着
 * after a 很 or a 块 does not occur, and 了 after one is sentence-final.
 */
const DURATIVE_TAG = "uz";
const CATCH_ALL_TAG = "zg";

/**
 * The durative particle in both scripts.
 */
const DURATIVE_TEXT = new Set(["着", "著"]);

/**
 * Whether a word is the durative particle.
 *
 * jieba tags 着 `uz` and the 繁體 著 `n`, after 著 `zhù` *a written work*. A 著
 * the decode read neutral `zhe` is the particle whatever its tag.
 */
function isDurative(word: DecodedWord): boolean {
  if (word.partOfSpeech === DURATIVE_TAG) {
    return true;
  }
  const [syllable, ...rest] = word.reading;
  return (
    DURATIVE_TEXT.has(word.text) &&
    rest.length === 0 &&
    syllable?.initial === "zh" &&
    syllable.final === "e" &&
    syllable.tone === NEUTRAL_TONE
  );
}

/**
 * Whether a particle attaches to the word in front of it.
 */
function attachesTo(word: DecodedWord, head: DecodedWord): boolean {
  if (isDurative(word)) {
    return isAspectHost(head) || head.partOfSpeech === CATCH_ALL_TAG;
  }
  return ASPECT_TAGS.has(word.partOfSpeech) && isAspectHost(head);
}

/**
 * jieba's tag for a suffix, which is what 们 and 者 are.
 */
const SUFFIX_TAG = "k";

import { joinBackwards, PLACE_GENERICS } from "./place-grouping.js";

export { PLACE_GENERICS } from "./place-grouping.js";
export const ASPECT_PARTICLES: GroupingRule = {
  name: "aspect-particles",
  apply: (words) => joinBackwards(words, attachesTo),
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
  COUNTED_UNIT,
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
