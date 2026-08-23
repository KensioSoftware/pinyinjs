import {
  assertFalse,
  assertSetSize,
  assertIdentical,
  assertNonNullable,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { convertCharacter } from "../script/conversion.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import { buildScriptTables } from "./script-tables.js";

/**
 * Parse a reading, failing the test rather than the assertion if it will not.
 */
function reading(spellings: string): readonly Syllable[] {
  return spellings.split(" ").map((spelling) => {
    const parsed = readSyllable(spelling);
    assertNonNullable(parsed);
    return parsed;
  });
}

/**
 * An entry with only the fields these tables read.
 */
function entry(
  hans: string,
  hant: string,
  readings: string,
  frequency = 1,
): DictionaryEntry {
  return {
    hans,
    hant,
    readings: { cn: reading(readings) },
    frequency,
    partOfSpeech: "",
    isProperNoun: false,
  };
}

/**
 * A miniature dictionary exercising the 发 merge, which is the whole problem.
 */
const ENTRIES: readonly DictionaryEntry[] = [
  entry("发", "發", "fa1"),
  entry("头", "頭", "tou2"),
  entry("出", "出", "chu1"),
  entry("现", "現", "xian4"),
  entry("头发", "頭髮", "tou2 fa4"),
  entry("出发", "出發", "chu1 fa1"),
  entry("发现", "發現", "fa1 xian4"),
  entry("发生", "發生", "fa1 sheng1"),
  entry("生", "生", "sheng1"),
];

/**
 * Enough distinct headwords for a single stray to fall under the share.
 *
 * The share is a twentieth, so it takes twenty words on the other side before
 * one stray stops counting. That is the threshold, not the fixture.
 */
const MANY = "东南西北中大小上下前后左右内外天地人山水火木金".split("");

describe("script tables", () => {
  describe("buildScriptTables", () => {
    it("gives a character its commonest form as the default", () => {
      const { toTraditional } = buildScriptTables(ENTRIES);
      assertIdentical(convertCharacter(toTraditional, "发", undefined), "發");
    });

    it("gives a reading its own form where the sources agree", () => {
      const { toTraditional } = buildScriptTables(ENTRIES);
      const [, fa] = reading("tou2 fa4");
      assertNonNullable(fa);
      assertIdentical(convertCharacter(toTraditional, "发", fa), "髮");
    });

    it("does not store a character that never changes", () => {
      const { toTraditional } = buildScriptTables(ENTRIES);
      assertFalse(toTraditional.has("出"));
      assertFalse(toTraditional.has("生"));
    });

    it("builds the reverse direction from the same pairings", () => {
      const { toSimplified } = buildScriptTables(ENTRIES);
      assertIdentical(convertCharacter(toSimplified, "發", undefined), "发");
      assertIdentical(convertCharacter(toSimplified, "髮", undefined), "发");
    });

    it("stores no word the characters already convert correctly", () => {
      const { traditionalWords } = buildScriptTables(ENTRIES);
      // 头发 is right from the characters once the reading is used, so it earns
      // no line; the exception list is only what the characters get wrong.
      assertFalse(traditionalWords.has("头发"));
      assertFalse(traditionalWords.has("出发"));
    });

    it("stores a word the characters get wrong", () => {
      const tables = buildScriptTables([
        ...ENTRIES,
        // Same reading as 出发, so nothing but the word itself can settle it.
        entry("发白", "髮白", "fa1 bai2"),
        entry("白", "白", "bai2"),
      ]);
      assertIdentical(tables.traditionalWords.get("发白"), "髮白");
    });

    it("ignores a single character as its own exception", () => {
      // 和 has the rare variant 咊 that Unihan knows and nobody writes. A
      // one-character entry claiming it must not override the aggregate.
      const tables = buildScriptTables([
        entry("和", "咊", "he2"),
        entry("和平", "和平", "he2 ping2"),
        entry("平", "平", "ping2"),
        entry("和气", "和氣", "he2 qi5"),
        entry("气", "氣", "qi4"),
      ]);
      assertFalse(tables.traditionalWords.has("和"));
      assertIdentical(
        convertCharacter(tables.toTraditional, "和", undefined),
        "和",
      );
    });

    it("skips an entry whose two scripts differ in length", () => {
      const tables = buildScriptTables([
        ...ENTRIES,
        entry("一个", "一個個", "yi1 ge4"),
      ]);
      assertFalse(tables.toTraditional.has("个"));
    });
  });

  describe("script-only characters", () => {
    it("names the characters only one script writes", () => {
      const { hansOnly, hantOnly } = buildScriptTables(ENTRIES);
      assertTrue(hansOnly.has("发"));
      assertTrue(hantOnly.has("髮"));
      assertTrue(hantOnly.has("發"));
    });

    it("leaves a character both scripts write out of both sets", () => {
      const { hansOnly, hantOnly } = buildScriptTables(ENTRIES);
      for (const character of ["出", "生"]) {
        assertFalse(hansOnly.has(character));
        assertFalse(hantOnly.has(character));
      }
    });

    it("ignores entries written the same in both scripts", () => {
      // 出's own entry has 出 on both sides, which says nothing about script and
      // would otherwise put every character into both sets.
      const { hansOnly, hantOnly } = buildScriptTables([
        entry("出", "出", "chu1"),
      ]);
      assertSetSize(hansOnly, 0);
      assertFalse(hantOnly.has("出"));
    });

    it("holds the variant 繁體 forms whatever the entries say", () => {
      // Normalisation folds 裏 to 裡 before anything is counted, so no entry can
      // ever put 裏 in a set. The variant table is 繁體 by construction.
      const { hantOnly } = buildScriptTables([entry("出", "出", "chu1")]);
      for (const character of ["裏", "衞", "麪", "羣"]) {
        assertTrue(hantOnly.has(character));
      }
    });

    it("keeps a character only a stray headword writes in 简体 out of 简体", () => {
      // 见幾而作 is a 简体 headword that failed to simplify its 幾. One of those
      // against the words that did simplify is not evidence that 简体 writes it,
      // which is the whole of the 幾 bug.
      const strays = MANY.map((character) =>
        entry(`几${character}`, `幾${character}`, "ji1 yi1"),
      );
      const { hansOnly, hantOnly } = buildScriptTables([
        entry("见幾而作", "見幾而作", "jian4 ji1 er2 zuo4"),
        ...strays,
      ]);
      assertTrue(hantOnly.has("幾"));
      assertFalse(hansOnly.has("幾"));
    });

    it("counts a handful as evidence where the other script has none", () => {
      // The floor alone would throw away every rare character. 齶 is written in
      // two 繁體 words and no 简体 one, and two is all there is to go on.
      const { hantOnly } = buildScriptTables([
        entry("上腭", "上齶", "shang4 e4"),
        entry("硬腭", "硬齶", "ying4 e4"),
      ]);
      assertTrue(hantOnly.has("齶"));
    });
  });
});
