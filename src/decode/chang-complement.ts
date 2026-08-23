/**
 * What can follow a 长 that is a length and cannot follow one that is growing.
 *
 * The near-side contexts are in `chang-context.ts`, and each of them has to
 * check this side as well. These two do the opposite: they settle a 长 from what
 * comes after it and ask nothing at all about what comes before.
 */
import { toCharacters } from "../script/characters.js";
import { type EdgeContext, tagOf, wordsStartingAt } from "./rules.js";

/**
 * What can only follow a 长 that is a length.
 *
 * A quality can be compared and intensified, and a growing cannot: 长一点 is
 * longer by a bit, 长极了 is extremely long, and 长而美丽 conjoins two
 * adjectives. None of them is something a verb governs, so the near side needs
 * no test at all and these settle a 长 on their own.
 *
 * 得 is pointedly absent even though 长得很 looks like the same shape, because
 * 长得很快 is the growing with its complement and 得 is where that complement
 * hangs. {@link GROWING} in `chang-rule.ts` guards it from the other side.
 */
const COMPARED = new Set([
  "而",
  "一点",
  "一點",
  "点",
  "點",
  "一些",
  "些",
  "极了",
  "極了",
  "得多",
]);

/**
 * Whether what follows a 长 is a comparison or an intensifier.
 */
export function isCompared(context: EdgeContext): boolean {
  const { characters, edge } = context;
  for (let length = 1; length <= 2; length++) {
    const after = characters.slice(edge.to, edge.to + length).join("");
    if (COMPARED.has(after)) {
      return true;
    }
  }
  return false;
}

/**
 * The tag jieba gives a numeral.
 */
const NUMERAL = "m";

/**
 * The units a length or a duration is given in.
 *
 * Written out rather than taken from the 量词 tag, and the corpus says why: a
 * numeral after a 长 is far more often counting something else. 学校现有通榆和新
 * 长两个校区 counts campuses and 竞争马华总会长一职 counts posts, and both read
 * `zhǎng`. What a 长 can be measured in is a distance or a stretch of time, and
 * that is a closed set.
 */
const MEASURED_IN = new Set([
  "米",
  "公里",
  "千米",
  "厘米",
  "毫米",
  "公分",
  "英里",
  "英尺",
  "英寸",
  "尺",
  "寸",
  "里",
  "码",
  "秒",
  "分钟",
  "分鐘",
  "小时",
  "小時",
  "天",
  "周",
  "週",
  "年",
  "世纪",
  "世紀",
]);

/**
 * Whether a 长 is being given a measurement.
 *
 * 那条河长三百公里, 隧道长五公里. A quantity after a 长 is how long the thing is,
 * and a growing takes an aspect marker before it can take one — 长了三厘米 —
 * which is the 了 this never sees.
 */
export function isMeasured(context: EdgeContext): boolean {
  const { characters, edge } = context;
  for (const number of wordsStartingAt(context, edge.to)) {
    if (!tagOf(context, number).startsWith(NUMERAL)) {
      continue;
    }
    const at = edge.to + toCharacters(number).length;
    for (let length = 1; length <= 2; length++) {
      if (MEASURED_IN.has(characters.slice(at, at + length).join(""))) {
        return true;
      }
    }
  }
  return false;
}
