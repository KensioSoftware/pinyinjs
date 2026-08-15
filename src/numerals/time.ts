/**
 * Saying a clock time out loud.
 *
 * A time is not read the way the same digits would be anywhere else: 6:30 is
 * 六点三十分 rather than the digits in order, the 分 is written even where a
 * speaker would drop it, and the hour takes 两 where a bare 2 takes 二.
 */
import {
  numeralHanzi,
  type NumeralOptions,
  readNumeralHanzi,
} from "./numerals.js";
import { HOURS_IN_A_DAY, MINUTES_IN_AN_HOUR, TIME } from "./numeral-shapes.js";
import type { NumeralSegment } from "./read-numeral.js";

/**
 * The minute below which the zero is said: 6:05 is 六点零五分.
 */
const SPOKEN_ZERO_BELOW = 10;

/**
 * The hour that is 两 rather than 二.
 *
 * Two o'clock is 两点 and never 二点, which is the same 两 that counts things —
 * an hour is a quantity of hours. It is the only hour this applies to, since
 * 12:00 is 十二点 with the 二 inside a larger number.
 */
const LIANG_HOUR = 2;

/**
 * A time written out in 汉字: 6:30 is 六点三十分.
 *
 * The 分 is written even though a speaker often drops it, because without it
 * 六点三十 is the decimal 6.30 said aloud — the same 点 does both jobs, and the
 * 分 is the only thing that separates them. On the hour it is left off
 * instead, since 六点零零分 is not something anybody says.
 */
export function timeHanzi(
  hours: number,
  minutes: number,
  options: NumeralOptions,
): string | undefined {
  const counted: NumeralOptions = { ...options, style: "cardinal" };
  const hour = hours === LIANG_HOUR ? "两" : numeralHanzi(hours, counted);
  const minute = minutes === 0 ? "" : numeralHanzi(minutes, counted);
  /* c8 ignore next 3 -- an hour is 0 to 23 and a minute 0 to 59, and the
     cardinal reader counts every one of them */
  if (hour === undefined || minute === undefined) {
    return undefined;
  }
  if (minute === "") {
    return `${hour}点`;
  }
  const zero = minutes < SPOKEN_ZERO_BELOW ? "零" : "";
  return `${hour}点${zero}${minute}分`;
}

/**
 * Where a written-out time breaks into words.
 *
 * The hour, the 点, the minutes and the 分, which is how the same time reads
 * when it is written 6点30分 in the first place.
 */
export function timeWords(hanzi: string): readonly number[] {
  const [hour = "", rest = ""] = hanzi.split("点");
  const minutes = rest.replace("分", "");
  return minutes === ""
    ? [hour.length, 1]
    : [hour.length, 1, minutes.length, 1];
}

/**
 * Read a digit run as a time, where that is what it is.
 *
 * Tried before the identifier rule, which would otherwise leave the whole
 * thing alone: a colon between digits is exactly the mark that makes 6:30 a
 * time rather than two numbers.
 */
export function readTime(
  text: string,
  from: number,
  options: NumeralOptions,
): NumeralSegment | undefined {
  TIME.lastIndex = from;
  const found = TIME.exec(text);
  const written = found?.[1];
  const minutes = found?.[2];
  if (found === null || written === undefined || minutes === undefined) {
    return undefined;
  }
  const hourValue = Number(written);
  const minuteValue = Number(minutes);
  if (hourValue >= HOURS_IN_A_DAY || minuteValue >= MINUTES_IN_AN_HOUR) {
    return undefined;
  }
  const hanzi = timeHanzi(hourValue, minuteValue, options);
  const reading =
    hanzi === undefined ? undefined : readNumeralHanzi(hanzi, options);
  /* c8 ignore next 3 -- the hanzi is built out of the same table that reads it
     back, so it reads whenever it was built at all */
  if (hanzi === undefined || reading === undefined) {
    return undefined;
  }
  return {
    text: found[0],
    reading,
    hanzi,
    style: "cardinal",
    words: timeWords(hanzi),
  };
}
