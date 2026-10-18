import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { ADJECTIVAL_MEI } from "./mei-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== ADJECTIVAL_MEI);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

/** The readings a run decodes to, one per word. */
function readingsOf(run: string): readonly string[] {
  return decodeRun(dictionary, run).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("美的 where 美 is the adjective", () => {
  it("splits 美的 after a degree word", () => {
    // Given 美 graded by the word in front of it
    // When the run is decoded
    // Then 美 and 的 are words of their own
    assertArrayEquals(wordsOf("她是一个非常美的女人").slice(-4), [
      "非常",
      "美",
      "的",
      "女人",
    ]);
    // And without the rule, they were the name
    assertArrayEquals(wordsOf("她是一个非常美的女人", false).slice(-2), [
      "美的",
      "女人",
    ]);
    for (const run of [
      "那是我生命中最美的一天",
      "熊猫是很美的动物",
      "没有比日语更美的语言",
      "多美的日出啊",
      "你看過這麼美的夕陽嗎",
    ]) {
      assertArrayEquals(
        wordsOf(run).filter((word) => word === "美的"),
        [],
      );
    }
  });

  it("splits 美的 after a 是", () => {
    assertArrayEquals(wordsOf("則大部份的東西都是美的").slice(-2), [
      "美",
      "的",
    ]);
  });

  it("reads the 的 as the particle", () => {
    // Given 美的 split after 最
    // When the run is decoded
    // Then the 的 is `de` and not the `dí` of the name
    assertArrayEquals(readingsOf("桂林的景色是天下最美的").slice(-2), [
      "měi",
      "de",
    ]);
  });

  it("keeps the name", () => {
    // Given 美的 with no degree word or 是 in front of it
    // When each run is decoded
    // Then 美的 stays one word
    for (const run of [
      "美的空调很好用",
      "我买了一台美的冰箱",
      "这是美的冰箱",
      "这是美的牌冰箱",
    ]) {
      assertArrayEquals(
        wordsOf(run).filter((word) => word === "美的"),
        ["美的"],
      );
    }
  });
});
