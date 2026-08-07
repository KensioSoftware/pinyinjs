import {
  assertFalse,
  assertIdentical,
  assertMapSize,
  assertNonNullable,
  assertSetSize,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { readSyllable, type Syllable } from "../syllable/syllable.js";
import {
  type CharacterConversion,
  conversionKey,
  convertCharacter,
  convertCharacters,
  isAmbiguousCharacter,
  readConversionKey,
  readScriptTables,
  type ScriptTables,
  writeScriptTables,
} from "./conversion.js";

/**
 * Parse a reading, failing the test rather than the assertion if it will not.
 */
function syllable(spelling: string): Syllable {
  const parsed = readSyllable(spelling);
  assertNonNullable(parsed);
  return parsed;
}

const TO_TRADITIONAL = new Map<string, CharacterConversion>([
  ["发", { to: "發", byReading: new Map([["fa4", "髮"]]) }],
  ["头", { to: "頭" }],
  ["出", { to: "出" }],
]);

const TABLES: ScriptTables = {
  toTraditional: TO_TRADITIONAL,
  toSimplified: new Map([["髮", { to: "发" }]]),
  traditionalWords: new Map([["一台", "一臺"]]),
  simplifiedWords: new Map([["乾隆", "乾隆"]]),
  hansOnly: new Set(["发"]),
  hantOnly: new Set(["髮", "發"]),
};

describe("script conversion tables", () => {
  describe("conversionKey", () => {
    it("writes a syllable as numbered pinyin", () => {
      assertIdentical(conversionKey(syllable("fa4")), "fa4");
      assertIdentical(conversionKey(syllable("qian2")), "qian2");
    });

    it("keys an absent reading as the empty string", () => {
      assertIdentical(conversionKey(undefined), "");
    });

    it("ignores 儿化, which never bears on which variant is meant", () => {
      assertIdentical(conversionKey(syllable("wanr2")), "wan2");
    });

    it("round-trips through readConversionKey", () => {
      assertIdentical(conversionKey(readConversionKey("fa4")), "fa4");
      assertUndefined(readConversionKey(""));
    });
  });

  describe("convertCharacter", () => {
    it("takes the default when no reading is given", () => {
      assertIdentical(convertCharacter(TO_TRADITIONAL, "发", undefined), "發");
    });

    it("takes the reading's form where it has one", () => {
      assertIdentical(
        convertCharacter(TO_TRADITIONAL, "发", syllable("fa4")),
        "髮",
      );
    });

    it("falls back to the default for an unlisted reading", () => {
      assertIdentical(
        convertCharacter(TO_TRADITIONAL, "发", syllable("fa1")),
        "發",
      );
    });

    it("leaves a character the table does not know", () => {
      assertIdentical(convertCharacter(TO_TRADITIONAL, "好", undefined), "好");
    });
  });

  describe("isAmbiguousCharacter", () => {
    it("is true where a reading disagrees with the default", () => {
      assertTrue(isAmbiguousCharacter(TO_TRADITIONAL, "发"));
    });

    it("is false for a one-to-one mapping and for an unknown character", () => {
      assertFalse(isAmbiguousCharacter(TO_TRADITIONAL, "头"));
      assertFalse(isAmbiguousCharacter(TO_TRADITIONAL, "好"));
    });
  });

  describe("convertCharacters", () => {
    it("uses the reading at each position", () => {
      assertIdentical(
        convertCharacters(TO_TRADITIONAL, "头发", [
          syllable("tou2"),
          syllable("fa4"),
        ]),
        "頭髮",
      );
      assertIdentical(
        convertCharacters(TO_TRADITIONAL, "出发", [
          syllable("chu1"),
          syllable("fa1"),
        ]),
        "出發",
      );
    });

    it("takes defaults where no readings are offered", () => {
      assertIdentical(convertCharacters(TO_TRADITIONAL, "头发"), "頭發");
    });
  });

  describe("writeScriptTables and readScriptTables", () => {
    it("round-trips every table", () => {
      const read = readScriptTables(writeScriptTables(TABLES));
      assertMapSize(read.toTraditional, 3);
      assertMapSize(read.toSimplified, 1);
      assertMapSize(read.traditionalWords, 1);
      assertMapSize(read.simplifiedWords, 1);
      assertSetSize(read.hansOnly, 1);
      assertSetSize(read.hantOnly, 2);
    });

    it("round-trips the reading-conditioned forms", () => {
      const read = readScriptTables(writeScriptTables(TABLES));
      assertIdentical(
        convertCharacter(read.toTraditional, "发", syllable("fa4")),
        "髮",
      );
      assertIdentical(
        convertCharacter(read.toTraditional, "发", undefined),
        "發",
      );
    });

    it("round-trips a word exception whose two forms are identical", () => {
      const read = readScriptTables(writeScriptTables(TABLES));
      assertIdentical(read.simplifiedWords.get("乾隆"), "乾隆");
    });

    it("skips a line whose tag it does not know", () => {
      const read = readScriptTables("t\t发\t發\nz\t好\t好\n");
      assertMapSize(read.toTraditional, 1);
      assertMapSize(read.toSimplified, 0);
    });

    it("reads an empty file as empty tables", () => {
      const read = readScriptTables("");
      assertMapSize(read.toTraditional, 0);
      assertSetSize(read.hansOnly, 0);
    });
  });
});
