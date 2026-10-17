/**
 * The reading rule for characters whose verb reads differently from the rest
 * of them: 量, 数, 调, 系, 转, 钉, 结, 相 and 冲.
 */
import { isSameSyllable } from "../dictionary/entry.js";
import { CHONG_FRAME } from "./chong-frames.js";
import { DING_FRAME } from "./ding-frames.js";
import { JI_FRAME } from "./ji-frames.js";
import { JIE_FRAME } from "./jie-frames.js";
import { LIANG_FRAME } from "./liang-frames.js";
import type { EdgeContext, EdgeRule, EdgeVerdict } from "./rules.js";
import { SHU_FRAME } from "./shu-frames.js";
import { TIAO_FRAME } from "./tiao-frames.js";
import { isBoundAt, type VerbalFrame } from "./verbal-frame.js";
import { isHeldAgainst } from "./verbal-held.js";
import { XIANG_FRAME } from "./xiang-frames.js";
import { ZHUAN_FRAME } from "./zhuan-frames.js";

/**
 * Every frame, one to a character.
 */
export const VERBAL_FRAMES: readonly VerbalFrame[] = [
  LIANG_FRAME,
  SHU_FRAME,
  TIAO_FRAME,
  JI_FRAME,
  ZHUAN_FRAME,
  DING_FRAME,
  JIE_FRAME,
  XIANG_FRAME,
  CHONG_FRAME,
];

/**
 * The frames by the characters they read.
 */
const FRAMES_BY_CHARACTER: ReadonlyMap<string, VerbalFrame> = new Map(
  VERBAL_FRAMES.flatMap((frame) =>
    [...frame.characters].map((character) => [character, frame] as const),
  ),
);

/**
 * The frame saying the character at a position is its verb, or undefined.
 */
function frameAt(context: EdgeContext, at: number): VerbalFrame | undefined {
  /* c8 ignore next -- the position is inside the run */
  const frame = FRAMES_BY_CHARACTER.get(context.characters[at] ?? "");
  if (
    frame === undefined ||
    isBoundAt(context, at, frame) ||
    isHeldAgainst(context, at, frame.reading) ||
    !frame.isVerbalAt(context, at)
  ) {
    return undefined;
  }
  return frame;
}

/**
 * The verb's reading for nine characters where the sentence uses the verb.
 *
 * Each of them is stored with another reading first, and for the same reason:
 * the commoner reading in a corpus is the one inside words. 量 is `liàng` in
 * 数量, 质量 and 词汇量, 数 is `shù` in 数字 and 数十, 调 is `diào` in 调查, 系
 * is `xì` in 关系, and so on. A word carries its own reading, so what the
 * default decides is the character standing on its own, and in running text
 * that is as often the verb as anything. 我妈妈量了我的体温 came out with
 * `liàng`, 你能数到十吗 with `shù` and 请把音量调低一点 with `diào`.
 *
 * The verb is told apart by its neighbours, a different set for each
 * character, so each has a frame of its own in a file of its own. They share
 * how the verdict is given, which is the way {@link import("./zhi-rule.js").COUNTING_ZHI}
 * gives it: where a frame holds, the edge of the character alone reading the
 * verb is forced, and an edge of several characters reading it some other way
 * is forbidden. A tagged word holding the character with another reading is
 * left alone, since 词汇量 and 关系 decide their own.
 *
 * The reading the frame names has to be among the character's readings for
 * the rule to do anything. Unihan gives 繫 and 釘 no `jì` and no `dìng`, so
 * those two forms are left out until the data has them.
 */
export const VERBAL_READING: EdgeRule = {
  name: "verbal-reading",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.reading.length !== edge.to - edge.from) {
      return "keep";
    }
    let verdict: EdgeVerdict = "keep";
    for (let at = edge.from; at < edge.to; at++) {
      const frame = frameAt(context, at);
      if (frame === undefined) {
        continue;
      }
      const here = edge.reading[at - edge.from];
      /* c8 ignore next 3 -- the reading is as long as the span */
      if (here === undefined) {
        continue;
      }
      if (!isSameSyllable(here, frame.reading)) {
        return edge.to - edge.from === 1 ? "keep" : "forbid";
      }
      if (edge.to - edge.from === 1) {
        verdict = "force";
      }
    }
    return verdict;
  },
};
