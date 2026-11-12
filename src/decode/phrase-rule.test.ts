import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { decodeRun } from "./decode.js";
import { COMPOSED_PHRASE } from "./phrase-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== COMPOSED_PHRASE);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

describe("好多 before the 了 of a change", () => {
  it("cuts 好多了 into 好, 多 and 了", () => {
    // Given 好多了 meaning much better
    // When each run is decoded
    // Then 好, 多 and 了 are words of their own
    assertArrayEquals(wordsOf("妈妈好多了"), ["妈妈", "好", "多", "了"]);
    assertArrayEquals(wordsOf("我现在觉得好多了").slice(-3), [
      "好",
      "多",
      "了",
    ]);
    // And without the rule, 好多 was a great many
    assertArrayEquals(wordsOf("妈妈好多了", false), ["妈妈", "好多", "了"]);
  });

  it("keeps 好多 as an amount", () => {
    // Given 好多 a verb took, or before 了解, or before a noun
    // When each run is decoded
    // Then 好多 stays one word
    for (const run of ["他吃了好多了", "来了好多人", "我们需要好多了解"]) {
      assertArrayEquals(
        wordsOf(run).filter((word) => word === "好多"),
        ["好多"],
      );
    }
  });
});

describe("太好了", () => {
  it("cuts it into 太, 好 and 了", () => {
    // Given 太好了
    // When the run is decoded
    // Then each character is a word
    assertArrayEquals(wordsOf("太好了"), ["太", "好", "了"]);
    assertArrayEquals(wordsOf("太好了", false), ["太好了"]);
  });
});

describe("a pronoun and 家", () => {
  it("cuts the pronoun from 家", () => {
    // Given 我家 and 他家, which jieba counts, beside 你家 and 她家
    // When each run is decoded
    // Then every pronoun is cut from its 家
    assertArrayEquals(wordsOf("我家很大"), ["我", "家", "很", "大"]);
    assertArrayEquals(wordsOf("国兴比他家的狗快").slice(2, 5), [
      "他",
      "家",
      "的",
    ]);
    assertArrayEquals(wordsOf("你家她家"), ["你", "家", "她", "家"]);
    // And without the rule, 我家 was one word
    assertArrayEquals(wordsOf("我家很大", false).slice(0, 1), ["我家"]);
  });

  it("keeps 大家, 人家 and 咱家", () => {
    // Given words ending in 家 that are no pronoun's home
    // When each run is decoded
    // Then each stays one word
    assertArrayEquals(wordsOf("大家好").slice(0, 1), ["大家"]);
    assertArrayEquals(wordsOf("人家不要").slice(0, 1), ["人家"]);
    assertArrayEquals(wordsOf("咱家").slice(0, 1), ["咱家"]);
  });
});
