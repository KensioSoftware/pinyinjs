/**
 * Whether a 量 is measuring something or is an amount.
 *
 * The verb is `liáng` and the noun `liàng`. The noun stands on its own mostly
 * as the tail of a compound the dictionary lacks: 乘客量, 排放量, 信息量. The
 * verb has someone doing the measuring in front of it and the thing measured,
 * or 了 or 一下, after it.
 */
import {
  type EdgeContext,
  tagOf,
  wordEndingAt,
  wordStartingAt,
} from "./rules.js";
import {
  isBareAt,
  startsWithAny,
  syllableOf,
  type VerbalFrame,
  charactersOf,
} from "./verbal-frame.js";

/**
 * What a measuring 量 takes straight after it: aspect, or how often.
 *
 * 量了我的体温, 量一下门的宽度, 我每六小时量一次体温. 量过 is left out, because
 * 需求量过大 is "the demand is too great".
 */
const ASPECT = new Set(["了", "着"]);

/**
 * How many times, which only a verb is followed by.
 */
const TIMES = ["一下", "一次", "一遍"];

/**
 * What is measured: the body's readings and a thing's dimensions.
 *
 * 量体温, 量血压, 量门的宽度. The 的 of the last is what this cannot see past,
 * so the word has to stand straight after the 量.
 */
const MEASURED = [
  "体温",
  "血压",
  "身高",
  "体重",
  "脉搏",
  "尺寸",
  "长度",
  "宽度",
  "高度",
  "厚度",
  "深度",
  "直径",
  "腰围",
  "胸围",
  "距离",
  "面积",
  "温度",
];

/**
 * What can come straight before a 量 that is measuring.
 *
 * Asking someone to (请, 帮), being in the middle of it (正在), and the modals
 * (要, 会, 可以). None of these makes a compound with 量. 能 does, which is
 * why it is out.
 */
const BEFORE = new Set([
  "请",
  "帮",
  "给",
  "正在",
  "再",
  "先",
  "要",
  "会",
  "可以",
]);

/**
 * The tag prefix jieba gives a noun.
 */
const NOUN_TAG = "n";

/**
 * Whether the 量 at a position is measuring.
 *
 * Where nothing after it says so, the word in front of it has to, and
 * something measurable has to follow: 正在量病人的脉搏.
 */
function isMeasuringAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  if (
    isBareAt(context, at + 1, ASPECT) ||
    startsWithAny(context, at + 1, TIMES) ||
    startsWithAny(context, at + 1, MEASURED) ||
    characters[at + 1] === "量" ||
    characters[at - 1] === "量"
  ) {
    return true;
  }
  const before = wordEndingAt(context, at);
  return (
    before !== undefined &&
    BEFORE.has(before) &&
    tagOf(context, wordStartingAt(context, at + 1)).startsWith(NOUN_TAG)
  );
}

/**
 * The characters that bind it into a compound reading it otherwise.
 *
 * Bound before it: 打量, 商量, 能量, 测量, 考量 and the rest of the compounds
 * reading it `liàng` or as the tail of a verb of their own. Bound after it:
 * 量力, 量产, 量子, 量词. 能 is a modal as well, and 你能量一下吗 is lost to
 * 能量, which is the commoner by far.
 */
const BOUND_BEFORE = charactersOf(
  "打商思估掂酌衡丈测測考能力质質数數重容含流产產销銷雨剂劑胆膽热熱音尽盡大少适適总總增计計度用储儲存变變等限降雪电電光当當",
);

/**
 * The characters after it that bind it into such a compound.
 */
const BOUND_AFTER = charactersOf("力产產子词詞刑化级級表程变變");

/**
 * 量 read `liáng` where it is measuring.
 */
export const LIANG_FRAME: VerbalFrame = {
  characters: new Set(["量"]),
  reading: syllableOf("liáng"),
  boundBefore: BOUND_BEFORE,
  boundAfter: BOUND_AFTER,
  isVerbalAt: isMeasuringAt,
};
