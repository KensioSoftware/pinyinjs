/**
 * Whether a 调 is adjusting or mixing something, or is a transfer or a tune.
 *
 * `tiáo` adjusts and mixes, and `diào` transfers someone to a post (调往广州,
 * 调至远东) or names a key or a tune. The adjusting verb takes a complement
 * saying which way: 调低, 调高, 调亮, 调快.
 */
import type { EdgeContext } from "./rules.js";
import {
  isBareAt,
  startsWithAny,
  syllableOf,
  type VerbalFrame,
} from "./verbal-frame.js";

/**
 * The complements that say which way something was adjusted.
 *
 * 把音量调低, 把冷气调高, 把灯调亮, 把钟调快, 把火调小. Every one of them is a
 * degree of something a dial or a knob sets.
 *
 * 低 stands bare in 调低价格 even though 低价 is a word, so the complement is
 * read as a character and not asked whether it opens one.
 */
const WHICH_WAY = new Set([
  "高",
  "低",
  "大",
  "小",
  "快",
  "慢",
  "亮",
  "暗",
  "准",
  "匀",
  "淡",
  "浓",
  "松",
  "紧",
  "强",
  "弱",
]);

/**
 * What a 调 is followed by where it is tuning an instrument, with aspect in
 * between: 这台琴好多年没调过音了.
 *
 * 调音 is a word and reads `tiáo` through it. Taken apart, the 调 is left to
 * stand alone.
 */
const ASPECT = new Set(["过", "過", "了", "好"]);

/**
 * What a 调 that is mixing a drink is followed by: 调杯热饮料, 调一杯鸡尾酒.
 */
const MIXED = ["杯", "一杯", "两杯"];

/**
 * Whether the 调 at a position is adjusting or mixing.
 */
function isAdjustingAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  return (
    WHICH_WAY.has(characters[at + 1] ?? "") ||
    (isBareAt(context, at + 1, ASPECT) && characters[at + 2] === "音") ||
    startsWithAny(context, at + 1, MIXED)
  );
}

/**
 * 调 read `tiáo` where it is adjusting or mixing.
 */
export const TIAO_FRAME: VerbalFrame = {
  characters: new Set(["调", "調"]),
  reading: syllableOf("tiáo"),
  boundBefore: new Set(),
  boundAfter: new Set(),
  isVerbalAt: isAdjustingAt,
};
