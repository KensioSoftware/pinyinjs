import { dictionaryOf, reading } from "#test/fixtures/decoder-dictionary.js";
import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import type { DecodedWord } from "../decode/word.js";
import { PERSONAL_NAME } from "./personal-names.js";

/**
 * A decoded word, with the fields the rule reads.
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

/**
 * The words the rule leaves, by their characters and whether each is a name.
 */
function named(words: readonly DecodedWord[]): readonly string[] {
  return PERSONAL_NAME.apply(words, dictionaryOf([])).map(
    (one) => `${one.text}${one.isProperNoun ? "*" : ""}`,
  );
}

describe("a listed personal name", () => {
  it("joins a given name decoded a character at a time", () => {
    // Given 杨五郎 decoded as 杨, 五 and 郎
    const words = [
      word("杨", "yáng"),
      word("五", "wǔ"),
      word("郎", "láng"),
      word("削发", "xuē fà"),
    ];

    // When the rule is applied
    // Then the given name is one word and both parts are names
    assertArrayEquals(named(words), ["杨*", "五郎*", "削发"]);
  });

  it("leaves a name a longer word runs across", () => {
    // Given 蒋干 where the decode read 干盗 as one word, and 郑 inside a word
    const across = [word("蒋", "jiǎng"), word("干盗", "gàn dào")];
    const inside = [word("郑板", "zhèng bǎn"), word("桥", "qiáo")];

    // When the rule is applied
    // Then neither is touched
    assertArrayEquals(named(across), ["蒋", "干盗"]);
    assertArrayEquals(named(inside), ["郑板", "桥"]);
  });
});
