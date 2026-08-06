import { DIGIT_CHARACTERS } from "./characters.js";

/**
 * How a cardinal is written where the language offers a choice.
 */
export interface CardinalOptions {
  /**
   * Where a lone 2 multiplying 千, 万 or 亿 is written 两 rather than 二.
   *
   * Genuinely variable, so it is a choice rather than a rule. 现代汉语词典 has
   * 二 before 百 and either before 千/万/亿, and then adds that the 二 of
   * 三万二千 and 两亿二千万 *cannot* be 两 — so the prescription is `leading`,
   * and what people say is `always`.
   *
   * - `always` (default) — 2,000 是两千, 12,000 是一万两千, 22,000 是两万两千.
   * - `leading` — 两 only where the 2 opens the number, so 12,000 是一万二千.
   * - `never` — 二 throughout, the register a written figure often takes.
   *
   * None of them touches a 2 that is not a multiplier of a big unit: 12 is
   * 十二, 20 is 二十, 200 is 二百, and 120,000 is 十二万, where the 二 is the
   * units digit of 12. A lone 2 in front of what it counts is {@link counts}
   * rather than this.
   */
  readonly liang?: "always" | "leading" | "never";
  /**
   * Whether the number stands immediately in front of something it counts.
   *
   * Only a lone 2 changes, and it is not a variable choice the way
   * {@link liang} is: 两个西瓜 and 两个人 are what the language has, and 二个 is
   * simply wrong. Nothing about the number says whether it is counting, so the
   * caller says, which is the same division of labour the numeral style has.
   *
   * Off by default, because a number with nothing after it is not counting
   * anything: 2 on its own is 二, and so is the 2 of 第2次, which names rather
   * than counts. `liang: "never"` still overrides it.
   */
  readonly counts?: boolean;
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
  readonly liang: NonNullable<CardinalOptions["liang"]>;
}

/**
 * Whether a lone 2 opening this group takes 两.
 */
function isLiang(
  liang: NonNullable<CardinalOptions["liang"]>,
  isLeading: boolean,
): boolean {
  return liang === "always" || (liang === "leading" && isLeading);
}

/**
 * The character a digit takes in a place: 两 before a 千, 二 otherwise.
 */
function digitAt(
  value: number,
  place: string,
  isFirst: boolean,
  options: GroupOptions,
): string {
  return value === 2 &&
    place === "千" &&
    isLiang(options.liang, options.isLeading && isFirst)
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
      : digitAt(value, place, written === "", options) + place;
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
  const { liang = "always", counts = false } = options;
  // A lone 2 counting something is 两 and nothing else: 两个西瓜. It is the
  // only value this touches, since the 二 of 十二个 or 一万零二个 is a digit
  // inside a larger number rather than the number standing in front of the
  // 量词.
  if (value === 2 && counts && isLiang(liang, true)) {
    return "两";
  }

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
    const isLeading = at === groups.length - 1;
    const lone =
      body === "二" && unit !== "" && isLiang(liang, isLeading) ? "两" : body;
    written = lone + unit + gap + written;
  }

  return written;
}
