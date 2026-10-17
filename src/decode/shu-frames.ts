/**
 * Whether a 数 is counting or is a number.
 *
 * The verb is `shǔ` and the noun `shù`. A 数 standing on its own is most often
 * "several" in front of a number or a measure word (数十人, 数千人, 数个小时),
 * or the tail of a compound the dictionary lacks (里程数, 网民数). The verb
 * counts up to something, or takes 了 or 一下.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import {
  type EdgeContext,
  tagOf,
  wordEndingAt,
  wordStartingAt,
} from "./rules.js";
import {
  isBareAt,
  isRunEnd,
  startsWithAny,
  syllableOf,
  type VerbalFrame,
  charactersOf,
} from "./verbal-frame.js";

/**
 * The 到 of 数到十, which only counting is followed by.
 */
const UP_TO = new Set(["到"]);

/**
 * Aspect after the verb: 我数了一下, 汤姆数了他的钱, 你有试过数星星吗.
 */
const ASPECT = new Set(["了", "着", "过", "過"]);

/**
 * How many times, which only a verb is followed by.
 */
const TIMES = ["一下", "一遍", "一数"];

/**
 * What can come straight before a 数 that is counting.
 *
 * 开始数羊, 这孩子能数到二十. 在 is left out, since 在数分钟内 is "within a few
 * minutes".
 */
const BEFORE = new Set(["开始", "会", "能", "可以", "请", "再", "一起", "帮"]);

/**
 * The tags of what a counting 数 can be followed by after {@link BEFORE}.
 *
 * Nouns of every kind and pronouns. The spans of time in {@link TIME} are
 * nouns too, and are kept out before the tag is asked.
 */
function isCountedTag(tag: string): boolean {
  return tag.startsWith("n") || tag === "r";
}

/**
 * The spans of time 数 counts as "several": 数小时, 数日, 数年.
 */
const TIME = [
  "小时",
  "年",
  "天",
  "日",
  "月",
  "周",
  "星期",
  "世纪",
  "分钟",
  "秒",
];

/**
 * Whether the 数 at a position is counting.
 *
 * A numeral in front of it makes it part of a number, as in 十数人.
 */
function isCountingAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  if (QUANTITY_CHARACTERS.has(characters[at - 1] ?? "")) {
    return false;
  }
  if (
    isBareAt(context, at + 1, UP_TO) ||
    startsWithAny(context, at + 1, TIMES) ||
    isBareAt(context, at + 1, ASPECT)
  ) {
    return true;
  }
  const before = wordEndingAt(context, at);
  if (before === undefined || !BEFORE.has(before)) {
    return false;
  }
  if (isRunEnd(context, at + 1)) {
    return true;
  }
  return (
    !startsWithAny(context, at + 1, TIME) &&
    isCountedTag(tagOf(context, wordStartingAt(context, at + 1)))
  );
}

/**
 * The characters that bind it into a compound reading it otherwise.
 *
 * Bound before it: 岁数, 多数, 人数, 次数, 分数 and the other nouns ending in
 * it, so 你多大岁数了 is not read as counting. 倒数 is left out, since it
 * counts too.
 */
const BOUND_BEFORE = charactersOf(
  "岁歲多少人次倍分无無函指常变變参參级級总總页頁字步票件户戶名头頭号號礼禮算整基奇偶正负負复複小半单單双雙实實虚虛质質素回场場",
);

/**
 * The characters after it that bind it into such a compound.
 */
const BOUND_AFTER: ReadonlySet<string> = new Set();

/**
 * 数 read `shǔ` where it is counting.
 */
export const SHU_FRAME: VerbalFrame = {
  characters: new Set(["数", "數"]),
  reading: syllableOf("shǔ"),
  boundBefore: BOUND_BEFORE,
  boundAfter: BOUND_AFTER,
  isVerbalAt: isCountingAt,
};
