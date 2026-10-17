/**
 * Whether a 结 is bearing fruit or is tying, forming or ending something.
 *
 * `jiē` bears fruit and `jié` does nearly everything else: 结婚, 结冰, 结疤,
 * 结为兄弟. Both are verbs, and what tells them apart is the object, which for
 * `jiē` is fruit.
 */
import { toCharacters } from "../script/characters.js";
import { type EdgeContext, tagOf, wordStartingAt } from "./rules.js";
import { charactersOf, syllableOf, type VerbalFrame } from "./verbal-frame.js";

/**
 * The characters that make a word fruit: 果实, 果子, 苹果, 桃儿, 西瓜.
 */
const FRUIT = new Set([
  "果",
  "桃",
  "瓜",
  "籽",
  "梨",
  "枣",
  "杏",
  "莓",
  "橘",
  "柿",
  "李",
]);

/**
 * The complements and aspect that may stand between the 结 and its fruit:
 * 结满了, 结出, 结上.
 *
 * Taken a character at a time, since 上好的桃儿 holds 上好 as a word and the
 * decode reads 上 and 好 apart.
 */
const BETWEEN = new Set(["满", "出", "上", "下", "了", "过", "過", "着", "著"]);

/**
 * The tags of the words describing the fruit: adjectives, numerals, measure
 * words and 的. A verb or a noun that is not fruit ends the search, so 结了婚
 * never reaches a 苹果 later on.
 */
function isDescribingTag(tag: string): boolean {
  return /^(a|b|m|q|u|z|d)/u.test(tag);
}

/**
 * How far past the 结 the fruit may be, in words.
 */
const REACH = 5;

/**
 * Whether the 结 at a position has fruit for its object.
 */
function isBearingAt(context: EdgeContext, at: number): boolean {
  let from = at + 1;
  for (let step = 0; step < REACH; step++) {
    const character = context.characters[from] ?? "";
    if (BETWEEN.has(character)) {
      from++;
      continue;
    }
    const word = wordStartingAt(context, from);
    if (word === undefined) {
      return false;
    }
    const characters = toCharacters(word);
    if (characters.some((character) => FRUIT.has(character))) {
      return true;
    }
    if (!isDescribingTag(tagOf(context, word))) {
      return false;
    }
    from += characters.length;
  }
  return false;
}

/**
 * The characters that bind it into a compound reading it otherwise.
 *
 * Bound after it: 果. 结果 is "the result" far more often than it is
 * bearing fruit, and the core tier does not hold it.
 */
const BOUND_BEFORE: ReadonlySet<string> = new Set();

/**
 * The characters after it that bind it into such a compound.
 */
const BOUND_AFTER = charactersOf("果");

/**
 * 结 read `jiē` where it bears fruit.
 */
export const JIE_FRAME: VerbalFrame = {
  characters: new Set(["结", "結"]),
  reading: syllableOf("jiē"),
  boundBefore: BOUND_BEFORE,
  boundAfter: BOUND_AFTER,
  isVerbalAt: isBearingAt,
};
