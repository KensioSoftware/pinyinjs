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
}

/**
 * A number as it appears in running text: digits, with the separators a writer
 * uses and an optional decimal part.
 */
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
