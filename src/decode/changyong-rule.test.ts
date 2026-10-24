import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { VERBAL_CHANGYONG } from "./changyong-rule.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== VERBAL_CHANGYONG);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

/** The 常用 a run keeps as one word. */
function adjectiveIn(run: string): readonly string[] {
  return wordsOf(run).filter((word) => word === "常用");
}

describe("常用 where 用 is the verb", () => {
  it("splits 常用 before an object", () => {
    // Given 常 in front of 用 and the thing it uses
    // When the run is decoded
    // Then 常 and 用 are words of their own
    assertArrayEquals(wordsOf("我常用微博看新闻"), [
      "我",
      "常",
      "用",
      "微博",
      "看",
      "新闻",
    ]);
    // And without the rule, they were the adjective
    assertArrayEquals(wordsOf("我常用微博看新闻", false).slice(0, 2), [
      "我",
      "常用",
    ]);
    for (const run of [
      "妈妈常用剩饭给我们做炒饭",
      "奶奶常用食疗调理身体",
      "父亲常用慎独这个词提醒我",
      "父親常用慎獨這個詞提醒我",
      "我们常用筷子吃饭",
    ]) {
      assertArrayEquals(adjectiveIn(run), []);
    }
  });

  it("lets an adverb take the first 常", () => {
    // Given 时常常用, where 常常 is the adverb in front of 用
    // When the run is decoded
    // Then the adverb is 常常
    assertArrayEquals(wordsOf("他讲话时常常用古书里的典故").slice(2, 5), [
      "时",
      "常常",
      "用",
    ]);
  });

  it("keeps the adjective", () => {
    // Given 常用 graded, counted, described or naming the vocabulary
    // When each run is decoded
    // Then 常用 stays one word
    for (const run of [
      "你知道哪些常用的汉字吗",
      "这是一个很常用的词",
      "信赖域的算法越来越常用",
      "毕竟还只是一个常用工具",
      "祠堂常用于工会举行仪式",
      "学习常用词很重要",
      "掌握常用词汇",
      "汉语常用词表",
      "常用工具",
    ]) {
      assertArrayEquals(adjectiveIn(run), ["常用"]);
    }
  });

  it("leaves a 常 another word could take", () => {
    // Given 中 in front of the 常, and 中常 a word too
    // When the run is decoded
    // Then 中 keeps to itself
    assertArrayEquals(wordsOf("文学作品中常用夜来香来象征思念").slice(1, 3), [
      "中",
      "常用",
    ]);
  });
});
