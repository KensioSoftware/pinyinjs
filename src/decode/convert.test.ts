import { sampleDictionary } from "#test/fixtures/decoder-dictionary.js";
import { assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { convertGreedily, type ConvertOptions } from "./convert.js";

const dictionary = sampleDictionary();

/**
 * Convert with the shared test dictionary.
 */
function convert(text: string, options?: ConvertOptions): string {
  return convertGreedily(dictionary, text, options);
}

describe("converting with the greedy baseline", () => {
  it("writes a word's reading with tone marks", () => {
    assertIdentical(convert("银行"), "yínháng");
  });

  it("separates the words it matched", () => {
    assertIdentical(convert("北京银行"), "Běijīng yínháng");
  });

  it("capitalises a proper noun", () => {
    assertIdentical(convert("北京"), "Běijīng");
  });

  it("passes non-Han text through untouched", () => {
    assertIdentical(convert("北京。"), "Běijīng。");
    // The digit and the letter are left exactly as written — reading them
    // aloud belongs to the numerals package, not here.
    assertIdentical(convert("3D银行"), "3Dyínháng");
    assertIdentical(convert("《北京》"), "《Běijīng》");
  });

  it("keeps a character it cannot read, rather than dropping it", () => {
    assertIdentical(convert("囧"), "囧");
  });

  it("applies 一 sandhi across the words it matched", () => {
    assertIdentical(convert("一个"), "yí gè");
    assertIdentical(convert("一天"), "yì tiān");
  });

  it("applies 不 sandhi across a word boundary", () => {
    assertIdentical(convert("不是"), "bú shì");
    assertIdentical(convert("不好"), "bù hǎo");
  });

  it("does not write third-tone sandhi by default", () => {
    assertIdentical(convert("好好"), "hǎo hǎo");
  });

  it("writes third-tone sandhi when asked", () => {
    assertIdentical(
      convert("好好", { sandhi: { thirdTone: true } }),
      "háo hǎo",
    );
  });

  it("writes numbered tones when asked", () => {
    assertIdentical(convert("银行", { notation: "numbers" }), "yin2hang2");
  });

  it("writes no tones when asked", () => {
    assertIdentical(convert("银行", { notation: "none" }), "yinhang");
  });

  it("takes the zh-TW reading where one differs", () => {
    assertIdentical(convert("垃圾"), "lājī");
    assertIdentical(convert("垃圾", { locale: "zh-TW" }), "lèsè");
  });

  it("falls back to the zh-CN reading where no delta is stored", () => {
    assertIdentical(convert("银行", { locale: "zh-TW" }), "yínháng");
  });

  it("reads 儿化 as one syllable", () => {
    assertIdentical(convert("玩儿"), "wánr");
  });

  it("converts a whole sentence, punctuation and all", () => {
    assertIdentical(convert("北京银行。"), "Běijīng yínháng。");
  });

  it("converts empty text to nothing", () => {
    assertIdentical(convert(""), "");
  });
});
