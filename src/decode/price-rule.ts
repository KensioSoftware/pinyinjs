/**
 * A price is a number and the unit it counts, and 只要 before one is *only
 * costs*.
 *
 * jieba counts 一元, 三元, 五元, 七元 and 八元 as words, and 五毛 and 三角 too,
 * so the decode read 这个五元 as 这个 五元 and 十元 as 十 元, by nothing but
 * which numbers jieba happened to see before 元. A caller filing words under
 * their dictionary entries found 五元 in none. And 晚上可能只要五元 is 只 *only*
 * and 要 *costs*, where the decode read the conjunction 只要 *so long as*.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { toCharacters } from "../script/characters.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordsStartingAt,
} from "./rules.js";

/**
 * 元, which after a number is the yuan whatever surrounds it.
 *
 * 一元 is also *univariate*, but lives on in the longer words that need it,
 * 一元二次方程 and 一元论, which this rule never reaches. {@link BINARY} is the
 * one number kept.
 */
const YUAN = new Set(toCharacters("元圆圓"));

/**
 * 毛 and 角, the tenth of a yuan, which after a number is as often something
 * else.
 *
 * 三角 is a triangle, 八角 star anise, 四角 four corners and 三毛 a writer's
 * pen name. Each is cut only where {@link isPriced} finds money around it.
 */
const JIAO = new Set(toCharacters("毛角"));

/**
 * What says a 毛 or 角 counts money: the money after it, or the larger unit
 * before its number, as in 两块五毛.
 */
const MONEY_AFTER = new Set(toCharacters("钱錢"));
const UNIT_BEFORE = new Set(toCharacters("块塊元圆圓"));

/**
 * Every unit of money a number can count, whatever jieba tags it.
 */
const MONEY_UNITS = new Set(toCharacters("元圆圓块塊毛角"));

/**
 * The verbs of paying and costing that put a 毛 or 角 after them: 只要五毛,
 * 花了三角, 卖八毛.
 */
const COSTING = new Set(toCharacters("要花卖賣值付收"));

/**
 * The tenth of a yuan with 钱 after it, which jieba counts as one word and
 * CC-CEDICT does not hold. After a number it is the unit and the money:
 * 五毛钱 is 五, 毛 and 钱, as 五块钱 is 五, 块 and 钱.
 */
const JIAO_MONEY = new Set(["毛钱", "毛錢", "角钱", "角錢"]);

/**
 * The 只要 that is *only costs* before a number.
 */
const ONLY_IF = new Set(["只要"]);

/**
 * Whether every character of a stretch is part of a number.
 */
function isNumber(characters: readonly string[]): boolean {
  return (
    characters.length > 0 &&
    characters.every((character) => QUANTITY_CHARACTERS.has(character))
  );
}

/**
 * Whether a tagged word of more than one character starts at a position.
 *
 * 三元色混合 has 元色 starting at its 元, and cutting 三元 would hand the 元 to
 * it. Which word the 元 belongs to is a question this rule cannot answer.
 * 毛钱 and 角钱 are not asked about, since {@link isCountedMoney} cuts them too.
 */
function opensTaggedWord(context: EdgeContext, at: number): boolean {
  return wordsStartingAt(context, at).some(
    (word) =>
      toCharacters(word).length > 1 &&
      tagOf(context, word) !== "" &&
      !JIAO_MONEY.has(word),
  );
}

/**
 * Whether the 毛 or 角 closing a stretch counts money.
 */
function isPriced(context: EdgeContext): boolean {
  const { characters, edge } = context;
  if (MONEY_AFTER.has(characters[edge.to] ?? "")) {
    return true;
  }
  const before = characters[edge.from - 1] ?? "";
  if (UNIT_BEFORE.has(before) || COSTING.has(before)) {
    return true;
  }
  return before === "了" && COSTING.has(characters[edge.from - 2] ?? "");
}

/**
 * 二 written alone before 元, which is *binary* and not two yuan.
 *
 * Money says 两元, and 二元 is 二元对立, 二元性别 and 性别是二元的. A 二 at the
 * end of a longer number is money again: 四十二元.
 */
const BINARY = "二";

/**
 * Whether an edge is a number written up against the unit of a price.
 */
function isPrice(context: EdgeContext): boolean {
  const { characters: around, edge } = context;
  const characters = toCharacters(edge.text);
  const unit = characters.at(-1) ?? "";
  const number = characters.slice(0, -1);
  if (characters.length < 2 || !isNumber(number)) {
    return false;
  }
  if (
    number.join("") === BINARY &&
    !QUANTITY_CHARACTERS.has(around[edge.from - 1] ?? "")
  ) {
    return false;
  }
  if (opensTaggedWord(context, edge.to - 1)) {
    return false;
  }
  return YUAN.has(unit) || (JIAO.has(unit) && isPriced(context));
}

/**
 * Whether an edge is 毛钱 or 角钱 straight after a number.
 */
function isCountedMoney(context: EdgeContext): boolean {
  const { characters, edge } = context;
  return (
    JIAO_MONEY.has(edge.text) &&
    QUANTITY_CHARACTERS.has(characters[edge.from - 1] ?? "")
  );
}

/**
 * How far the number starting at a position runs.
 */
function numberEnd(characters: readonly string[], from: number): number {
  let at = from;
  while (QUANTITY_CHARACTERS.has(characters[at] ?? "")) {
    at++;
  }
  return at;
}

/**
 * Whether a measure word or a unit follows the number at a position.
 *
 * The 只要 of *so long as* can open a clause with 一 in it, 只要一下雨就 and
 * 只要一有空, and the 一 there is no quantity. A number that counts something
 * has the thing's unit straight after it: 只要五元, 只要一碗, 只要两分钟.
 */
function isCounted(context: EdgeContext, from: number): boolean {
  const end = numberEnd(context.characters, from);
  if (end === from) {
    return false;
  }
  return wordsStartingAt(context, end).some((word) => {
    const tag = tagOf(context, word);
    return (
      tag.startsWith("q") ||
      tag.startsWith("m") ||
      MONEY_UNITS.has(toCharacters(word)[0] ?? "")
    );
  });
}

/**
 * Whether a 只要 stands before a number counting something.
 */
function isOnlyCosting(context: EdgeContext): boolean {
  const { edge } = context;
  return ONLY_IF.has(edge.text) && isCounted(context, edge.to);
}

/**
 * A price is cut from its unit, and 只要 before one into 只 and 要.
 *
 * Every number before 元 but a lone 二 is cut from it, which is what 十元 and
 * 六元 had already, for want of a word. A number before 毛 or 角 is cut where money is
 * around it: 钱 after it, 块 or 元 before the number, or a verb of paying or
 * costing, and 毛钱 and 角钱 after a number into the unit and 钱. 只要 is cut where the number after it counts something, which
 * leaves 只要一下雨就 alone. The readings are the same either way, so this
 * changes the segmentation and the spacing.
 */
export const PRICED_UNIT: EdgeRule = {
  name: "priced-unit",
  verdictFor: (context: EdgeContext) =>
    isPrice(context) || isCountedMoney(context) || isOnlyCosting(context)
      ? "forbid"
      : "keep",
};
