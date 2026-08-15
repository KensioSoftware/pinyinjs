import { applySandhi, type SandhiOptions } from "../decode/sandhi.js";
import { readTime } from "./time.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import type { NumeralOptions } from "./numerals.js";
import { IDENTIFIER, NUMBER, PERCENT } from "./numeral-shapes.js";
import {
  isInFrontOfCount,
  type NumeralContext,
  type NumeralSegment,
  readNumber,
  styleFor,
  unread,
} from "./read-numeral.js";

export type { NumeralContext, NumeralSegment } from "./read-numeral.js";
/**
 * Split a stretch of non-Han text into what is read and what is not.
 *
 * `context` is the Han either side of this stretch, which is all a number has
 * to go on: 年 makes 1998 a year, 个 makes 3 a count and 个 also makes 2 两.
 * Where there is nothing around it, or nothing that decides, the number is
 * counted.
 *
 * Text that is not a number is returned unread rather than dropped, so the
 * segments always concatenate back to the input.
 */
export function readNumbersIn(
  text: string,
  context: NumeralContext,
  options: NumeralOptions = {},
): readonly NumeralSegment[] {
  const { following, preceding } = context;
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
    const before = from === 0 ? preceding : (text[from - 1] ?? "");
    const isCounting = isInFrontOfCount(before, after, following);
    const read = readNumber(digits, isPercent, style, isCounting, options);
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
