import {
  assertArrayEquals,
  assertIdentical,
  assertNonNullable,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { readNumbersIn, saidNumeral } from "./text.js";

/**
 * What a stretch of text is broken into: the source of each segment, with the
 * 汉字 of any that was read.
 */
function segments(
  text: string,
  following = "",
  preceding = "",
): readonly string[] {
  return readNumbersIn(text, { following, preceding }).map((segment) =>
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
    assertArrayEquals(segments("1998", "年"), ["1998=一九九八"]);
    // Three digits before 年 is a count of years, not a year.
    assertArrayEquals(segments("30", "年"), ["30=三十"]);
    // And four digits before anything else is a count.
    assertArrayEquals(segments("2000", "人"), ["2000=两千"]);
  });

  it("writes 两 for a lone 2 in front of what it counts", () => {
    assertArrayEquals(segments("2", "个"), ["2=两"]);
    assertArrayEquals(segments("2", "人"), ["2=两"]);
    assertArrayEquals(segments("2", "岁"), ["2=两"]);
    assertArrayEquals(segments("2", "点"), ["2=两"]);
    // 千, 万 and 亿 are the same 两 the number takes on its own, so a unit
    // written as 汉字 reads as one written in digits: 2万 是两万, 20,000 too.
    assertArrayEquals(segments("2", "万"), ["2=两"]);
    assertArrayEquals(segments("20000"), ["20000=两万"]);
  });

  it("keeps 二 where the 2 names rather than counts", () => {
    // A bare number counts nothing, whatever it is beside.
    assertArrayEquals(segments("2"), ["2=二"]);
    // 2月 is February and 2号 is the second of the month.
    assertArrayEquals(segments("2", "月"), ["2=二"]);
    assertArrayEquals(segments("2", "日"), ["2=二"]);
    assertArrayEquals(segments("2", "号"), ["2=二"]);
    // 第2次 is an ordinal, however ordinary the 次 after it.
    assertArrayEquals(segments("2", "次", "第"), ["2=二"]);
    // And 200 是二百 written either way.
    assertArrayEquals(segments("2", "百"), ["2=二"]);
    assertArrayEquals(segments("200", "个"), ["200=二百"]);
  });

  it("counts only where the number touches what it counts", () => {
    // The 个 counts the 3; there is a 、 between it and the 2.
    assertArrayEquals(segments("2、3", "个"), ["2=二", "、", "3=三"]);
    // The sign is what these digits belong to.
    assertArrayEquals(segments("2%", "的"), ["2%=百分之二"]);
    // And the 2 of a larger number is a digit inside it.
    assertArrayEquals(segments("12", "个"), ["12=十二"]);
    assertArrayEquals(segments("22", "个"), ["22=二十二"]);
    assertArrayEquals(segments("10002", "个"), ["10002=一万零二"]);
    // A whole part with a point after it is not counting on its own.
    assertArrayEquals(segments("2.5", "个"), ["2.5=二点五"]);
  });

  it("leaves the 两 of a count to the liang setting", () => {
    assertArrayEquals(
      readNumbersIn("2", { following: "个", preceding: "" }, { liang: "never" })
        .map((segment) => segment.hanzi)
        .filter((hanzi) => hanzi !== undefined),
      ["二"],
    );
  });

  it("reverses a percentage and takes the sign with it", () => {
    assertArrayEquals(segments("95%"), ["95%=百分之九十五"]);
    assertArrayEquals(segments("20％。"), ["20％=百分之二十", "。"]);
  });

  it("drops a writer's thousands separators", () => {
    assertArrayEquals(segments("1,000"), ["1,000=一千"]);
  });

  it("leaves an identifier alone, digits and all", () => {
    // A phone number and a name are not quantities, and the mark between
    // their parts has no reading.
    assertArrayEquals(segments("3202-5625"), ["3202-5625"]);
    assertArrayEquals(segments("COVID-19"), ["COVID-19"]);
    // A ratio is not a quantity either, and one digit after the colon is what
    // tells it from a time.
    assertArrayEquals(segments("16:9"), ["16:9"]);
    assertArrayEquals(segments("2:1"), ["2:1"]);
  });

  it("reads a time, which is the one colon that says something", () => {
    assertArrayEquals(segments("6:30"), ["6:30=六点三十分"]);
    assertArrayEquals(segments("2:30"), ["2:30=两点三十分"]);
    assertArrayEquals(segments("07:00"), ["07:00=七点"]);
    assertArrayEquals(segments("6:05"), ["6:05=六点零五分"]);
    assertArrayEquals(segments("2：30"), ["2：30=两点三十分"]);
    // With something in front of it to keep, since the segments have to
    // concatenate back to what was given.
    assertArrayEquals(segments("(6:30)"), ["(", "6:30=六点三十分", ")"]);
    // Not a time at all once the clock runs out.
    assertArrayEquals(segments("25:30"), ["25:30"]);
    assertArrayEquals(segments("6:75"), ["6:75"]);
  });

  it("breaks a decimal at the point and nowhere else", () => {
    // The counted part is the same word it is without the point — 75 is
    // `qīshíwǔ` either way — and everything from the 点 on is read a digit at a
    // time, so 75.5 is `qīshíwǔ diǎn wǔ` rather than four loose syllables.
    const [decimal] = readNumbersIn("75.5", { following: "", preceding: "" });
    assertNonNullable(decimal);
    assertIdentical(decimal.hanzi, "七十五点五");
    assertArrayEquals(decimal.words ?? [], [3, 1, 1]);
    // A whole number is one word and has no breaks to report.
    const [whole] = readNumbersIn("75", { following: "", preceding: "" });
    assertNonNullable(whole);
    assertUndefined(whole.words);
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
        readNumbersIn(text, { following: "", preceding: "" })
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
  const [segment] = readNumbersIn(text, { following: "", preceding: "" });
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
    // Each digit is its own citation form, so the 一 of 1998年 stays `yī`
    // however the 年 after it is toned.
    const [segment] = readNumbersIn("1998", { following: "年", preceding: "" });
    assertNonNullable(segment);
    assertIdentical(segment.style, "digits");
    assertIdentical(
      saidNumeral(segment, readSyllable("nián"), undefined)
        .map((syllable) => writeSyllable(syllable))
        .join(" "),
      "yī jiǔ jiǔ bā",
    );
  });
});
