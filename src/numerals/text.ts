import { applySandhi, type SandhiOptions } from "../decode/sandhi.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  numeralHanzi,
  type NumeralOptions,
  type NumeralStyle,
  percentHanzi,
  readNumeralHanzi,
} from "./numerals.js";

/**
 * One stretch of text that was never Han, read or left as it was.
 */
export interface NumeralSegment {
  /** The characters this covers, exactly as they were written. */
  readonly text: string;
  /** How it is said, where it was read as a number. */
  readonly reading: readonly Syllable[] | undefined;
  /** The 汉字 the number would be written with, where it was read. */
  readonly hanzi: string | undefined;
  /** How it was read, which decides whether sandhi applies to it. */
  readonly style: NumeralStyle | undefined;
  /**
   * Where the words break, as a syllable count each.
   *
   * A counted number is one word and needs none of this. A time is three or
   * four — 6:30 is `liù diǎn sānshí fēn`, where the hour and the minutes are
   * numbers and 点 and 分 are not — and nothing in the syllables themselves
   * says where those breaks are.
   */
  readonly words?: readonly number[];
}

/**
 * A number as it appears in running text: digits, with the separators a writer
 * uses and an optional decimal part.
 *
 * `security/detect-unsafe-regex` flags the optional decimal after `[\d,]*`. A
 * comma run and a decimal part cannot claim the same characters, since `\.` is
 * neither a digit nor a comma, so there is nothing to backtrack over — timed
 * linear to 128k characters.
 */
// eslint-disable-next-line security/detect-unsafe-regex
const NUMBER = /\d[\d,]*(?:\.\d+)?/gu;

/**
 * The percent signs a number can carry, half-width and full-width.
 */
const PERCENT = new Set(["%", "％"]);

/**
 * Marks that make the digits beside them an identifier rather than a quantity.
 *
 * 6:30 is a time, 3202－5625 is a phone number and COVID-19 is a name; none of
 * them is counted, and the mark between the parts has no reading at all. So a
 * digit run touching one is left exactly as it was written — of 7,846 digit
 * runs measured over Tatoeba and zh.wikipedia about 55 are this shape, and
 * reading them produced `liù:sānshí` for 6:30, which is worse than leaving it.
 */
const IDENTIFIER = new Set([":", "：", "-", "－", "—", "–", "/", "／"]);

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
const TIME = /(\d{1,2})[:：](\d{2})(?!\d)/duy;

/**
 * The bounds a time is written within.
 */
const HOURS_IN_A_DAY = 24;
const MINUTES_IN_AN_HOUR = 60;

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
 * How many digits a year is written with, when it is a year and not a count.
 *
 * 1997年 is a year and is spelled out; 30年 is thirty years and is counted.
 * Four is the length that separates them, and a two-digit year — 98年 for 1998
 * — is left counted, because 20年 meaning twenty years is far commoner than
 * 20年 meaning 2020 and nothing in the text tells them apart.
 */
const YEAR_DIGITS = 4;

/**
 * Whether a number is read out digit by digit rather than counted.
 *
 * The one context where this is not a guess: a four-digit number in front of 年
 * is a year, and a year is spelled out. Everything else is counted, which is
 * what the overwhelming majority of digits in running text are — of 7,846 digit
 * runs measured over Tatoeba and zh.wikipedia, the commonest things after them
 * are 年, 月, 日, 人, 号, 点, 个 and 岁, and only the years want spelling out.
 */
function styleFor(digits: string, following: string): NumeralStyle {
  return following === "年" && digits.length === YEAR_DIGITS
    ? "digits"
    : "cardinal";
}

/**
 * Read one number, with the sign that may follow it.
 */
function readNumber(
  digits: string,
  isPercent: boolean,
  style: NumeralStyle,
  options: NumeralOptions,
): NumeralSegment | undefined {
  // A writer's thousands separators are not part of the number; nothing is
  // said for them.
  const value = digits.replaceAll(",", "");
  const settings: NumeralOptions = { ...options, style };
  const hanzi = isPercent
    ? percentHanzi(value, settings)
    : numeralHanzi(value, settings);
  const reading =
    hanzi === undefined ? undefined : readNumeralHanzi(hanzi, settings);
  if (hanzi === undefined || reading === undefined) {
    return undefined;
  }
  return { text: digits, reading, hanzi, style };
}

