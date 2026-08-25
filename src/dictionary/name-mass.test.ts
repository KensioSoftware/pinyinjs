import { assertFalse, assertIdentical, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import type { JiebaEntry } from "../sources/jieba.js";
import { countNameMass, leadsNames } from "./name-mass.js";

/**
 * jieba's dictionary, as `word frequency tag` rows.
 */
function jieba(
  ...rows: readonly [string, number, string][]
): ReadonlyMap<string, JiebaEntry> {
  return new Map(
    rows.map(([word, frequency, partOfSpeech]) => [
      word,
      { frequency, partOfSpeech },
    ]),
  );
}

describe("counting what a character heads", () => {
  it("splits the words it heads by whether they are names", () => {
    const mass = countNameMass(
      jieba(["李自成", 5577, "nr"], ["李家", 443, "nr"], ["李子", 9787, "n"]),
    );
    assertIdentical(mass.get("李")?.asName, 6020);
    assertIdentical(mass.get("李")?.asWord, 9787);
  });

  it("counts a word for the character it starts with and no other", () => {
    const mass = countNameMass(jieba(["伍德", 1320, "nr"]));
    assertIdentical(mass.get("伍")?.asName, 1320);
    assertIdentical(mass.get("德"), undefined);
  });

  it("skips single characters", () => {
    // A character heading itself would confirm whatever tag it arrived with.
    const mass = countNameMass(jieba(["连", 23_315, "nr"]));
    assertIdentical(mass.get("连"), undefined);
  });
});

describe("whether a character leads names", () => {
  const mass = countNameMass(
    jieba(
      ["李自成", 40_346, "nr"],
      ["李子", 9787, "n"],
      ["连中三元", 2102, "nr"],
      ["连续", 23_042, "v"],
      ["帅化民", 155, "nr"],
      ["帅气", 86, "a"],
    ),
  );

  it("is true where the names outweigh the words", () => {
    assertTrue(leadsNames(mass, "李", 9566));
  });

  it("is false where the words outweigh the names", () => {
    assertFalse(leadsNames(mass, "连", 23_315));
  });

  it("counts the character's own occurrences as a word", () => {
    // 帅 heads 155 of names against 86 of words, and was met 795 times on its
    // own meaning handsome.
    assertTrue(leadsNames(mass, "帅", 0));
    assertFalse(leadsNames(mass, "帅", 795));
  });

  it("is false for a character jieba never saw heading a word", () => {
    assertFalse(leadsNames(mass, "薩", 0));
  });
});
