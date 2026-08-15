/**
 * The shapes a number takes in running text.
 *
 * What counts as a number, what follows one and changes how it is said, and
 * the bounds a time is written within. `text.ts` walks a text against them.
 */
/**
 * A number as it appears in running text: digits, with the separators a writer
 * uses and an optional decimal part.
 *
 * `security/detect-unsafe-regex` flags the optional decimal after `[\d,]*`. A
 * comma run and a decimal part cannot claim the same characters, since `\.` is
 * neither a digit nor a comma, so there is nothing to backtrack over — timed
 * linear to 128k characters.
 */
export const NUMBER = /\d[\d,]*(?:\.\d+)?/gu;

/**
 * The percent signs a number can carry, half-width and full-width.
 */
export const PERCENT = new Set(["%", "％"]);

/**
 * Marks that make the digits beside them an identifier rather than a quantity.
 *
 * 6:30 is a time, 3202－5625 is a phone number and COVID-19 is a name; none of
 * them is counted, and the mark between the parts has no reading at all. So a
 * digit run touching one is left exactly as it was written — of 7,846 digit
 * runs measured over Tatoeba and zh.wikipedia about 55 are this shape, and
 * reading them produced `liù:sānshí` for 6:30, which is worse than leaving it.
 */
export const IDENTIFIER = new Set([":", "：", "-", "－", "—", "–", "/", "／"]);

/**
 * A time as a writer punctuates it: 6:30, 07:05, 2：30.
 *
 * Sticky, because it is tried at the start of a digit run the number scanner
 * has already found rather than searched for on its own.
 *
 * Two digits after the colon and no more, which is what separates a time from
 * a ratio: 16:9 and 2:1 are proportions and scores and are read `shíliù bǐ
 * jiǔ`, which this does not attempt. Measured over Tatoeba and zh.wikipedia,
 * the shape catches 104 runs and every one of them is a time — none has an
 * hour above 23 or a minute above 59, and the four colon runs that are not
 * times all have a single digit after the colon.
 */
export const TIME = /(\d{1,2})[:：](\d{2})(?!\d)/duy;

/**
 * The bounds a time is written within.
 */
export const HOURS_IN_A_DAY = 24;
export const MINUTES_IN_AN_HOUR = 60;

/**
 * The characters a lone 2 in front of them labels rather than counts.
 *
 * A 2 standing immediately in front of what it counts is 两 — 两个, 两人, 两岁,
 * 两次, 两天 — and the measure words it can count with are an open list, so 两
 * is the default and this is the exception. What is left is the positions a
 * digit *names*: 2月 is February, 2日 and 2号 are the second of the month, 2楼
 * is the second floor, 2路 is the number 2 bus, 2班 is the second class and 2期
 * is the second phase. A named position is 二.
 *
 * The traditional forms are listed beside the simplified ones, since the text
 * being converted may be in either script.
 */
export const LABELLED = new Set([
  "月",
  "日",
  "号",
  "號",
  "楼",
  "樓",
  "路",
  "班",
  "期",
]);

/**
 * The units a lone 2 in front of them keeps 二 for, as the number itself does.
 *
 * 20 是二十 and 200 是二百, so 2十 and 2百 are written the same way: whether the
 * unit is a digit or a character does not change how the number is said. 千, 万
 * and 亿 are left to `CardinalOptions.liang` for exactly the same reason, which
 * is why 2万 is 两万 as 20,000 already is.
 */
export const SMALL_UNITS = new Set(["十", "百"]);

/**
 * The mark that makes the number after it an ordinal: 第2次 is 第二次.
 *
 * An ordinal names a position however ordinary the measure word after it is,
 * so it takes 二 where the same 2次 on its own would be 两次.
 */
export const ORDINAL = "第";

/**
 * How many digits a year is written with, when it is a year and not a count.
 *
 * 1998年 is a year and is spelled out; 30年 is thirty years and is counted.
 * Four is the length that separates them, and a two-digit year — 98年 for 1998
 * — is left counted, because 20年 meaning twenty years is far commoner than
 * 20年 meaning 2020 and nothing in the text tells them apart.
 */
export const YEAR_DIGITS = 4;
