import { reading } from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { DecodedWord } from "../decode/word.js";
import { divideAt, join, splitAt } from "./rule.js";

/**
 * A decoded word, with the fields the helpers read.
 */
function word(text: string, pinyin: string): DecodedWord {
  return {
    text,
    reading: reading(pinyin),
    isProperNoun: false,
    partOfSpeech: "",
    isKnown: true,
  };
}

describe("word rewriting", () => {
  describe("join", () => {
    it("keeps the head's flags, since the head is the word", () => {
      const joined = join(
        { ...word("看", "kàn"), partOfSpeech: "v", isProperNoun: true },
        { ...word("了", "le"), partOfSpeech: "ul" },
      );
      assertIdentical(joined.text, "看了");
      assertIdentical(joined.partOfSpeech, "v");
      assertArrayLength(joined.reading, 2);
    });

    it("is only known when both halves were", () => {
      assertFalse(
        join(word("看", "kàn"), { ...word("了", "le"), isKnown: false })
          .isKnown,
      );
    });

    it("carries whatever was written in front of the head", () => {
      // Nothing in the shipped rule order joins a word that already takes a
      // hyphen, since the hyphens are written last — but losing the mark here
      // would be silent if that order ever changed.
      assertIdentical(
        join({ ...word("研究", "yán jiū"), separator: "-" }, word("了", "le"))
          .separator,
        "-",
      );
      assertUndefined(join(word("看", "kàn"), word("了", "le")).separator);
    });
  });

  describe("divideAt", () => {
    it("cuts at every offset it is given", () => {
      const parts = divideAt(
        word("上海交通大学", "shàng hǎi jiāo tōng dà xué"),
        [2, 4],
      );
      assertArrayEquals(
        parts.map((part) => part.text),
        ["上海", "交通", "大学"],
      );
      assertArrayLength(parts[1]?.reading ?? [], 2);
    });

    it("is splitAt with one offset", () => {
      assertArrayEquals(
        divideAt(word("北京大学", "běi jīng dà xué"), [2]).map((p) => p.text),
        ["北京", "大学"],
      );
    });

    it("refuses a reading that is not one syllable per character", () => {
      assertArrayEquals(
        divideAt(word("玩儿", "wánr"), [1]).map((part) => part.text),
        ["玩儿"],
      );
    });

    it("refuses an offset outside the word", () => {
      // A boundary that does not describe this word cannot be applied to it.
      assertArrayEquals(
        divideAt(word("北京", "běi jīng"), [2]).map((part) => part.text),
        ["北京"],
      );
      assertArrayEquals(
        divideAt(word("北京", "běi jīng"), [5]).map((part) => part.text),
        ["北京"],
      );
    });

    it("refuses offsets that are not in ascending order", () => {
      assertArrayEquals(
        divideAt(
          word("上海交通大学", "shàng hǎi jiāo tōng dà xué"),
          [4, 2],
        ).map((part) => part.text),
        ["上海交通大学"],
      );
    });

    it("keeps the mark in front of the word on the first part only", () => {
      const parts = divideAt(
        {
          ...word("上海交通大学", "shàng hǎi jiāo tōng dà xué"),
          separator: "-",
        },
        [2, 4],
      );
      assertIdentical(parts[0]?.separator, "-");
      assertUndefined(parts[1]?.separator);
      assertUndefined(parts[2]?.separator);
    });
  });

  describe("splitAt", () => {
    it("cuts the characters and the reading at the same place", () => {
      const split = splitAt(word("南京市", "nán jīng shì"), 2);
      assertNonNullable(split);
      assertArrayEquals(
        split.map((part) => part.text),
        ["南京", "市"],
      );
      assertArrayLength(split[0].reading, 2);
      assertArrayLength(split[1].reading, 1);
    });

    it("refuses a reading that is not one syllable per character", () => {
      // There is no way to cut `wánr` in half.
      assertUndefined(splitAt(word("玩儿", "wánr"), 1));
    });

    it("leaves the mark in front of the word on the head alone", () => {
      const split = splitAt(
        { ...word("干干净净", "gān gān jìng jìng"), separator: "-" },
        2,
      );
      assertNonNullable(split);
      assertIdentical(split[0].separator, "-");
      assertUndefined(split[1].separator);
    });
  });
});
