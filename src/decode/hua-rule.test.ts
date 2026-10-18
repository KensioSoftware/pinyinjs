import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { decodeRun } from "./decode.js";
import { NOUN_HUA } from "./hua-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== NOUN_HUA);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

describe("的话 where 话 is the noun", () => {
  it("splits 的话 before a 吗 or a 里", () => {
    // Given the 话 a 吗 asks about
    // When the run is decoded
    // Then 的 and 话 are words of their own
    assertArrayEquals(wordsOf("你听得懂从我嘴里出来的话吗"), [
      "你",
      "听得懂",
      "从",
      "我",
      "嘴里",
      "出来",
      "的",
      "话",
      "吗",
    ]);
    // And without the rule, they were one
    assertArrayEquals(wordsOf("你听得懂从我嘴里出来的话吗", false).slice(-2), [
      "的话",
      "吗",
    ]);
    assertArrayEquals(wordsOf("他的话里有文章").slice(0, 3), [
      "他",
      "的",
      "话",
    ]);
  });

  it("splits 的话 after a verb of speaking", () => {
    assertArrayEquals(wordsOf("他说的话不是真的").slice(0, 4), [
      "他",
      "说",
      "的",
      "话",
    ]);
    assertArrayEquals(wordsOf("我們總是有說不完的話").slice(-2), ["的", "話"]);
    assertArrayEquals(wordsOf("他跟她说这样的话真是太残忍了").slice(5, 7), [
      "的",
      "话",
    ]);
  });

  it("splits 的话 that a 句 or a 些 after a verb of speaking counts", () => {
    assertArrayEquals(wordsOf("说句简单的话").slice(-2), ["的", "话"]);
    assertArrayEquals(wordsOf("平时总是说一些傻乎乎的话").slice(-2), [
      "的",
      "话",
    ]);
  });

  it("splits 的话 after when the words were said", () => {
    assertArrayEquals(wordsOf("又续上刚才的话").slice(-2), ["的", "话"]);
  });

  it("splits somebody's 的话", () => {
    assertArrayEquals(wordsOf("他的话让我吃惊").slice(0, 3), [
      "他",
      "的",
      "话",
    ]);
    assertArrayEquals(wordsOf("你应该听妈妈的话").slice(-2), ["的", "话"]);
    assertArrayEquals(wordsOf("为什么不听我的话").slice(-2), ["的", "话"]);
    assertArrayEquals(wordsOf("她还是要听她叔叔的话").slice(-2), ["的", "话"]);
    assertArrayEquals(wordsOf("法官认真听完了我的话").slice(-2), ["的", "话"]);
  });

  it("splits words a verb takes as its object", () => {
    assertArrayEquals(wordsOf("事实印证了老师的话").slice(-2), ["的", "话"]);
  });

  it("splits words described as speech", () => {
    // Given an adjective of speech after a speaker or a verb of speaking
    // When each run is decoded
    // Then 的 and 话 are words of their own
    assertArrayEquals(wordsOf("他刻薄的话让我很难受").slice(2, 4), [
      "的",
      "话",
    ]);
    assertArrayEquals(wordsOf("你怎么能说出这么卑鄙的话").slice(-2), [
      "的",
      "话",
    ]);
    assertArrayEquals(wordsOf("我刚说了很蠢的话").slice(-2), ["的", "话"]);
    assertArrayEquals(wordsOf("那是我说过的最愚蠢的话了").slice(-3, -1), [
      "的",
      "话",
    ]);
  });

  it("splits the words something is explained in", () => {
    // Given 用 a kind of words, and a verb of explaining after them
    // When each run is decoded
    // Then 的 and 话 are words of their own
    for (const run of [
      "请用通俗的话再说一遍",
      "请用通俗的话解释一下",
      "请用简练的话介绍一下",
      "你能用更简单的话做解释吗",
    ]) {
      assertArrayEquals(
        wordsOf(run).filter((word) => word === "的话"),
        [],
      );
    }
  });

  it("keeps the conditional", () => {
    // Given 的话 closing a condition
    // When each run is decoded
    // Then 的话 stays one word
    for (const run of [
      "下雨的话",
      "你喜欢的话就多吃点",
      "热的话就脱衣服",
      "我这么说的话是不是像个傻瓜",
      "要我说的话",
      "再集中一点去听讲的话",
      "如果你们陪我的话",
      "既然是汤姆的话",
      "这样的话我们会浪费很多时间",
      "有些人不来的话",
      "他的话",
      "太贵的话我就不买了",
      "你累的话就休息一下",
      "用电脑的话就快多了",
      "用别人的钱的话就要还",
      "你无聊的话可以看书",
      "简单的话就自己做吧",
    ]) {
      assertArrayEquals(
        wordsOf(run).filter((word) => word === "的话"),
        ["的话"],
      );
    }
  });
});
