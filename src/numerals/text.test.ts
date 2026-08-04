import {
  assertArrayEquals,
  assertIdentical,
  assertNonNullable,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { readNumbersIn, saidNumeral } from "./text.js";

/**
 * What a stretch of text is broken into: the source of each segment, with the
 * 汉字 of any that was read.
 */
function segments(text: string, following = ""): readonly string[] {
  return readNumbersIn(text, following).map((segment) =>
    segment.hanzi === undefined
      ? segment.text
      : `${segment.text}=${segment.hanzi}`,
  );
}

describe("finding numbers in text", () => {
  it("reads a number and leaves everything else as written", () => {
    assertArrayEquals(segments("3D"), ["3=三", "D"]);
    assertArrayEquals(segments("(2)"), ["(", "2=二", ")"]);
  });

  it("counts by default", () => {
    assertArrayEquals(segments("2026"), ["2026=两千零二十六"]);
  });

  it("spells out a four-digit year", () => {
    assertArrayEquals(segments("1997", "年"), ["1997=一九九七"]);
    // Three digits before 年 is a count of years, not a year.
    assertArrayEquals(segments("30", "年"), ["30=三十"]);
    // And four digits before anything else is a count.
    assertArrayEquals(segments("2000", "人"), ["2000=两千"]);
  });

  it("reverses a percentage and takes the sign with it", () => {
    assertArrayEquals(segments("95%"), ["95%=百分之九十五"]);
    assertArrayEquals(segments("20％。"), ["20％=百分之二十", "。"]);
  });

  it("drops a writer's thousands separators", () => {
    assertArrayEquals(segments("1,000"), ["1,000=一千"]);
  });

  it("leaves an identifier alone, digits and all", () => {
    // A time, a phone number and a name are not quantities, and the mark
    // between their parts has no reading.
    assertArrayEquals(segments("6:30"), ["6:30"]);
    assertArrayEquals(segments("3202-5625"), ["3202-5625"]);
    assertArrayEquals(segments("COVID-19"), ["COVID-19"]);
  });

  it("leaves a number too large to count exactly as written", () => {
    // Counting stops at 10^16; the digits are still digits, so they stay.
    const huge = "1".repeat(20);
    assertArrayEquals(segments(huge), [huge]);
    assertArrayEquals(segments(`(${huge})`), [`(${huge})`]);
  });

  it("concatenates back to what it was given", () => {
    for (const text of ["3D", "(2)", "95%", "a1b2c3", "6:30", "no digits"]) {
      assertIdentical(
        readNumbersIn(text, "")
          .map((segment) => segment.text)
          .join(""),
        text,
      );
    }
  });
});

/**
 * How a number is said, with an optional syllable after it for context.
 */
function said(text: string, following?: string): string {
  const [segment] = readNumbersIn(text, "");
  if (segment === undefined) {
    return "";
  }
  return saidNumeral(
    segment,
    following === undefined ? undefined : readSyllable(following),
    undefined,
  )
    .map((syllable) => writeSyllable(syllable))
    .join(" ");
}

describe("saying a number in context", () => {
  it("assimilates a 一 to the syllable after the number", () => {
    // 1个 is `yí gè`, and the tone it assimilates to is in the next run.
    assertIdentical(said("1", "gè"), "yí");
    assertIdentical(said("1", "nián"), "yì");
    assertIdentical(said("1"), "yī");
  });

  it("assimilates inside the number too", () => {
    assertIdentical(said("100"), "yì bǎi");
  });

  it("stops at the decimal point", () => {
    assertIdentical(said("3.14"), "sān diǎn yī sì");
  });

  it("leaves a spelled-out number alone", () => {
    // Each digit is its own citation form, so the 一 of 1997年 stays `yī`
    // however the 年 after it is toned.
    const [segment] = readNumbersIn("1997", "年");
    assertNonNullable(segment);
    assertIdentical(segment.style, "digits");
    assertIdentical(
      saidNumeral(segment, readSyllable("nián"), undefined)
        .map((syllable) => writeSyllable(syllable))
        .join(" "),
      "yī jiǔ jiǔ qī",
    );
  });
});
