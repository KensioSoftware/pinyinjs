import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  cardinalHanzi,
  type CardinalOptions,
  LARGEST_CARDINAL,
} from "./cardinal.js";
import {
  DIGIT_CHARACTERS,
  numeralSyllable,
  yaoSyllable,
} from "./characters.js";

/**
 * How a number is said: as a quantity, or digit by digit.
 *
 * The distinction is the whole of this module's difficulty, because the *same*
 * digits go both ways depending on what they are counting. 2026年 is
 * `èr líng èr liù nián`, read out one digit at a time, and 2026个 is
 * `liǎng qiān líng èr shí liù gè`, counted. Nothing about the number says
 * which; only what follows it does, so the choice belongs to the caller and
 * this module will do either.
 */
export type NumeralStyle = "cardinal" | "digits";

/**
 * How a number should be written and read.
 */
export interface NumeralOptions extends CardinalOptions {
  /** Defaults to `cardinal`. */
  readonly style?: NumeralStyle;
  /**
   * Whether 1 is read `yāo` when the digits are read out one at a time.
   *
   * Off by default and meaningless outside `digits`. 110 is `yāo yāo líng` and
   * a room number is said the same way, because `yī` and `qī` are hard to tell
   * apart down a bad line — but 2019 is `èr líng yī jiǔ` with an ordinary `yī`,
   * so this is a property of what is being said rather than of the digits.
   */
  readonly yao?: boolean;
  /**
   * Which zero the digit style writes. Defaults to 〇, as dates and years do.
   */
  readonly zero?: "零" | "〇";
}

/**
 * What a number is made of, once its sign and its point are taken off.
 */
interface Parsed {
  readonly isNegative: boolean;
  /** The digits before the point, as written. */
  readonly whole: string;
  /** The digits after it, as written, or the empty string. */
  readonly fraction: string;
}

/**
 * Anything this module will read: digits, optionally signed and pointed.
 */
const NUMBER = /^(?<sign>-?)(?<whole>\d+)(?:\.(?<fraction>\d+))?$/u;

/**
 * Take a number apart, keeping the digits exactly as they were written.
 *
 * A string rather than a number is the input that carries the most: `007` and
 * `7` are the same quantity and different digits, and a room number keeps its
 * zeros. A `number` is stringified first, which is why a caller who cares about
 * leading zeros should pass the string.
 */
function parse(value: string | number): Parsed | undefined {
  const found = NUMBER.exec(String(value))?.groups;
  if (found === undefined) {
    return undefined;
  }
  return {
    isNegative: found["sign"] === "-",
    whole: found["whole"] ?? "",
    fraction: found["fraction"] ?? "",
  };
}

/**
 * Write digits one at a time: 2019 → 二〇一九.
 */
function digitsHanzi(digits: string, zero: string): string {
  return toCharacters(digits)
    .map((digit) =>
      digit === "0" ? zero : (DIGIT_CHARACTERS[Number(digit)] ?? digit),
    )
    .join("");
}

/**
 * Write a number in 汉字: 12345 → 一万二千三百四十五, or 一二三四五.
 *
 * Undefined for anything that is not a number, and for a `cardinal` whose whole
 * part is too large to write — a digit string is not limited that way, since
 * reading digits out needs no arithmetic at all.
 *
 * The fractional part is always read digit by digit whatever the style, because
 * that is how it is said: 3.14 is 三点一四 and never 三点十四.
 */
export function numeralHanzi(
  value: string | number,
  options: NumeralOptions = {},
): string | undefined {
  const parsed = parse(value);
  if (parsed === undefined) {
    return undefined;
  }
  const { style = "cardinal", zero = "〇" } = options;

  let whole: string;
  if (style === "digits") {
    whole = digitsHanzi(parsed.whole, zero);
  } else {
    const quantity = Number(parsed.whole);
    if (!Number.isSafeInteger(quantity) || quantity > LARGEST_CARDINAL) {
      return undefined;
    }
    whole = cardinalHanzi(quantity, options);
  }

  const point =
    parsed.fraction === "" ? "" : `点${digitsHanzi(parsed.fraction, "零")}`;
  return `${parsed.isNegative ? "负" : ""}${whole}${point}`;
}

/**
 * Read written numeral 汉字 as syllables.
 *
 * Undefined where the text holds anything that is not a numeral character, so a
 * caller can tell "not a number" from a number that reads oddly.
 */
export function readNumeralHanzi(
  hanzi: string,
  options: NumeralOptions = {},
): readonly Syllable[] | undefined {
  const isYao = options.yao ?? false;
  const syllables: Syllable[] = [];

  for (const character of toCharacters(hanzi)) {
    const syllable =
      isYao && character === "一" ? yaoSyllable() : numeralSyllable(character);
    if (syllable === undefined) {
      return undefined;
    }
    syllables.push(syllable);
  }
  return syllables;
}

/**
 * Read a number as syllables: 2019 as `èr líng yī jiǔ`, or as a quantity.
 *
 * The readings are *underlying*, as the dictionary's are — 一 is `yī` however
 * it will be said in context — so a caller assembling a longer utterance runs
 * the sandhi pass over the result and gets `yìbǎi` and `yí gè` from it. That is
 * the same contract `decodeRun` has, and it is what keeps a number from having
 * to know what follows it.
 */
export function readNumeral(
  value: string | number,
  options: NumeralOptions = {},
): readonly Syllable[] | undefined {
  const hanzi = numeralHanzi(value, options);
  return hanzi === undefined ? undefined : readNumeralHanzi(hanzi, options);
}

/**
 * Write a percentage the way it is said: 95% → 百分之九十五.
 *
 * The order reverses — "of a hundred parts, ninety-five" — which is why this
 * cannot be left to whoever writes the number and the sign separately.
 */
export function percentHanzi(
  value: string | number,
  options: NumeralOptions = {},
): string | undefined {
  const written = numeralHanzi(value, options);
  return written === undefined ? undefined : `百分之${written}`;
}

/**
 * Write a fraction the way it is said: 3/4 → 四分之三.
 *
 * Same reversal as a percentage, of which this is the general case: the
 * denominator is named first and the numerator second.
 */
export function fractionHanzi(
  numerator: string | number,
  denominator: string | number,
  options: NumeralOptions = {},
): string | undefined {
  const top = numeralHanzi(numerator, options);
  const bottom = numeralHanzi(denominator, options);
  return top === undefined || bottom === undefined
    ? undefined
    : `${bottom}分之${top}`;
}
