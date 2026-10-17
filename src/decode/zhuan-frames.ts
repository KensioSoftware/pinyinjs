/**
 * Whether a 转 is turning round or changing course.
 *
 * `zhuàn` turns round and round, and `zhuǎn` changes: direction (转东南),
 * state (天气转凉), post (转御史大夫) or vehicle (转火车). Both are verbs, so
 * the tag says nothing, and what tells them apart is the motion around them.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { type EdgeContext, wordEndingAt } from "./rules.js";
import {
  isBareAt,
  isRunEnd,
  startsWithAny,
  syllableOf,
  type VerbalFrame,
  charactersOf,
} from "./verbal-frame.js";

/**
 * What going round something is said with, in both scripts: 绕着地球转, 围着你转,
 * 围绕太阳转.
 */
const AROUND = ["绕", "繞", "围着", "圍著", "围绕", "圍繞"];

/**
 * What can close a clause after a 转 that is going round.
 *
 * The end of the run, 的 (世界不是围着你转的), aspect and the sentence
 * particles. 个 is out, since 转个身 is turning round once.
 */
const CLOSING = new Set(["的", "了", "着", "呀", "啊", "吧", "呢"]);

/**
 * What only turning round is followed by.
 *
 * 转起来 (风车转起来), 转得 (转得晕头转向), and 转个不停. 转过身 is turning
 * round once and reads `zhuǎn`, so 过 is out.
 */
const SPINNING = ["起来", "得", "个不停"];

/**
 * The laps a 转 goes round: 转一圈, 转了几圈, 转个圈.
 */
const LAP = "圈";

/**
 * Whether the text after a position is a number of laps, as in 一圈, 了三圈
 * and 个圈.
 */
function isLapAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  let from = at;
  if (characters[from] === "了" || characters[from] === "个") {
    from++;
  }
  while (QUANTITY_CHARACTERS.has(characters[from] ?? "")) {
    from++;
  }
  return characters[from] === LAP;
}

/**
 * What says a 转 is still at it: 这条流水线每天都在转.
 */
const ONGOING = new Set(["在", "正在"]);

/**
 * Whether the clause before a position says the 转 goes round something.
 */
function isAroundBefore(context: EdgeContext, at: number): boolean {
  const before = context.characters.slice(0, at).join("");
  return AROUND.some((word) => before.includes(word));
}

/**
 * Whether the 转 at a position is turning round.
 *
 * Going round something and still at it: 地球绕着太阳转, 这条流水线每天都在转.
 */
function isTurningAt(context: EdgeContext, at: number): boolean {
  if (startsWithAny(context, at + 1, SPINNING) || isLapAt(context, at + 1)) {
    return true;
  }
  const closes =
    isRunEnd(context, at + 1) || isBareAt(context, at + 1, CLOSING);
  if (!closes) {
    return false;
  }
  return (
    isAroundBefore(context, at) || ONGOING.has(wordEndingAt(context, at) ?? "")
  );
}

/**
 * The characters that bind it into a compound reading it otherwise.
 *
 * Bound before it: 运转, 旋转, 好转, 逆转, 周转 and the other compounds
 * reading it `zhuǎn`, so 绕地球运转 is not read as spinning. 公转 and 自转 read
 * `zhuàn` and are left out.
 */
const BOUND_BEFORE = charactersOf("运運旋扭流好逆周回反翻倒婉辗輾急掉");

/**
 * The characters after it that bind it into such a compound.
 */
const BOUND_AFTER: ReadonlySet<string> = new Set();

/**
 * 转 read `zhuàn` where it is turning round.
 */
export const ZHUAN_FRAME: VerbalFrame = {
  characters: new Set(["转", "轉"]),
  reading: syllableOf("zhuàn"),
  boundBefore: BOUND_BEFORE,
  boundAfter: BOUND_AFTER,
  isVerbalAt: isTurningAt,
};
