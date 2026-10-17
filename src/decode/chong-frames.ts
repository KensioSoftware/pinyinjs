/**
 * Whether a 冲 is strong or is rushing.
 *
 * `chōng` rushes, rinses and charges, and is nearly every 冲 standing on its
 * own. `chòng` is strong, of a smell or a manner (味道很冲, 他说话太冲), and
 * stands where an adjective would, after a degree adverb.
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
 * 冲 read `chòng` where it is strong.
 *
 * 繁體 writes it 衝, which Unihan reads both ways too. 沖 rinses and is
 * `chōng` alone.
 */
export const CHONG_FRAME: VerbalFrame = {
  characters: new Set(["冲", "衝"]),
  reading: syllableOf("chòng"),
  boundBefore: new Set(),
  boundAfter: new Set(),
  isVerbalAt: isStrongAt,
};
