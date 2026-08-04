import {
  dictionaryOf,
  entry,
  reading,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  convert as convert_,
  convertGreedily,
  convertPieces,
  type ConvertOptions,
  joinPieces,
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

/**
 * A dictionary holding the two shapes 重叠 arrives in: 干干净净 as one entry,
 * and 研究 as an entry the text repeats.
 */
const reduplicating = dictionaryOf([
  entry("干", "gān"),
  entry("净", "jìng"),
  entry("研", "yán"),
  entry("究", "jiū"),
  entry("干干净净", "gān gān jìng jìng", { frequency: 300 }),
  entry("研究", "yán jiū", { frequency: 4000 }),
]);

describe("word grouping", () => {
  it("writes the generic half of a place name separately", () => {
    assertIdentical(lattice("北京市"), "Běijīng Shì");
  });

  it("leaves the grouping alone when asked", () => {
    assertIdentical(lattice("北京市", { grouping: false }), "Běijīngshì");
  });

  it("writes a reduplication with the hyphen inside it", () => {
    // GB/T 16159 6.1.3: one orthographic word, with the boundary between its
    // halves marked rather than spaced.
    assertIdentical(convert_(reduplicating, "干干净净"), "gāngān-jìngjìng");
    assertIdentical(convert_(reduplicating, "研究研究"), "yánjiū-yánjiū");
  });

  it("writes a space instead when the grouping is off", () => {
    assertIdentical(
      convert_(reduplicating, "研究研究", { grouping: false }),
      "yánjiū yánjiū",
    );
  });
});

describe("converting to pieces", () => {
  it("joins back to exactly what convert writes", () => {
    for (const text of [
      "银行",
      "北京市",
      "我是银行。",
      "3D银行",
      "西安",
      "玩儿",
    ]) {
      assertIdentical(
        joinPieces(convertPieces(dictionary, text)),
        convert_(dictionary, text),
      );
    }
  });

  it("keeps one piece per syllable, with the syllable beside it", () => {
    const pieces = convertPieces(dictionary, "银行");
    assertArrayEquals(
      pieces.map((piece) => piece.text),
      ["yín", "háng"],
    );
    assertIdentical(pieces[0]?.syllable?.final, "in");
  });

  it("writes the text between the syllables as pieces of its own", () => {
    assertArrayEquals(
      convertPieces(dictionary, "北京银行").map((piece) => piece.text),
      ["Běi", "jīng", " ", "yín", "háng"],
    );
  });

  it("reports no syllable for text that was never Han", () => {
    const pieces = convertPieces(dictionary, "3D银行");
    assertUndefined(pieces[0]?.syllable);
    assertIdentical(pieces[0]?.text, "3D");
  });

  it("reports what each syllable was chosen over", () => {
    const pieces = convertPieces(dictionary, "银行");
    assertTrue(pieces[0]?.confidence?.isLocked ?? false);
    assertArrayLength(pieces[1]?.confidence?.alternatives ?? [], 2);
  });

  it("keeps confidence beside the syllable through the orthography", () => {
    // 北京市 is regrouped into two words and capitalised, and the pieces still
    // line up with the readings they were decoded from.
    const pieces = convertPieces(dictionary, "北京市");
    assertArrayEquals(
      pieces.map((piece) => piece.text),
      ["Běi", "jīng", " ", "Shì"],
    );
    assertTrue(
      pieces.every(
        (piece) => piece.syllable !== undefined || piece.text === " ",
      ),
    );
  });

  it("keeps confidence for a locale reading that lines up", () => {
    const pieces = convertPieces(dictionary, "垃圾", { locale: "zh-TW" });
    assertArrayEquals(
      pieces.map((piece) => piece.text),
      ["lè", "sè"],
    );
    assertTrue(pieces.every((piece) => piece.confidence !== undefined));
  });

  it("reports no confidence for a locale reading of a different length", () => {
    // 那儿 read as one syllable in one locale and two in the other: there is
    // no syllable of the 國語 reading to hang the 普通话 decode's choice on.
    const split = dictionaryOf([
      entry("那", "nà"),
      entry("儿", "ér"),
      entry("那儿", "nàr", {
        readings: { cn: reading("nàr"), tw: reading("nà ér") },
        frequency: 500,
      }),
    ]);
    const pieces = convertPieces(split, "那儿", { locale: "zh-TW" });
    assertArrayEquals(
      pieces.map((piece) => piece.text),
      ["nà", "'ér"],
    );
    assertTrue(pieces.every((piece) => piece.confidence === undefined));
  });
});
