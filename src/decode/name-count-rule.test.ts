import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { decodeRun } from "./decode.js";
import { COUNTED_NAME } from "./name-count-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== COUNTED_NAME);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

/** The proper nouns a run decodes to. */
function namesIn(run: string): readonly string[] {
  return decodeRun(dictionary, run)
    .filter((word) => word.isProperNoun)
    .map((word) => word.text);
}

describe("a proper noun read across a number and its 量词", () => {
  it("splits a name that starts with the number", () => {
    // Given 三本 counting books
    // When the run is decoded
    // Then the number, the 量词 and the noun are words of their own
    assertArrayEquals(wordsOf("随便选三本书"), [
      "随便",
      "选",
      "三",
      "本",
      "书",
    ]);
    // And without the rule, 三本 was the name
    assertArrayEquals(wordsOf("随便选三本书", false), [
      "随便",
      "选",
      "三本",
      "书",
    ]);
    assertArrayEquals(namesIn("你有三本詞典"), []);
  });

  it("splits a name that starts with the 量词", () => {
    assertArrayEquals(wordsOf("工人正在用砖盖一堵墙").slice(-3), [
      "一",
      "堵",
      "墙",
    ]);
    assertArrayEquals(namesIn("每一堵牆都是一扇門"), []);
  });

  it("keeps the name before a title", () => {
    // Given 三本 followed by 先生
    // When the run is decoded
    // Then 三本 stays the surname
    assertArrayEquals(namesIn("三本先生是我的老师"), ["三本"]);
  });
});
