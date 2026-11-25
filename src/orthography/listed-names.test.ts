import { dictionaryOf, reading } from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertIdentical,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { DecodedWord } from "../decode/word.js";
import { writeSyllable } from "../syllable/syllable.js";
import { LISTED_NAMES } from "./listed-name-table.js";
import { keepingHinted, listedWords } from "./listed-words.js";
import { LISTED_NAME } from "./listed-names.js";

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
 * The words the rule leaves, each as its characters and its reading, with a
 * star on a proper noun.
 */
function named(words: readonly DecodedWord[]): readonly string[] {
  return LISTED_NAME.apply(words, dictionaryOf([])).map(
    (one) =>
      `${one.text} ${one.reading.map((syllable) => writeSyllable(syllable)).join("")}${one.isProperNoun ? "*" : ""}`,
  );
}

describe("a listed name", () => {
  it("writes the words the table gives, readings included", () => {
    // Given 杨五郎 decoded as 杨, 五 and 郎, and 藏王 with 藏 read cáng
    const yang = [
      word("杨", "yáng"),
      word("五", "wǔ"),
      word("郎", "láng"),
      word("削发", "xuē fà"),
    ];
    const zao = [word("去", "qù"), word("藏", "cáng"), word("王", "wáng")];

    // When the rule is applied
    // Then each comes out as the table writes it
    assertArrayEquals(named(yang), ["杨 yáng*", "五郎 wǔláng*", "削发 xuēfà"]);
    assertArrayEquals(named(zao), ["去 qù", "藏王 zàngwáng*"]);
  });

  it("matches across the decode's own cuts inside a name", () => {
    // Given 郑板桥 decoded as 郑板 and 桥
    const words = [word("郑板", "zhèng bǎn"), word("桥", "qiáo")];

    // When the rule is applied
    // Then it is written as the table writes it
    assertArrayEquals(named(words), ["郑 zhèng*", "板桥 bǎnqiáo*"]);
  });

  it("leaves a name a longer word runs across", () => {
    // Given 蒋干 where the decode read 干盗 as one word, and 郑 at the end of
    // a word
    const across = [word("蒋", "jiǎng"), word("干盗", "gàn dào")];
    const inside = [word("大郑", "dà zhèng"), word("板桥", "bǎn qiáo")];

    // When the rule is applied
    // Then neither is touched
    assertArrayEquals(named(across), ["蒋 jiǎng", "干盗 gàndào"]);
    assertArrayEquals(named(inside), ["大郑 dàzhèng", "板桥 bǎnqiáo"]);
  });

  it("spells every listed text with one syllable per character", () => {
    // Given every entry in the table
    // When each is cut into its words
    // Then none throws
    for (const [text, pinyin] of LISTED_NAMES) {
      listedWords(text, pinyin);
    }
  });

  it("leaves a hinted text alone where syllables do not match characters", () => {
    // Given a decode of 藏王 read as one 儿化 syllable short of its characters
    const listed = listedWords("藏王", "Zàngwáng");
    const covered = [word("藏王", "cáng")];

    // When a position inside it was hinted
    // Then the table is not applied
    assertIdentical(
      keepingHinted(listed, covered, () => true),
      undefined,
    );
  });

  it("refuses pinyin that does not spell its text", () => {
    assertThrowsError(() => listedWords("藏王", "Zàng"));
    assertThrowsError(() => listedWords("藏王", "Zàngwáng hǎo"));
  });
});
