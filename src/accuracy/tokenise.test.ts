import {
  assertArrayEquals,
  assertIdentical,
  assertSetSize,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { tokenisePinyin, tonelessSyllable } from "./tokenise.js";

describe("tokenising pinyin for scoring", () => {
  describe("tokenisePinyin", () => {
    it("records where each written word begins", () => {
      const tokenised = tokenisePinyin("Wǒ yào qù Běijīng wánr.");
      assertArrayEquals(tokenised.syllables, [
        "Wǒ",
        "yào",
        "qù",
        "Běi",
        "jīng",
        "wánr",
      ]);
      // 北京 is one word, so no boundary falls at index 4.
      assertArrayEquals([...tokenised.wordStarts], [0, 1, 2, 3, 5]);
    });

    it("drops punctuation from the edges of a word", () => {
      assertArrayEquals(tokenisePinyin("hǎo!").syllables, ["hǎo"]);
      assertArrayEquals(tokenisePinyin("“hǎo”").syllables, ["hǎo"]);
    });

    it("keeps the digits of tone-numbered pinyin", () => {
      assertArrayEquals(tokenisePinyin("hao3.").syllables, ["hao3"]);
    });

    it("ignores surplus whitespace and punctuation-only words", () => {
      assertArrayEquals(tokenisePinyin("  hǎo   ma  ").syllables, [
        "hǎo",
        "ma",
      ]);
      assertSetSize(tokenisePinyin("  hǎo   ma  ").wordStarts, 2);
      assertArrayEquals(tokenisePinyin("hǎo — ma").syllables, ["hǎo", "ma"]);
      assertArrayEquals(tokenisePinyin("").syllables, []);
    });

    it("keeps an unreadable word whole rather than throwing", () => {
      assertArrayEquals(tokenisePinyin("hǎo zzz").syllables, ["hǎo", "zzz"]);
    });
  });

  describe("tonelessSyllable", () => {
    it("folds away case and tone alike", () => {
      assertIdentical(tonelessSyllable("Běi"), "bei");
      assertIdentical(tonelessSyllable("hǎo"), "hao");
      assertIdentical(tonelessSyllable("hao3"), "hao");
    });

    it("keeps the diaeresis of ü, which is not a tone", () => {
      assertIdentical(tonelessSyllable("lǚ"), "lü");
    });
  });
});
