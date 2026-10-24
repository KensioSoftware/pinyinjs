/**
 * The 常用 that is 常 *often* and the verb 用 *use*, and not the adjective
 * *in common use*.
 *
 * 常用 is a word, and every source counts it: 常用的汉字, 一个常用工具, 越来越常用.
 * The same two characters are as often the adverb 常 in front of 用 taking an
 * object, with a second verb saying what the thing is used for: 我常用微博看新闻,
 * 妈妈常用剩饭给我们做炒饭, 父亲常用慎独这个词提醒我. The decode read every one
 * of them as the adjective, and filed the sentence under the wrong word.
 */
import { toCharacters } from "../script/characters.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
  wordsEndingAt,
} from "./rules.js";

/**
 * The word, which is written the same in both scripts.
 */
const IN_COMMON_USE = new Set(["常用"]);

/**
 * The words in front of 常用 that make it describe something.
 *
 * A degree word grades the adjective (很常用, 最常用的, 越来越常用), and 是 says
 * what something is (是常用的). The adverb 常 takes none of them.
 */
const BEFORE_ADJECTIVE = new Set([
  "很",
  "最",
  "更",
  "挺",
  "较",
  "較",
  "比较",
  "比較",
  "非常",
  "十分",
  "相当",
  "相當",
  "越来越",
  "越來越",
  "是",
]);

/**
 * The measure words that leave 常用 describing the noun they count.
 *
 * 一个常用工具, 哪些常用的汉字, 一种常用的方法.
 */
const MEASURES = new Set(toCharacters("个個种種些项項类類款套"));

/**
 * What can follow the adjective and not the verb.
 *
 * 常用的 describes a noun, and 常用于 is *commonly used for*, a fixed phrase
 * with 用于 inside it. The end of the run (越来越常用。) leaves 用 no object.
 */
const AFTER_ADJECTIVE = new Set(["的", "于", "於", ""]);

/**
 * The characters after 常用 that make it one of the vocabulary nouns.
 *
 * 常用词, 常用字 and 常用语 are the commonly used words, characters and
 * phrases, and 常用词汇 and 常用词表 grow out of them. 常用字 is a word of its
 * own and 常用词 is not, so 学习常用词很重要 read 常 用词.
 */
const VOCABULARY = new Set(toCharacters("词詞字语語"));

/**
 * The tag prefix jieba gives an adverb.
 */
const ADVERB_TAG = "d";

/**
 * The tag prefix jieba gives a verb.
 */
const VERB_TAG = "v";

/**
 * Whether a longer word other than an adverb ends at the 常, and would take it
 * once 常用 is gone.
 *
 * 文学作品中常用夜来香来象征思念 is 中 and then 常 用, and taking the edge away let
 * 中常 *middling* take the 常. Which word the 常 belongs to there is a question
 * this rule cannot answer, so it leaves the decode as it was. An adverb is let
 * through, because an adverb in front of 用 is the reading the rule is after:
 * 时常常用古书里的典故 is 时 常常 用. Only a tagged word counts, as in
 * {@link import("./cai-rule.js").MODAL_CAI}.
 */
function isClaimed(context: EdgeContext, from: number): boolean {
  return wordsEndingAt(context, from + 1).some((word) => {
    const tag = tagOf(context, word);
    return word.length > 1 && tag !== "" && !tag.startsWith(ADVERB_TAG);
  });
}

/**
 * Whether the context at a 常用 says it is the adjective.
 */
function isAdjective(context: EdgeContext, from: number, to: number): boolean {
  const next = context.characters[to] ?? "";
  if (AFTER_ADJECTIVE.has(next) || VOCABULARY.has(next)) {
    return true;
  }
  // A run that starts with 常用 has no subject for 常 to be the adverb of,
  // and is more often a heading or a list: 常用工具, 常用字.
  if (from === 0) {
    return true;
  }
  // A verb in front has 常用 describe its object: 掌握常用词汇, 学习常用工具.
  // The longest word is asked, since 父亲 ends in 亲, which can be a verb.
  if (tagOf(context, wordEndingAt(context, from)).startsWith(VERB_TAG)) {
    return true;
  }
  return wordsEndingAt(context, from).some(
    (word) => BEFORE_ADJECTIVE.has(word) || MEASURES.has(word.at(-1) ?? ""),
  );
}

/**
 * 常用 is taken apart where 用 has an object and 常 is the adverb in front of it.
 *
 * The adjective is kept after a verb, a degree word, a 是 or a measure word,
 * before a 的, a 于, a 词, 字 or 语 or the end of the run, and at the start of
 * the run. Where a word other than an adverb already ends at the 常, the
 * decode is left as it was. Everywhere else the 常 is *often* and the 用
 * *use*. Taking the edge away leaves the two to
 * read as themselves. The readings are `cháng yòng` either way, so this
 * changes the segmentation and the spacing.
 */
export const VERBAL_CHANGYONG: EdgeRule = {
  name: "verbal-changyong",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    return IN_COMMON_USE.has(edge.text) &&
      !isClaimed(context, edge.from) &&
      !isAdjective(context, edge.from, edge.to)
      ? "forbid"
      : "keep";
  },
};
