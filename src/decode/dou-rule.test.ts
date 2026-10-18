import { fileURLToPath } from "node:url";

import { assertArrayEquals, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { SUMMING_DOU } from "./dou-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== SUMMING_DOU);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

/** The readings a run decodes to, one per word. */
function readingsOf(run: string): readonly string[] {
  return decodeRun(dictionary, run).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("花都 where 都 is the adverb", () => {
  it("splits 花都 before a verb", () => {
    // Given the flowers 都 sums up
    // When the run is decoded
    // Then 花 and 都 are words of their own
    assertArrayEquals(wordsOf("花都开了"), ["花", "都", "开", "了"]);
    // And without the rule, they were the district
    assertArrayEquals(wordsOf("花都开了", false).slice(0, 1), ["花都"]);
    assertArrayEquals(wordsOf("所有的花都是纸做的").slice(2, 5), [
      "花",
      "都",
      "是",
    ]);
  });

  it("reads the 都 as dōu", () => {
    assertArrayEquals(readingsOf("公园里的花都开了").slice(3, 5), [
      "huā",
      "dōu",
    ]);
  });

  it("keeps the district before a noun", () => {
    // Given 花都 naming what it holds
    // When each run is decoded
    // Then 花都 stays one word
    for (const run of ["广州花都区很大", "我们去花都机场"]) {
      assertIdentical(
        wordsOf(run).some((word) => word.startsWith("花都")),
        true,
      );
    }
  });
});
