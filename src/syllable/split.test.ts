import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { readWord, splitSyllables } from "./split.js";

describe("splitting pinyin into syllables", () => {
  describe("splitSyllables", () => {
    it("splits a word written without boundaries", () => {
      assertArrayEquals(splitSyllables("Běijīng"), ["Běi", "jīng"]);
      assertArrayEquals(splitSyllables("zhōngguó"), ["zhōng", "guó"]);
      assertArrayEquals(splitSyllables("yínháng"), ["yín", "háng"]);
    });

    it("honours an apostrophe as an explicit boundary", () => {
      assertArrayEquals(splitSyllables("Xī'ān"), ["Xī", "ān"]);
      assertArrayEquals(splitSyllables("Tiān'ānmén"), ["Tiān", "ān", "mén"]);
      assertArrayEquals(splitSyllables("nǚ'ér"), ["nǚ", "ér"]);
    });

    it("reads an unapostrophised run longest-first, as the orthography assumes", () => {
      // Without the apostrophe, xian is one syllable, which is exactly why
      // 西安 has to be written Xī'ān.
      assertArrayEquals(splitSyllables("xian"), ["xian"]);
    });

    it("honours a hyphen, as used in 成语 and reduplication", () => {
      assertArrayEquals(splitSyllables("fēngpíng-làngjìng"), [
        "fēng",
        "píng",
        "làng",
        "jìng",
      ]);
      assertArrayEquals(splitSyllables("yánjiū-yánjiū"), [
        "yán",
        "jiū",
        "yán",
        "jiū",
      ]);
    });

    it("splits erhua as one syllable, not two", () => {
      assertArrayEquals(splitSyllables("wánr"), ["wánr"]);
      assertArrayEquals(splitSyllables("yìdiǎnr"), ["yì", "diǎnr"]);
      assertArrayEquals(splitSyllables("zhèr"), ["zhèr"]);
    });

    it("keeps 儿 as its own syllable where it is one", () => {
      assertArrayEquals(splitSyllables("érzi"), ["ér", "zi"]);
      assertArrayEquals(splitSyllables("èr"), ["èr"]);
    });

    it("splits tone-numbered pinyin", () => {
      assertArrayEquals(splitSyllables("bei3jing1"), ["bei3", "jing1"]);
    });

    it("returns undefined for text that is not pinyin", () => {
      assertUndefined(splitSyllables("hello"));
      assertUndefined(splitSyllables(""));
      assertUndefined(splitSyllables("zzz"));
    });

    it("backtracks rather than failing on a greedy dead end", () => {
      // A greedy first pass would take "shang" then stumble; the split has to
      // reconsider to reach sha + ngo... which does not exist, so it must fail
      // cleanly rather than loop.
      assertUndefined(splitSyllables("shangqx"));
    });
  });

  describe("readWord", () => {
    it("reads a word into structured syllables", () => {
      const word = readWord("Běijīng");
      assertNonNullable(word);
      assertArrayLength(word, 2);
      assertIdentical(word[0].initial, "b");
      assertIdentical(word[0].final, "ei");
      assertIdentical(word[0].tone, 3);
      assertIdentical(word[1].final, "ing");
      assertIdentical(word[1].tone, 1);
    });

    it("marks an erhua syllable", () => {
      const word = readWord("wánr");
      assertNonNullable(word);
      assertArrayLength(word, 1);
      assertTrue(word[0].erhua);
      assertIdentical(word[0].final, "uan");
      assertIdentical(word[0].tone, 2);
    });

    it("returns undefined for text that is not pinyin", () => {
      assertUndefined(readWord("hello"));
    });
  });
});