/**
 * A stretch that stays exactly as it was written.
 */
function unread(text: string): NumeralSegment {
  return { text, reading: undefined, hanzi: undefined, style: undefined };
}

/**
 * A time written out in 汉字: 6:30 is 六点三十分.
 *
 * The 分 is written even though a speaker often drops it, because without it
 * 六点三十 is the decimal 6.30 said aloud — the same 点 does both jobs, and the
 * 分 is the only thing that separates them. On the hour it is left off
 * instead, since 六点零零分 is not something anybody says.
 */
function timeHanzi(
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
function timeWords(hanzi: string): readonly number[] {
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
function readTime(
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

/**
 * Split a stretch of non-Han text into what is read and what is not.
 *
 * `following` is the first character of the Han that comes after this stretch,
 * which is the only context a number has: 年 makes 1997 a year and 个 makes 3 a
 * count. Where there is nothing after it, or nothing that decides, the number
 * is counted.
 *
 * Text that is not a number is returned unread rather than dropped, so the
 * segments always concatenate back to the input.
 */
export function readNumbersIn(
  text: string,
  following: string,
  options: NumeralOptions = {},
): readonly NumeralSegment[] {
  const segments: NumeralSegment[] = [];
  let at = 0;

  for (const match of text.matchAll(NUMBER)) {
    const digits = match[0];
    const from = match.index;
    // The minutes of a time the hour already took.
    if (from < at) {
      continue;
    }
    const time = readTime(text, from, options);
    if (time !== undefined) {
      if (from > at) {
        segments.push(unread(text.slice(at, from)));
      }
      segments.push(time);
      at = from + time.text.length;
      continue;
    }
    const after = text[from + digits.length] ?? "";
    if (IDENTIFIER.has(after) || IDENTIFIER.has(text[from - 1] ?? "")) {
      continue;
    }
    const isPercent = PERCENT.has(after);
    // What decides the style is whatever comes next: the sign if there is one,
    // otherwise the first character of the following Han.
    const style = styleFor(digits, isPercent ? "" : following);
    const read = readNumber(digits, isPercent, style, options);
    if (read === undefined) {
      continue;
    }
    if (from > at) {
      segments.push(unread(text.slice(at, from)));
    }
    segments.push(isPercent ? { ...read, text: digits + after } : read);
    at = from + digits.length + (isPercent ? after.length : 0);
  }

  if (at < text.length) {
    segments.push(unread(text.slice(at)));
  }
  return segments;
}

/**
 * A number as it is said, with the sandhi a counted quantity takes.
 *
 * Two things decide how much of it assimilates. A number read out digit by
 * digit does not at all — 110 is `yāo yāo líng` and never `yì yì líng` —
 * and in a counted one the sandhi stops at the 点, since everything after the
 * decimal point is read digit by digit whatever the style: 3.14 is
 * `sān diǎn yī sì`.
 *
 * `following` is the syllable after the number, which is what a 一 at the end
 * of it assimilates to: the 一 of 一个 is `yí` because 个 is a fourth tone, and
 * that tone is in the next run rather than in the number.
 */
export function saidNumeral(
  segment: NumeralSegment,
  following: Syllable | undefined,
  sandhi: SandhiOptions | undefined,
): readonly Syllable[] {
  const reading = segment.reading ?? [];
  if (segment.style === "digits") {
    return reading;
  }
  const point = toCharacters(segment.hanzi ?? "").indexOf("点");
  const quantity = point === -1 ? reading.length : point;
  const context = following === undefined ? [] : [following];
  const said = applySandhi([...reading.slice(0, quantity), ...context], sandhi);
  return [...said.slice(0, quantity), ...reading.slice(quantity)];
}
