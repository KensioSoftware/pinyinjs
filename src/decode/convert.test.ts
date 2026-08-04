import { sampleDictionary } from "#test/fixtures/decoder-dictionary.js";
import { assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  convert as convert_,
  convertGreedily,
  type ConvertOptions,
} from "./convert.js";

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
    // The digit and the letter are left exactly as written — reading them
    // aloud belongs to the numerals package, not here.
    assertIdentical(convert("3D银行"), "3Dyínháng");
    // 《》 marks a title, which the Latin script sets in italics rather than
    // with a bracket, so there is nothing to rewrite it to.
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
    assertIdentical(convert("北京银行。"), "Běijīng yínháng.");
  });

  it("converts empty text to nothing", () => {
    assertIdentical(convert(""), "");
  });
});

/**
 * Convert with the lattice decoder and the shared test dictionary.
 */
function lattice(text: string, options?: ConvertOptions): string {
  return convert_(dictionary, text, options);
}

describe("converting with the lattice", () => {
  it("writes a word's reading with tone marks", () => {
    assertIdentical(lattice("银行"), "yínháng");
  });

  it("separates the words it decoded", () => {
    assertIdentical(lattice("北京银行"), "Běijīng yínháng");
  });

  it("capitalises a proper noun", () => {
    assertIdentical(lattice("北京"), "Běijīng");
  });

  it("passes non-Han text through untouched", () => {
    assertIdentical(lattice("3D银行"), "3Dyínháng");
    assertIdentical(lattice("《北京》"), "《Běijīng》");
  });

  it("applies sandhi across the words it decoded", () => {
    assertIdentical(lattice("一天"), "yì tiān");
    assertIdentical(lattice("不是"), "bú shì");
  });

  it("takes the zh-TW reading where one differs", () => {
    assertIdentical(lattice("垃圾", { locale: "zh-TW" }), "lèsè");
  });

  it("reads 儿化 as one syllable", () => {
    assertIdentical(lattice("玩儿"), "wánr");
  });

  it("keeps a character it cannot read, rather than dropping it", () => {
    assertIdentical(lattice("囧"), "囧");
  });

  it("converts empty text to nothing", () => {
    assertIdentical(lattice(""), "");
  });
});

describe("the orthography options", () => {
  it("writes the 隔音符号 inside a word", () => {
    assertIdentical(lattice("西安"), "Xī'ān");
    assertIdentical(lattice("海鸥"), "hǎi'ōu");
  });

  it("writes only the apostrophes the standard requires when asked", () => {
    // Xīān would read as the single syllable xian, so the mark stays; hǎiōu
    // could not be read any other way, so it goes.
    assertIdentical(lattice("西安", { apostrophe: "standard" }), "Xī'ān");
    assertIdentical(lattice("海鸥", { apostrophe: "standard" }), "hǎiōu");
  });

  it("writes none when asked", () => {
    assertIdentical(lattice("西安", { apostrophe: "never" }), "Xīān");
  });

  it("leaves numbered tones unapostrophised, since they cannot be misread", () => {
    assertIdentical(lattice("西安", { notation: "numbers" }), "Xi1an1");
  });

  it("capitalises the first word of a sentence, but not a word on its own", () => {
    assertIdentical(lattice("银行北京。"), "Yínháng Běijīng.");
    assertIdentical(lattice("银行"), "yínháng");
  });

  it("capitalises after each sentence ending", () => {
    assertIdentical(lattice("银行。北京。"), "Yínháng. Běijīng.");
  });

  it("capitalises proper nouns only when asked", () => {
    assertIdentical(
      lattice("银行北京。", { capitals: "proper" }),
      "yínháng Běijīng.",
    );
  });

  it("writes no capitals at all when asked", () => {
    assertIdentical(
      lattice("银行北京。", { capitals: "none" }),
      "yínháng běijīng.",
    );
  });

  it("keeps the source punctuation when asked", () => {
    assertIdentical(lattice("北京。", { punctuation: "keep" }), "Běijīng。");
  });
});
