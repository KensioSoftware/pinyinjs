/**
 * Whether a 只 is counting something or is the adverb "only".
 *
 * The measure word is `zhī` and the adverb is `zhǐ`. 繁體 writes the measure
 * word 隻, so a 只 is ambiguous in 简体 text only.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  tagOf,
  wordEndingAt,
  wordsEndingAt,
  wordStartingAt,
  wordsStartingAt,
} from "./rules.js";

/**
 * The character this rule reads.
 */
const ZHI = "只";

/**
 * Whether a syllable is `zhī`, the measure word.
 */
export function isZhi(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "zh" && syllable.final === "i" && syllable.tone === 1
  );
}

/**
 * What can count a 只 besides the numerals themselves.
 *
 * 几 asks how many and 半 is half of one (半只烧鸡). 每 is "each", which is
 * always followed by a measure word.
 */
const COUNTING = new Set([...QUANTITY_CHARACTERS, "几", "幾", "半", "每"]);

/**
 * What can stand between a number and its measure word to make it
 * approximate, as in 十多只, 百余只 and 十来只.
 */
const APPROXIMATE = new Set(["多", "余", "餘", "来", "來"]);

/**
 * The demonstratives a measure word follows.
 *
 * 這 is in for mixed text such as 總算把那只野貓趕跑了. 繁體 proper writes
 * 這隻 and never reaches this rule.
 */
const DEMONSTRATIVES = new Set(["这", "這", "那", "哪"]);

/**
 * The tags of a word a demonstrative's 只 can count.
 *
 * Nouns of every kind, adjectives (那只黑鸟), untagged keys, and `zg`, which
 * jieba gives 鸟. A verb, an adverb, a preposition or a conjunction after 这只
 * makes the 只 the adverb, as in 这只会导致无休止的争论, 这只表明你不是一个机器人
 * and 那只会在电影里发生.
 */
function isCountedTag(tag: string): boolean {
  return tag === "" || tag === "zg" || tag === "a" || tag.startsWith("n");
}

/**
 * Whether a tagged word of more than one character ends at a position.
 *
 * Untagged keys such as the full tier's 的那 are left out, since 屋顶上的那只猫
 * is 的 and then 那.
 */
function endsTaggedWord(context: EdgeContext, at: number): boolean {
  return wordsEndingAt(context, at).some(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * The ordinal mark, which leaves the number after it counting.
 *
 * 第三只猫 is the third cat, and its 只 is the measure word all the same.
 */
const ORDINAL = "第";

/**
 * Where the number in front of a position starts, or undefined where no number
 * ends there.
 *
 * 多少 is a number of its own. 多, 余 and 来 count only after a numeral, which
 * keeps 最多只能 and 大多只用 out. A lone 半 after another numeral is 一半,
 * which is half of something rather than half of one, so 一半只是 is out too.
 */
function numberStartBefore(
  characters: readonly string[],
  at: number,
): number | undefined {
  if (characters[at - 2] === "多" && characters[at - 1] === "少") {
    return at - 2;
  }
  let end = at;
  if (
    APPROXIMATE.has(characters[end - 1] ?? "") &&
    COUNTING.has(characters[end - 2] ?? "")
  ) {
    end--;
  }
  if (characters[end - 1] === "半" && COUNTING.has(characters[end - 2] ?? "")) {
    return undefined;
  }
  let from = end;
  while (from > 0 && COUNTING.has(characters[from - 1] ?? "")) {
    from--;
  }
  return from === end ? undefined : from;
}

/**
 * Whether the number in front of the 只 at a position is counting it.
 *
 * A numeral inside a longer word belongs to that word. 唯一只有 is "the only
 * one is only", and 唯一 is the word ending at the 只. An ordinal is the one
 * longer word allowed, since 第三 still counts.
 */
function isNumberedAt(context: EdgeContext, at: number): boolean {
  const from = numberStartBefore(context.characters, at);
  if (from === undefined) {
    return false;
  }
  const before = wordEndingAt(context, at);
  /* c8 ignore next -- every character before a 只 is a word of its own */
  const held = before === undefined ? at : at - toCharacters(before).length;
  return (
    held >= from || (held === from - 1 && context.characters[held] === ORDINAL)
  );
}

/**
 * Whether the 只 at a position is a demonstrative's measure word.
 *
 * No tagged word may end at the 只 and take the demonstrative with it, which
 * keeps 刹那 and 支那 out.
 * A longer word starting at the 只 and reading it `zhǐ` makes it the adverb,
 * which is 这只是, 那只有 and 那只要, and those are the commoner sense by far.
 * See {@link isCountedTag} for what has to follow.
 */
function isDemonstratedAt(context: EdgeContext, at: number): boolean {
  const before = context.characters[at - 1] ?? "";
  if (!DEMONSTRATIVES.has(before) || endsTaggedWord(context, at)) {
    return false;
  }
  const adverbial = wordsStartingAt(context, at).some(
    (word) =>
      toCharacters(word).length > 1 &&
      !isZhi(context.dictionary.lookup(word)?.reading[0]),
  );
  if (adverbial) {
    return false;
  }
  const counted = wordStartingAt(context, at + 1);
  return counted === undefined || isCountedTag(tagOf(context, counted));
}

/**
 * Whether the 只 at a position is a measure word.
 */
export function isMeasureAt(context: EdgeContext, at: number): boolean {
  return (
    context.characters[at] === ZHI &&
    (isNumberedAt(context, at) || isDemonstratedAt(context, at))
  );
}
