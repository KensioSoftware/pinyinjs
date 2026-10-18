import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { MODAL_CAI } from "./cai-rule.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== MODAL_CAI);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

/** The 才能 a run keeps as one word. */
function talentIn(run: string): readonly string[] {
  return wordsOf(run).filter((word) => word === "才能");
}

describe("才能 where 能 is the modal", () => {
  it("splits 才能 before a verb", () => {
    // Given 才 and 能 in front of the verb they qualify
    // When the run is decoded
    // Then 才 and 能 are words of their own
    assertArrayEquals(wordsOf("怎样才能提高爆发力"), [
      "怎样",
      "才",
      "能",
      "提高",
      "爆发力",
    ]);
    // And without the rule, they were the noun
    assertArrayEquals(wordsOf("怎样才能提高爆发力", false).slice(0, 2), [
      "怎样",
      "才能",
    ]);
    for (const run of [
      "必须先完成这件事才能回家",
      "只有学习才能获得知识",
      "我們怎樣才能停止戰爭",
      "才能和你一起去參加舞會",
    ]) {
      assertArrayEquals(talentIn(run), []);
    }
  });

  it("keeps the noun", () => {
    // Given 才能 owned, had, described or closing the run
    // When each run is decoded
    // Then 才能 stays one word
    for (const run of [
      "她对自己的才能很自豪",
      "他是个富有才能的年轻导演",
      "你很有才能",
      "她具有語言學習的卓越才能",
      "音乐才能是可以培养出来的",
      "音乐才能是否可以培养",
      "她的唱歌才能非常出众",
    ]) {
      assertArrayEquals(talentIn(run), ["才能"]);
    }
  });

  it("leaves a 才 another word could take", () => {
    // Given 处方 in front of the 才, and 方才 a word too
    // When the run is decoded
    // Then 处方 keeps its characters
    assertArrayEquals(wordsOf("必须有医生的处方才能买").slice(-3), [
      "处方",
      "才能",
      "买",
    ]);
  });
});
