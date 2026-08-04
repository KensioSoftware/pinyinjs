import {
  assertFalse,
  assertIdentical,
  assertMapSize,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { isProperNounTag, parseJiebaDictionary } from "./jieba.js";

/**
 * Real lines from jieba's `dict.txt`, including the non-Han entries it carries.
 */
const SAMPLE = [
  "北京 34488 ns",
  "银行 7684 n",
  "行长 419 n",
  "研究生 1816 n",
  "生命 6986 vn",
  "AT&T 3 nz",
  "c# 3 nz",
  "了 2949273",
  "",
  "malformed line here",
].join("\n");

describe("jieba dictionary", () => {
  describe("parseJiebaDictionary", () => {
    it("reads a word's frequency and tag", () => {
      const entries = parseJiebaDictionary(SAMPLE);
      const entry = entries.get("北京");
      assertNonNullable(entry);
      assertIdentical(entry.frequency, 34_488);
      assertIdentical(entry.partOfSpeech, "ns");
    });

    it("accepts an entry with no tag", () => {
      const entries = parseJiebaDictionary(SAMPLE);
      const entry = entries.get("了");
      assertNonNullable(entry);
      assertIdentical(entry.frequency, 2_949_273);
      assertIdentical(entry.partOfSpeech, "");
    });

    it("keeps the non-Han entries the dictionary carries", () => {
      const entries = parseJiebaDictionary(SAMPLE);
      assertNonNullable(entries.get("AT&T"));
      assertNonNullable(entries.get("c#"));
    });

    it("skips a line whose frequency will not parse", () => {
      const entries = parseJiebaDictionary(SAMPLE);
      assertUndefined(entries.get("malformed"));
    });

    it("skips blank lines", () => {
      assertMapSize(parseJiebaDictionary(SAMPLE), 8);
    });

    it("returns nothing for an empty file", () => {
      assertMapSize(parseJiebaDictionary(""), 0);
    });
  });

  describe("isProperNounTag", () => {
    it("recognises the four proper noun tags", () => {
      for (const tag of ["nr", "ns", "nt", "nz"]) {
        assertTrue(isProperNounTag(tag));
      }
    });

    it("rejects common noun and other tags", () => {
      for (const tag of ["n", "v", "vn", "a", "", "ng"]) {
        assertFalse(isProperNounTag(tag));
      }
    });
  });
});
