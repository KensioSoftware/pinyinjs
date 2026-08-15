/**
 * Taking a number apart into the pieces 汉字 are written from.
 *
 * A sign, a whole part and a fraction, plus the digit-at-a-time reading a
 * fraction and a spelled-out number both use.
 */
import { toCharacters } from "../script/characters.js";
import { DIGIT_CHARACTERS } from "./characters.js";

/**
 * What a number is made of, once its sign and its point are taken off.
 */
export interface Parsed {
  readonly isNegative: boolean;
  /** The digits before the point, as written. */
  readonly whole: string;
  /** The digits after it, as written, or the empty string. */
  readonly fraction: string;
}

/**
 * Anything this module will read: digits, optionally signed and pointed.
 *
 * `security/detect-unsafe-regex` flags the optional group after `\d+`, and the
 * literal `.` in front of it means no input can be split between the two. Timed
 * on a signed decimal that cannot match, it is linear to 128k characters.
 */
export const NUMBER = /^(?<sign>-?)(?<whole>\d+)(?:\.(?<fraction>\d+))?$/u;

/**
 * Take a number apart, keeping the digits exactly as they were written.
 *
 * A string rather than a number is the input that carries the most: `007` and
 * `7` are the same quantity and different digits, and a room number keeps its
 * zeros. A `number` is stringified first, which is why a caller who cares about
 * leading zeros should pass the string.
 */
export function parse(value: string | number): Parsed | undefined {
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
export function digitsHanzi(digits: string, zero: string): string {
  return toCharacters(digits)
    .map((digit) =>
      digit === "0" ? zero : (DIGIT_CHARACTERS[Number(digit)] ?? digit),
    )
    .join("");
}
