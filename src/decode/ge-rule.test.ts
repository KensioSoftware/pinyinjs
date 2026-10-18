import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { decodeRun } from "./decode.js";
import { COUNTED_GE } from "./ge-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== COUNTED_GE);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

/** The 个人 a run keeps as one word. */
function individualsIn(run: string): readonly string[] {
  return wordsOf(run).filter((word) => word === "个人" || word === "個人");
}

describe("个人 where 个 counts one 人", () => {
  it("splits 个人 after a verb that introduces somebody", () => {
    // Given 个人 after 有, with no noun after it
    // When the run is decoded
    // Then 个 and 人 are words of their own
    assertArrayEquals(wordsOf("门口有个人"), ["门口", "有", "个", "人"]);
    // And without the rule, they were one
    assertArrayEquals(wordsOf("门口有个人", false), ["门口", "有", "个人"]);
    for (const run of [
      "前门有个人来找你",
      "叫个人去你家接你",
      "我只是想找个人说说话",
      "有個人想了解我",
    ]) {
      assertArrayEquals(individualsIn(run), []);
    }
  });

  it("splits 个人 across a 了", () => {
    assertArrayEquals(wordsOf("我今天雇了个人").slice(-3), ["了", "个", "人"]);
    assertArrayEquals(individualsIn("湯姆現在跟換了個人一樣"), []);
  });

  it("keeps the word", () => {
    // Given 个人 as individual or personal
    // When each run is decoded
    // Then 个人 stays one word
    for (const run of [
      "我有个人问题",
      "请把您的个人地址写给我",
      "就个人而言",
      "我个人认为",
      "西方文化很看重个人",
    ]) {
      assertArrayEquals(individualsIn(run), ["个人"]);
    }
  });
});
