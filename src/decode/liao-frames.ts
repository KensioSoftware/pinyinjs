/**
 * Whether a 了 closes a potential complement, as in 吃得了.
 */
import { toCharacters } from "../script/characters.js";
import { obtainsAt } from "./obtain-frames.js";
import {
  type EdgeContext,
  tagOf,
  wordEndingAt,
  wordsEndingAt,
} from "./rules.js";

/**
 * The verbs that put a 得 in front of a 了 without making a complement.
 *
 * Modal and phase verbs take another verb as their object.
 * 他可能得了腮腺炎 is "he may have caught mumps", and 我从星期一开始得了流感 is
 * "I started having flu on Monday". Both 得了 are `dé le`.
 */
const VERBS_OF_VERBS = new Set([
  "能",
  "可能",
  "会",
  "會",
  "可以",
  "应该",
  "應該",
  "该",
  "該",
  "要",
  "想",
  "愿意",
  "願意",
  "敢",
  "肯",
  "开始",
  "開始",
]);

/**
 * The tag jieba gives a noun made from a verb, such as 考试 and 比赛.
 */
const VERBAL_NOUN = "vn";

/**
 * Verbs that jieba tags `zg`, a bound morpheme.
 *
 * The tag is too broad to use on its own, since 您, 很 and 仍 carry it too, and
 * 您得了 and 仍得了 are `dé le`. These are the common verbs among the
 * characters it is given.
 */
const MORPHEME_VERBS = new Set(
  toCharacters("穿掉选選丢丟挡擋护護寻尋搜刷抛拋抖吊削揭押判升"),
);

/**
 * Whether a word can take a potential complement.
 *
 * A single character tagged as a verb of any kind is one, and so is one of
 * {@link MORPHEME_VERBS}. A longer word has to be a verb rather than a noun
 * made from one, since 他考试得了一百分 is "he got a hundred in the exam".
 */
function takesComplement(context: EdgeContext, word: string): boolean {
  if (VERBS_OF_VERBS.has(word)) {
    return false;
  }
  const tag = tagOf(context, word);
  if (toCharacters(word).length === 1) {
    return tag.startsWith("v") || MORPHEME_VERBS.has(word);
  }
  return tag.startsWith("v") && tag !== VERBAL_NOUN;
}

/**
 * The verb-and-得 words whose 得 can still mark a potential complement.
 *
 * Every other verb that makes a word with 得 is a verb of its own, and the 了
 * after it is aspect: 获得了, 取得了, 赢得了, 记得了, 觉得了. 来得 is listed
 * for 来得及 and 来得快, but 来得了 is the potential of 来, as in 来不了. 算得 is
 * listed for 算得上, and 这算得了什么 is the potential of 算.
 */
const POTENTIAL_STEMS = new Set(["来得", "來得", "算得"]);

/**
 * The verbs that make a word with 得 whose 了 is aspect.
 *
 * The dictionary says the same in the standard and full tiers, where 获得,
 * 取得 and 记得 are words, but the core tier holds single characters only and
 * cannot tell 获得了 from 吃得了. Most of these take 得 in its sense of
 * obtaining (获得, 赢得, 谋得). The rest are verbs of knowing (记得, 懂得,
 * 晓得), the verbs 使得, 值得, 显得, 变得, 免得, 舍得 and 懒得, and 有得.
 */
export const LEXICAL_STEMS: ReadonlySet<string> = new Set([
  ...toCharacters("获獲取赢贏夺奪谋謀求博购購征挣掙争爭赚賺"),
  ...toCharacters("记記觉覺懂晓曉认認"),
  ...toCharacters("使值显顯变變免舍捨懒懶有"),
]);

/**
 * Whether the 了 at a position closes a potential complement.
 *
 * 吃得了 is "able to eat it all" and reads `chī de liǎo`, the positive of
 * 吃不了. The verb in front of the 得 has to be a word of its own, so a verb
 * that makes a word with the 得 keeps the aspect 了 unless it is listed in
 * {@link POTENTIAL_STEMS}. 得了吧 and 他得了病 have no verb in front of the 得,
 * and in 确诊得了肺炎 the illness after the 了 makes the 得 "to contract".
 */
export function isPotentialAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  if (
    characters[at] !== "了" ||
    characters[at - 1] !== "得" ||
    obtainsAt(context, at - 1)
  ) {
    return false;
  }
  const lexical = wordsEndingAt(context, at).some(
    (word) => toCharacters(word).length > 1 && !POTENTIAL_STEMS.has(word),
  );
  if (lexical || LEXICAL_STEMS.has(characters[at - 2] ?? "")) {
    return false;
  }
  const verb = wordEndingAt(context, at - 1);
  return verb !== undefined && takesComplement(context, verb);
}
