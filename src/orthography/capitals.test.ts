import {
  assertArrayEquals,
  assertFalse,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  capitaliseSentenceParts,
  capitaliseSentences,
  capitaliseWord,
  isSentence,
} from "./capitals.js";

describe("capitalisation", () => {
  describe("isSentence", () => {
    it("recognises a sentence by the punctuation it ends with", () => {
      assertTrue(isSentence("这是我的书。"));
      assertTrue(isSentence("你好吗？"));
      assertTrue(isSentence("Hello."));
    });

    it("does not take a word quoted on its own for a sentence", () => {
      assertFalse(isSentence("学生"));
      assertFalse(isSentence("《北京》"));
      assertFalse(isSentence(""));
    });
  });

  describe("capitaliseWord", () => {
    it("capitalises the first letter", () => {
      assertIdentical(capitaliseWord("běijīng"), "Běijīng");
    });

    it("leaves a word with no letters alone", () => {
      assertIdentical(capitaliseWord(""), "");
      assertIdentical(capitaliseWord("囧"), "囧");
    });
  });

  describe("capitaliseSentences", () => {
    it("capitalises the first letter of the text", () => {
      assertIdentical(
        capitaliseSentences("zhè shì wǒ de shū."),
        "Zhè shì wǒ de shū.",
      );
    });

    it("capitalises after each sentence ending", () => {
      assertIdentical(
        capitaliseSentences("nǐ hǎo. wǒ hěn hǎo! nǐ ne?"),
        "Nǐ hǎo. Wǒ hěn hǎo! Nǐ ne?",
      );
    });

    it("capitalises a letter that carries a tone mark", () => {
      assertIdentical(capitaliseSentences("ān quán."), "Ān quán.");
    });

    it("passes over anything that is not a letter to find one", () => {
      assertIdentical(capitaliseSentences('  "hǎo."'), '  "Hǎo."');
    });

    it("leaves a word already capitalised as it is", () => {
      assertIdentical(capitaliseSentences("Běijīng."), "Běijīng.");
    });

    it("capitalises nothing in text with no letters", () => {
      assertIdentical(capitaliseSentences("囧。"), "囧。");
      assertIdentical(capitaliseSentences(""), "");
    });
  });
});

describe("capitalising sentences across separate parts", () => {
  it("capitalises the first letter, wherever it falls", () => {
    assertArrayEquals(capitaliseSentenceParts(["zhè", " ", "shì"]), [
      "Zhè",
      " ",
      "shì",
    ]);
  });

  it("finds the next sentence in a later part", () => {
    assertArrayEquals(capitaliseSentenceParts(["hǎo", ". ", "zhè"]), [
      "Hǎo",
      ". ",
      "Zhè",
    ]);
  });

  it("passes over a part that has no letter in it at all", () => {
    assertArrayEquals(capitaliseSentenceParts(["“", "hǎo"]), ["“", "Hǎo"]);
  });
});
