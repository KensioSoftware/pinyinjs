import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { TRADE_HANG } from "./hang-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const full = await loadDictionary(fileSource(dataDirectory), "full");
const core = await loadDictionary(fileSource(dataDirectory), "core");

/** The reading of every 行 in a run, with every rule or every rule but this. */
function hangOf(run: string, withRule = true, dictionary = full): string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== TRADE_HANG);
  const readings: string[] = [];
  for (const word of decodeRun(dictionary, run, rules)) {
    toCharacters(word.text).forEach((character, at) => {
      const syllable = word.reading[at];
      if (character === "行" && syllable !== undefined) {
        readings.push(writeSyllable(syllable));
      }
    });
  }
  return readings;
}

describe("一行 as a line of work", () => {
  it("reads 这一行 after 干 as háng", () => {
    // Given the sentence Chinese Boost's reviewer flagged
    // When it is decoded
    // Then 一行 is a trade, háng
    assertArrayEquals(hangOf("毕竟只有他干过这一行"), ["háng"]);
    // And without the rule it was a travelling party
    assertArrayEquals(hangOf("毕竟只有他干过这一行", false), ["xíng"]);
  });

  it("reads háng after a demonstrative or the verb that works at it", () => {
    for (const run of [
      "我干这一行已经很久了",
      "那一行不好做",
      "你是哪一行的",
      "这一行字看不清",
    ]) {
      assertArrayEquals(hangOf(run), ["háng"]);
    }
    assertArrayEquals(hangOf("干一行爱一行"), ["háng", "háng"]);
    assertArrayEquals(hangOf("我干这一行已经很久了", true, core), ["háng"]);
  });

  it("keeps xíng for a party travelling together", () => {
    // Given 一行 counting the people in a party
    // When each run is decoded
    // Then 行 stays xíng
    for (const run of [
      "我们一行人到了",
      "他们一行三人",
      "这一行人走了很久",
      "代表团一行十人",
    ]) {
      assertArrayEquals(hangOf(run), ["xíng"]);
    }
  });

  it("leaves a word opening at the 行 alone", () => {
    assertArrayEquals(hangOf("这一行程很紧"), ["xíng"]);
  });
});
