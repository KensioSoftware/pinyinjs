import { DIGIT_CHARACTERS } from "./characters.js";

/**
 * How a cardinal is written where the language offers a choice.
 */
export interface CardinalOptions {
  /**
   * Whether a leading lone 2 in front of 千, 万 or 亿 is written 两.
   *
   * Defaults to true, which is the ordinary spoken form: 2,000 is 两千 and
   * 20,000 is 两万. 二 stands everywhere else — 12 is 十二 and 20 is 二十, never
   * 两十 — and inside a longer number the 千 keeps its 二, so 12,000 is 一万二千
   * rather than 一万两千. 200 takes either and this writes 二百, which is the
   * form 现代汉语词典 gives first.
   */
  readonly liang?: boolean;
}

/**
 * The places inside one group of four digits, largest first.
 */
const PLACES: readonly string[] = ["千", "百", "十", ""];

/**
 * The group separators, in the order the groups come off the number.
 */
const GROUPS: readonly string[] = ["", "万", "亿", "万亿"];

/**
 * How many digits one group holds.
 *
 * Chinese numbers are grouped by 万 rather than by thousands, which is why a
 * group is four digits wide and why 12,345 is *one* 万 and 2,345.
 */
const GROUP_DIGITS = 4;

/**
 * The largest number this can write, being four groups of four digits.
 */
export const LARGEST_CARDINAL = 10 ** 16 - 1;

/**
 * How a group of four digits is written.
 */
interface GroupOptions {
  /** Whether this is the highest group, where a leading 十 drops its 一. */
  readonly isLeading: boolean;
  readonly liang: boolean;
}

/**
 * The character a digit takes in a place, which is 两 only at the front.
 */
function digitAt(
  value: number,
  place: string,
  isFirst: boolean,
  options: GroupOptions,
): string {
  return value === 2 && place === "千" && isFirst && options.liang
    ? "两"
    : (DIGIT_CHARACTERS[value] ?? "");
}

/**
 * Write one group of at most four digits: 2345 as 二千三百四十五.
 *
 * Empty for a group that is all zeros. A run of zeros inside the group becomes
 * one 零, and only where a non-zero digit follows it: 1,005 is 一千零五 while
 * 1,500 is 一千五百.
 */
function writeGroup(group: number, options: GroupOptions): string {
  const digits = String(group).padStart(GROUP_DIGITS, "0").split("");
  let written = "";
  let isPending = false;

  for (const [at, digit] of digits.entries()) {
    const value = Number(digit);
    if (value === 0) {
      isPending = written !== "";
      continue;
    }
    const place = PLACES[at] ?? "";
    if (isPending) {
      written += "零";
      isPending = false;
    }
    // 十五 rather than 一十五: the 一 drops only from a bare leading 十, so
    // 一百一十五 keeps it and so does the 一十五 inside 一万零一十五.
    const isBareTen =
      value === 1 && place === "十" && written === "" && options.isLeading;
    written += isBareTen
      ? place
      : digitAt(value, place, written === "" && options.isLeading, options) +
        place;
  }

  return written;
}

/**
 * Write a non-negative integer as a cardinal: 12345 → 一万二千三百四十五.
 *
 * The awkward parts are 零 and the bare 十, and both are about saying the
 * number aloud rather than about arithmetic. A 零 goes where a place is skipped
 * inside* the spoken number (一千零五) and not where the number simply ends
 * (一千五百), which is the same question one level up between groups: 25,000 is
 * 两万五千 because the lower group fills its 千, and 20,050 is 两万零五十
 * because it does not.
 * @throws {RangeError} for a negative, a fraction, or anything above 10^16.
 */
export function cardinalHanzi(
  value: number,
  options: CardinalOptions = {},
): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > LARGEST_CARDINAL) {
    throw new RangeError(`not a writable whole number: ${String(value)}`);
  }
  if (value === 0) {
    return "零";
  }
  const { liang = true } = options;

  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 10_000)) {
    groups.push(rest % 10_000);
  }

  let written = "";
  for (const [at, group] of groups.entries()) {
    if (group === 0) {
      continue;
    }
    const unit = GROUPS[at] ?? "";
    const body = writeGroup(group, {
      isLeading: at === groups.length - 1,
      liang,
    });
    // The group immediately below decides whether a 零 is spoken between them:
    // it is needed unless that group fills its own 千 place.
    const below = groups[at - 1] ?? 0;
    const gap = written !== "" && below < 1000 ? "零" : "";
    const lone = body === "二" && liang && unit !== "" ? "两" : body;
    written = lone + unit + gap + written;
  }

  return written;
}
