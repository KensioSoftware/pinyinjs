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

  it("does not double a space that is already there", () => {
    assertIdentical(toLatinPunctuation("hǎo。 Xià"), "hǎo. Xià");
  });

  it("leaves brackets and quotation marks alone", () => {
    // 《》 marks a title, which the Latin script sets in italics rather than
    // with a bracket, and the quotation styles do not correspond one to one.
    assertIdentical(toLatinPunctuation("《Běijīng》"), "《Běijīng》");
    assertIdentical(toLatinPunctuation("“hǎo”"), "“hǎo”");
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

  it("does not give the last mark a space, whichever part it is in", () => {
    assertArrayEquals(toLatinPunctuationParts(["hǎo", "。"]), ["hǎo", "."]);
  });
});
