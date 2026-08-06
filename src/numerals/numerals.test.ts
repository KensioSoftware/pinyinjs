import {
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { cardinalHanzi } from "./cardinal.js";
import {
  fractionHanzi,
  numeralHanzi,
  readNumeralHanzi,
  type NumeralOptions,
  percentHanzi,
  readNumeral,
} from "./numerals.js";

/**
 * A number read out, in tone-marked pinyin.
 */
function read(value: string | number, options: NumeralOptions = {}): string {
  return (
    readNumeral(value, options)
      ?.map((syllable) => writeSyllable(syllable))
      .join(" ") ?? ""
  );
}

/**
 * Written numeral 汉字 read out, in tone-marked pinyin.
 */
function readOut(hanzi: string): string {
  return (
    readNumeralHanzi(hanzi)
      ?.map((syllable) => writeSyllable(syllable))
      .join(" ") ?? ""
  );
}

describe("cardinals", () => {
  it("writes the places inside a group", () => {
    assertIdentical(cardinalHanzi(0), "零");
    assertIdentical(cardinalHanzi(9), "九");
    assertIdentical(cardinalHanzi(20), "二十");
    assertIdentical(cardinalHanzi(345), "三百四十五");
  });

  it("drops the 一 from a leading 十 and nowhere else", () => {
    assertIdentical(cardinalHanzi(10), "十");
    assertIdentical(cardinalHanzi(15), "十五");
    assertIdentical(cardinalHanzi(115), "一百一十五");
    // Inside a lower group the 一十 stands: 10,015 is 一万零一十五.
    assertIdentical(cardinalHanzi(10_015), "一万零一十五");
  });

  it("writes 零 for a skipped place and not for a trailing one", () => {
    assertIdentical(cardinalHanzi(101), "一百零一");
    assertIdentical(cardinalHanzi(1005), "一千零五");
    assertIdentical(cardinalHanzi(1500), "一千五百");
    assertIdentical(cardinalHanzi(110), "一百一十");
  });

  it("groups by 万 rather than by thousands", () => {
    assertIdentical(cardinalHanzi(12_345), "一万两千三百四十五");
    assertIdentical(cardinalHanzi(1_234_567), "一百二十三万四千五百六十七");
    assertIdentical(
      cardinalHanzi(12_345, { liang: "leading" }),
      "一万二千三百四十五",
    );
    assertIdentical(cardinalHanzi(100_000_000), "一亿");
  });

  it("writes 零 between groups only where the lower one leaves a gap", () => {
    assertIdentical(cardinalHanzi(25_000), "两万五千");
    assertIdentical(cardinalHanzi(20_050), "两万零五十");
    assertIdentical(cardinalHanzi(100_000_005), "一亿零五");
  });

  it("writes a lone 2 as 两 in front of a big unit, wherever it falls", () => {
    assertIdentical(cardinalHanzi(2000), "两千");
    assertIdentical(cardinalHanzi(20_000), "两万");
    assertIdentical(cardinalHanzi(12_000), "一万两千");
    assertIdentical(cardinalHanzi(22_000), "两万两千");
  });

  it("keeps 二 where the 2 is not a multiplier of a big unit", () => {
    assertIdentical(cardinalHanzi(12), "十二");
    assertIdentical(cardinalHanzi(20), "二十");
    assertIdentical(cardinalHanzi(200), "二百");
    // The 二 of 十二万 is the units digit of 12, not a multiplier of 万.
    assertIdentical(cardinalHanzi(120_000), "十二万");
  });

  it("keeps 两 to the front of the number when asked", () => {
    // 现代汉语词典's own prescription: the 二 of 三万二千 cannot be 两.
    assertIdentical(cardinalHanzi(12_000, { liang: "leading" }), "一万二千");
    assertIdentical(cardinalHanzi(2000, { liang: "leading" }), "两千");
    assertIdentical(cardinalHanzi(20_000, { liang: "leading" }), "两万");
    assertIdentical(
      cardinalHanzi(30_002_000, { liang: "leading" }),
      "三千万二千",
    );
  });

  it("writes 二 everywhere when asked", () => {
    assertIdentical(cardinalHanzi(2000, { liang: "never" }), "二千");
    assertIdentical(cardinalHanzi(20_000, { liang: "never" }), "二万");
  });

  it("writes a lone 2 as 两 when it is counting something", () => {
    // 两个西瓜, 两个人, 两岁: a 2 in front of a 量词 is 两 and never 二.
    assertIdentical(cardinalHanzi(2, { counts: true }), "两");
    // The 二 of 十二个 or 一万零二个 is a digit inside a larger number, so
    // only the lone 2 moves.
    assertIdentical(cardinalHanzi(12, { counts: true }), "十二");
    assertIdentical(cardinalHanzi(22, { counts: true }), "二十二");
    assertIdentical(cardinalHanzi(10_002, { counts: true }), "一万零二");
    assertIdentical(cardinalHanzi(200, { counts: true }), "二百");
    // Counting nothing is the default, since a bare 2 counts nothing.
    assertIdentical(cardinalHanzi(2), "二");
    // And 二 throughout still means 二 throughout.
    assertIdentical(cardinalHanzi(2, { counts: true, liang: "never" }), "二");
    assertIdentical(cardinalHanzi(2, { counts: true, liang: "leading" }), "两");
  });

  it("does not count with the whole part of a decimal", () => {
    // 2.5个 是二点五个: the 两 of 两个 would be reading the 2 on its own.
    assertIdentical(numeralHanzi("2.5", { counts: true }), "二点五");
    assertIdentical(numeralHanzi(2, { counts: true }), "两");
  });

  it("counts nothing in a percentage or a fraction", () => {
    // 百分之二 counts hundredths and 二分之一 names a half; neither has a 量词
    // for the 两 to attach to.
    assertIdentical(percentHanzi(2, { counts: true }), "百分之二");
    assertIdentical(fractionHanzi(1, 2, { counts: true }), "二分之一");
  });

  it("refuses what it cannot write", () => {
    for (const value of [-1, 1.5, 10 ** 17]) {
      assertInstanceOf(
        assertThrowsError(() => cardinalHanzi(value)),
        RangeError,
      );
    }
  });
});

describe("writing a number", () => {
  it("counts by default and spells out on request", () => {
    assertIdentical(numeralHanzi(2026), "两千零二十六");
    assertIdentical(numeralHanzi(2026, { style: "digits" }), "二〇二六");
  });

  it("keeps the digits exactly as written when spelling them out", () => {
    // A room number keeps its zeros, which is why a string says more than a
    // number here.
    assertIdentical(numeralHanzi("007", { style: "digits" }), "〇〇七");
    assertIdentical(numeralHanzi("007"), "七");
  });

  it("writes 零 rather than 〇 when asked", () => {
    assertIdentical(
      numeralHanzi(2019, { style: "digits", zero: "零" }),
      "二零一九",
    );
  });

  it("reads a decimal's fraction digit by digit, whatever the style", () => {
    assertIdentical(numeralHanzi("3.14"), "三点一四");
    assertIdentical(numeralHanzi("3.14", { style: "digits" }), "三点一四");
    assertIdentical(numeralHanzi("20.05"), "二十点零五");
  });

  it("writes a negative with 负", () => {
    assertIdentical(numeralHanzi(-40), "负四十");
  });

  it("reports nothing for what is not a number", () => {
    assertUndefined(numeralHanzi("3D"));
    assertUndefined(numeralHanzi(""));
    assertUndefined(numeralHanzi("1,000"));
    assertUndefined(numeralHanzi(NaN));
    // Too large to count, though its digits could still be read out.
    assertUndefined(numeralHanzi("1".repeat(20)));
    assertIdentical(
      numeralHanzi("1".repeat(20), { style: "digits" }),
      "一".repeat(20),
    );
  });
});

describe("reading a number", () => {
  it("reads a quantity and a digit string differently", () => {
    assertIdentical(read(2026), "liǎng qiān líng èr shí liù");
    assertIdentical(read(2026, { style: "digits" }), "èr líng èr liù");
  });

  it("reads 1 as yāo only when asked", () => {
    assertIdentical(read(110, { style: "digits" }), "yī yī líng");
    assertIdentical(read(110, { style: "digits", yao: true }), "yāo yāo líng");
  });

  it("gives underlying tones, leaving sandhi to the sandhi pass", () => {
    // 一百 is said `yìbǎi`; what comes back is the citation tone, exactly as a
    // dictionary reading does.
    assertIdentical(read(100), "yī bǎi");
  });

  it("reads a decimal and a negative", () => {
    assertIdentical(read("3.14"), "sān diǎn yī sì");
    assertIdentical(read(-40), "fù sì shí");
  });

  it("reports nothing for what is not a number", () => {
    assertUndefined(readNumeral("3D"));
  });

  it("reads written numerals, and nothing else", () => {
    // The reading half is usable on its own, for 汉字 that were already
    // written: a caller with 一千零五 in hand has a number, not a lookup.
    assertIdentical(readOut("一千零五"), "yī qiān líng wǔ");
    assertIdentical(readOut("〇"), "líng");
    assertUndefined(readNumeralHanzi("一千零五个"));
  });
});

describe("percentages and fractions", () => {
  it("reverses a percentage, which is how it is said", () => {
    assertIdentical(percentHanzi(95), "百分之九十五");
    assertIdentical(percentHanzi("3.5"), "百分之三点五");
  });

  it("names the denominator first", () => {
    assertIdentical(fractionHanzi(3, 4), "四分之三");
    assertIdentical(fractionHanzi(1, 2), "二分之一");
  });

  it("reports nothing where either part is not a number", () => {
    assertUndefined(percentHanzi("many"));
    assertUndefined(fractionHanzi(1, "half"));
    assertUndefined(fractionHanzi("half", 1));
  });
});
