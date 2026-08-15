/**
 * Reading one run of digits into 汉字.
 *
 * A segment at a time: what the digits say, in what style, and whether the
 * run before it changes either. `text.ts` walks the text and calls these.
 */
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  numeralHanzi,
  type NumeralOptions,
  type NumeralStyle,
  percentHanzi,
  readNumeralHanzi,
} from "./numerals.js";

import {
  LABELLED,
  ORDINAL,
  SMALL_UNITS,
  YEAR_DIGITS,
} from "./numeral-shapes.js";

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
   * A counted whole number is one word and needs none of this. A time is three
   * or four — 6:30 is `liù diǎn sānshí fēn`, where the hour and the minutes are
   * numbers and 点 and 分 are not — and a decimal is a counted part and then a
   * digit at a time: 75.5 is `qīshíwǔ diǎn wǔ`. Nothing in the syllables
   * themselves says where those breaks are.
   */
  readonly words?: readonly number[];
}

/**
 * Whether a number is read out digit by digit rather than counted.
 *
 * The one context where this is not a guess: a four-digit number in front of 年
 * is a year, and a year is spelled out. Everything else is counted, which is
 * what the overwhelming majority of digits in running text are — of 7,846 digit
 * runs measured over Tatoeba and zh.wikipedia, the commonest things after them
 * are 年, 月, 日, 人, 号, 点, 个 and 岁, and only the years want spelling out.
 */
export function styleFor(digits: string, following: string): NumeralStyle {
  return following === "年" && digits.length === YEAR_DIGITS
    ? "digits"
    : "cardinal";
}

/**
 * The Han either side of a stretch that was never Han.
 *
 * All the context a number in running text has. 年 makes 1998 a year, 个 makes
 * 2 a count and 第 makes it an ordinal; nothing else about the text bears on
 * how the digits are said.
 */
export interface NumeralContext {
  /** The first character of the Han that follows, or the empty string. */
  readonly following: string;
  /** The last character of the Han before it, or the empty string. */
  readonly preceding: string;
}

/**
 * Whether a number is standing in front of something it counts.
 *
 * Only ever true of a number the following Han actually touches: in 2、3个 the
 * 个 counts the 3 and there is a 、 between it and the 2, and in 2%的 the sign
 * is what the digits belong to. `before` and `after` are the characters the
 * digit run sits between, and a digit run with anything but Han after it is not
 * in front of a 量词 at all.
 */
export function isInFrontOfCount(
  before: string,
  after: string,
  following: string,
): boolean {
  return (
    after === "" &&
    following !== "" &&
    !LABELLED.has(following) &&
    !SMALL_UNITS.has(following) &&
    before !== ORDINAL
  );
}

/**
 * Where a decimal breaks into words, or undefined where it is not one.
 *
 * The counted part keeps its grouping — 75.5 is `qīshíwǔ diǎn wǔ`, one word for
 * the quantity, which is the same word 75 on its own is — and everything from
 * the 点 onwards is read digit by digit, so the point and each digit after it
 * stand alone: 3.14 is `sān diǎn yī sì`.
 */
export function decimalWords(hanzi: string): readonly number[] | undefined {
  const characters = toCharacters(hanzi);
  const point = characters.indexOf("点");
  if (point === -1) {
    return undefined;
  }
  return [point, ...characters.slice(point).map(() => 1)];
}

/**
 * Read one number, with the sign that may follow it.
 */
export function readNumber(
  digits: string,
  isPercent: boolean,
  style: NumeralStyle,
  isCounting: boolean,
  options: NumeralOptions,
): NumeralSegment | undefined {
  // A writer's thousands separators are not part of the number; nothing is
  // said for them.
  const value = digits.replaceAll(",", "");
  const settings: NumeralOptions = { ...options, style, counts: isCounting };
  const hanzi = isPercent
    ? percentHanzi(value, settings)
    : numeralHanzi(value, settings);
  const reading =
    hanzi === undefined ? undefined : readNumeralHanzi(hanzi, settings);
  if (hanzi === undefined || reading === undefined) {
    return undefined;
  }
  // Digits read out one at a time are not a word at all, so there is nothing
  // for a point in them to break up.
  const words = style === "digits" ? undefined : decimalWords(hanzi);
  return {
    text: digits,
    reading,
    hanzi,
    style,
    ...(words !== undefined && { words }),
  };
}

/**
 * A stretch that stays exactly as it was written.
 */
export function unread(text: string): NumeralSegment {
  return { text, reading: undefined, hanzi: undefined, style: undefined };
}
