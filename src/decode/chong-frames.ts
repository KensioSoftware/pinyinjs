/**
 * Whether a 冲 is strong or is rushing.
 *
 * `chōng` rushes, rinses and charges, and is nearly every 冲 standing on its
 * own. `chòng` is strong, of a smell or a manner (味道很冲, 他说话太冲), and
 * stands where an adjective would, after a degree adverb. It is also the
 * preposition of 冲着, *at* or *towards* someone (他冲着我笑).
 */
import { type EdgeContext, wordEndingAt } from "./rules.js";
import {
  isBareAt,
  isRunEnd,
  syllableOf,
  type VerbalFrame,
} from "./verbal-frame.js";

/**
 * The degree adverbs an adjective follows.
 */
const DEGREE = new Set([
  "很",
  "太",
  "真",
  "挺",
  "好",
  "特别",
  "非常",
  "有点",
  "有点儿",
  "那么",
  "这么",
  "十分",
  "比较",
  "更",
  "最",
]);

/**
 * What can close a clause after an adjective: aspect, 的 and the sentence
 * particles.
 */
const CLOSING = new Set(["了", "的", "啊", "呀", "吧", "呢", "哦"]);

/**
 * The 着 of 冲着, in both scripts.
 */
const ZHE = new Set(["着", "著"]);

/**
 * What stands in front of a 冲 that is rushing in a direction: 往前冲着,
 * 向外冲着, 朝门口冲着.
 */
const HEADING = new Set(["往", "向", "朝", "前", "外", "里", "裡", "上", "下"]);

/**
 * Whether the 冲 at a position opens 冲着 with something after it.
 *
 * 他冲着人家大喊 and 你别冲着我来 are 冲着 *at* someone. A 冲着 that closes
 * the clause (他们一路冲着) or follows a direction (往前冲着跑) is still
 * rushing, and keeps `chōng`.
 */
function isFacingAt(context: EdgeContext, at: number): boolean {
  return (
    ZHE.has(context.characters[at + 1] ?? "") &&
    !HEADING.has(context.characters[at - 1] ?? "") &&
    !isRunEnd(context, at + 2) &&
    !CLOSING.has(context.characters[at + 2] ?? "")
  );
}

/**
 * Whether the 冲 at a position is strong.
 *
 * Only where the clause ends with it. 很冲动 is a word, and 太冲进去 is no
 * sentence anybody writes, but the guard costs nothing.
 */
function isStrongAt(context: EdgeContext, at: number): boolean {
  return (
    DEGREE.has(wordEndingAt(context, at) ?? "") &&
    (isRunEnd(context, at + 1) || isBareAt(context, at + 1, CLOSING))
  );
}

/**
 * Whether the 冲 at a position reads `chòng`.
 */
function isChongAt(context: EdgeContext, at: number): boolean {
  return isStrongAt(context, at) || isFacingAt(context, at);
}

/**
 * 冲 read `chòng` where it is strong, or faces someone as 冲着.
 *
 * 繁體 writes it 衝, which Unihan reads both ways too. 沖 rinses and is
 * `chōng` alone.
 */
export const CHONG_FRAME: VerbalFrame = {
  characters: new Set(["冲", "衝"]),
  reading: syllableOf("chòng"),
  boundBefore: new Set(),
  boundAfter: new Set(),
  isVerbalAt: isChongAt,
};
