import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { decodeRun } from "./decode.js";
import { PRICED_UNIT } from "./price-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== PRICED_UNIT);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

describe("a price and its unit", () => {
  it("cuts every number from 元", () => {
    // Given numbers before 元, some of which jieba counted as words
    // When each run is decoded
    // Then the number and 元 are words of their own, as 十元 already was
    for (const number of ["一", "三", "五", "七", "八", "十", "六"]) {
      assertArrayEquals(wordsOf(`这个${number}元`), ["这个", number, "元"]);
    }
    // And without the rule, 五元 was one word
    assertArrayEquals(wordsOf("这个五元", false), ["这个", "五元"]);
  });

  it("keeps 二元, which is binary, unless a longer number ends in it", () => {
    // Given 二 alone before 元, and 四十二元
    // When each run is decoded
    // Then 二元 stays whole and 四十二元 is cut
    assertArrayEquals(wordsOf("二元对立"), ["二元", "对立"]);
    assertArrayEquals(wordsOf("七千五百四十二元").slice(-1), ["元"]);
  });

  it("leaves 元 to a word that starts at it", () => {
    // Given 三元色, where 元色 is a word
    // When the run is decoded
    // Then the decode is left as it was
    assertArrayEquals(wordsOf("三元色"), wordsOf("三元色", false));
  });

  it("cuts a number from 毛 or 角 where money is around it", () => {
    // Given 毛 and 角 with 钱 after, a larger unit before, or a verb of paying
    // When each run is decoded
    // Then the number, the unit and 钱 are words of their own
    assertArrayEquals(wordsOf("五毛钱"), ["五", "毛", "钱"]);
    assertArrayEquals(wordsOf("两块五毛"), ["两", "块", "五", "毛"]);
    assertArrayEquals(wordsOf("只要五毛"), ["只", "要", "五", "毛"]);
    assertArrayEquals(wordsOf("花了三角"), ["花", "了", "三", "角"]);
    assertArrayEquals(wordsOf("一毛錢也沒有").slice(0, 3), ["一", "毛", "錢"]);
  });

  it("keeps 三角, 八角 and 三毛 where they are no money", () => {
    // Given a triangle, star anise and a pen name
    // When each run is decoded
    // Then each stays one word
    assertArrayEquals(wordsOf("画一个三角"), ["画", "一个", "三角"]);
    assertArrayEquals(wordsOf("放点八角"), ["放", "点", "八角"]);
    assertArrayEquals(wordsOf("三毛的书"), ["三毛", "的", "书"]);
  });
});

describe("只要 before a price", () => {
  it("cuts 只要 into 只 and 要", () => {
    // Given 只要 before a number counting something
    // When each run is decoded
    // Then it is 只, only, and 要, costs or wants
    assertArrayEquals(wordsOf("晚上可能只要五元").slice(-4), [
      "只",
      "要",
      "五",
      "元",
    ]);
    assertArrayEquals(wordsOf("只要两分钟"), ["只", "要", "两", "分钟"]);
    assertArrayEquals(wordsOf("我只要一份").slice(0, 3), ["我", "只", "要"]);
    // And without the rule, it was the conjunction
    assertArrayEquals(wordsOf("只要两分钟", false).slice(0, 1), ["只要"]);
  });

  it("keeps the conjunction", () => {
    // Given 只要 opening a condition
    // When each run is decoded
    // Then it stays one word
    for (const run of ["只要一下雨就不去", "只要军队够强", "只要你愿意"]) {
      assertArrayEquals(wordsOf(run).slice(0, 1), ["只要"]);
    }
  });
});
