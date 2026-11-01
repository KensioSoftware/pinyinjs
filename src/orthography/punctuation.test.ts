import { assertArrayEquals, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { toLatinPunctuation, toLatinPunctuationParts } from "./punctuation.js";

describe("rewriting punctuation in the Latin script", () => {
  it("writes the marks with an exact equivalent", () => {
    assertIdentical(
      toLatinPunctuation("Wǒ yào qù Běijīng。"),
      "Wǒ yào qù Běijīng.",
    );
    assertIdentical(toLatinPunctuation("Nǐ hǎo？"), "Nǐ hǎo?");
    assertIdentical(toLatinPunctuation("Nǐ hǎo！"), "Nǐ hǎo!");
  });

  it("gives a mark the space its full-width form carried in the glyph", () => {
    assertIdentical(toLatinPunctuation("Nǐ hǎo，shìjiè"), "Nǐ hǎo, shìjiè");
    assertIdentical(toLatinPunctuation("chá、kāfēi"), "chá, kāfēi");
    assertIdentical(toLatinPunctuation("tā shuō：hǎo"), "tā shuō: hǎo");
  });

  it("does not leave a trailing space at the end of the text", () => {
    assertIdentical(toLatinPunctuation("hǎo。"), "hǎo.");
  });

  it("gives a mark no space before a closing quotation mark or bracket", () => {
    // Given a full stop inside a quotation, and a comma inside a bracket
    // When the punctuation is rewritten
    // Then the closing mark follows straight on
    assertIdentical(toLatinPunctuation("“nǐ hǎo。”"), "“nǐ hǎo.”");
    assertIdentical(toLatinPunctuation("「nǐ hǎo！」"), "「nǐ hǎo!」");
    assertIdentical(toLatinPunctuation("（hǎo，hǎo）"), "（hǎo, hǎo）");
  });

  it("spaces what follows from the closing mark instead", () => {
    // Given a comma inside a quotation, with the sentence going on after it
    // When the punctuation is rewritten
    // Then the space the comma carried comes after the closing mark
    assertIdentical(
      toLatinPunctuation("“wǒ huì huílai，”Tāngmǔ shuō。"),
      "“wǒ huì huílai,” Tāngmǔ shuō.",
    );
    assertIdentical(toLatinPunctuation("（hǎo。）Zhè"), "（hǎo.） Zhè");
    assertIdentical(toLatinPunctuation("（“hǎo。”）Zhè"), "（“hǎo.”） Zhè");
  });

  it("does not double a space that is already there", () => {
    assertIdentical(toLatinPunctuation("hǎo。 Xià"), "hǎo. Xià");
  });

  it("leaves brackets and quotation marks alone", () => {
    // 《》 marks a title, which the Latin script sets in italics rather than
    // with a bracket, and the quotation styles do not correspond one to one.
    assertIdentical(toLatinPunctuation("《Běijīng》"), "《Běijīng》");
    assertIdentical(toLatinPunctuation("“hǎo”"), "“hǎo”");
    assertIdentical(toLatinPunctuation("”hǎo"), "”hǎo");
  });

  it("leaves text with nothing to rewrite exactly as it was", () => {
    assertIdentical(toLatinPunctuation("Běijīng yínháng"), "Běijīng yínháng");
    assertIdentical(toLatinPunctuation(""), "");
  });
});

describe("rewriting punctuation across separate parts", () => {
  it("rewrites the marks wherever they fall", () => {
    assertArrayEquals(toLatinPunctuationParts(["Běijīng", "。"]), [
      "Běijīng",
      ".",
    ]);
  });

  it("looks past a part boundary for what follows a mark", () => {
    // The comma takes a space because a syllable follows it, even though that
    // syllable is in the next part.
    assertArrayEquals(toLatinPunctuationParts(["hǎo", "，", "shìjiè"]), [
      "hǎo",
      ", ",
      "shìjiè",
    ]);
  });

  it("moves the space past a closing mark in the next part", () => {
    assertArrayEquals(toLatinPunctuationParts(["hǎo", "，", "”", "tā"]), [
      "hǎo",
      ",",
      "” ",
      "tā",
    ]);
  });

  it("does not give the last mark a space, whichever part it is in", () => {
    assertArrayEquals(toLatinPunctuationParts(["hǎo", "。"]), ["hǎo", "."]);
  });
});
