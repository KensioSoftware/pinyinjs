import {
  assertArrayIncludes,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { readSyllable } from "../syllable/syllable.js";
import {
  DEFAULT_REGION,
  isReadingSensitive,
  REGIONS,
  toCanonicalGlyph,
  toCanonicalGlyphs,
  toRegionalGlyph,
  toRegionalGlyphs,
} from "./glyphs.js";

/**
 * Parse a reading, failing the test rather than the assertion if it will not.
 */
function syllable(spelling: string): ReturnType<typeof readSyllable> {
  const parsed = readSyllable(spelling);
  assertNonNullable(parsed);
  return parsed;
}

describe("glyph forms", () => {
  describe("REGIONS", () => {
    it("defaults to Taiwan, which is what the dictionary stores", () => {
      assertIdentical(DEFAULT_REGION, "TW");
      assertArrayIncludes(REGIONS, DEFAULT_REGION);
    });
  });

  describe("toCanonicalGlyph", () => {
    it("normalises the Hong Kong forms toward Taiwan's", () => {
      assertIdentical(toCanonicalGlyph("裏"), "裡");
      assertIdentical(toCanonicalGlyph("羣"), "群");
      assertIdentical(toCanonicalGlyph("峯"), "峰");
      assertIdentical(toCanonicalGlyph("麪"), "麵");
      assertIdentical(toCanonicalGlyph("衞"), "衛");
    });

    it("leaves a character neither standard disagrees about", () => {
      assertIdentical(toCanonicalGlyph("好"), "好");
      assertIdentical(toCanonicalGlyph("中"), "中");
    });

    it("leaves 简体 alone, so mixed text is safe to normalise", () => {
      assertIdentical(toCanonicalGlyph("里"), "里");
      assertIdentical(toCanonicalGlyph("发"), "发");
    });

    it("keeps the variants that are live 繁體 spellings", () => {
      // OpenCC maps each of these onward, but CC-CEDICT writes them as they
      // stand, so rewriting would corrupt spellings someone chose.
      for (const character of ["台", "污", "濕", "睾", "祕", "泄"]) {
        assertIdentical(toCanonicalGlyph(character), character);
      }
    });

    it("keeps the Hong Kong forms that are also 简体 characters", () => {
      // The PRC simplification adopted the same 新字形 conventions Hong Kong
      // did, so normalising these would rewrite 简体 text.
      for (const character of ["着", "温", "脱", "户", "税", "卧", "葱"]) {
        assertIdentical(toCanonicalGlyph(character), character);
      }
    });
  });

  describe("toCanonicalGlyphs", () => {
    it("normalises a whole word so it can find a dictionary key", () => {
      assertIdentical(toCanonicalGlyphs("裏面"), "裡面");
      assertIdentical(toCanonicalGlyphs("羣眾"), "群眾");
      assertIdentical(toCanonicalGlyphs("麪包"), "麵包");
    });

    it("leaves 简体 text exactly as it was written", () => {
      // 走着 is 简体 and 着 is its own character there, not a Hong Kong 著.
      assertIdentical(toCanonicalGlyphs("走着"), "走着");
      assertIdentical(toCanonicalGlyphs("温度"), "温度");
    });

    it("passes text with nothing to normalise through unchanged", () => {
      assertIdentical(toCanonicalGlyphs("你好世界"), "你好世界");
      assertIdentical(toCanonicalGlyphs(""), "");
    });

    it("leaves punctuation and non-Han text alone", () => {
      assertIdentical(toCanonicalGlyphs("裏面，OK！"), "裡面，OK！");
    });

    it("returns the original string when nothing needs normalising", () => {
      const text = "你好世界";
      assertIdentical(toCanonicalGlyphs(text), text);
    });
  });

  describe("toRegionalGlyph", () => {
    it("writes Taiwan by returning what is already stored", () => {
      assertIdentical(toRegionalGlyph("裡", "TW"), "裡");
      assertIdentical(toRegionalGlyph("群", "TW"), "群");
    });

    it("writes the Hong Kong forms", () => {
      assertIdentical(toRegionalGlyph("裡", "HK"), "裏");
      assertIdentical(toRegionalGlyph("群", "HK"), "羣");
      assertIdentical(toRegionalGlyph("臺", "HK"), "台");
      assertIdentical(toRegionalGlyph("麵", "HK"), "麪");
    });

    it("leaves a character the two standards agree about", () => {
      assertIdentical(toRegionalGlyph("為", "HK"), "為");
      assertIdentical(toRegionalGlyph("眾", "HK"), "眾");
      assertIdentical(toRegionalGlyph("好", "HK"), "好");
    });
  });

  describe("the 著 split", () => {
    it("keeps 著 for zhù, which Hong Kong does not write as 着", () => {
      assertIdentical(toRegionalGlyph("著", "HK", syllable("zhu4")), "著");
    });

    it("writes 着 for the aspect particle and its relatives", () => {
      assertIdentical(toRegionalGlyph("著", "HK", syllable("zhe5")), "着");
      assertIdentical(toRegionalGlyph("著", "HK", syllable("zhao2")), "着");
    });

    it("takes the default for zhuó, which the reading cannot settle", () => {
      // CC-CEDICT writes zhuo2 both ways: 著 着 for wearing, 著 著 for 執著.
      assertIdentical(toRegionalGlyph("著", "HK", syllable("zhuo2")), "着");
    });

    it("takes the default when no reading is offered", () => {
      assertIdentical(toRegionalGlyph("著", "HK"), "着");
    });

    it("is reported as reading-sensitive, so a caller can flag it", () => {
      assertTrue(isReadingSensitive("著"));
      assertFalse(isReadingSensitive("裡"));
      assertFalse(isReadingSensitive("好"));
    });
  });

  describe("the 參 split", () => {
    it("writes 蔘 for the ginseng, which is the sense 蔘 covers", () => {
      assertIdentical(toRegionalGlyph("參", "HK", syllable("shen1")), "蔘");
    });

    it("keeps 參 for every other reading it has", () => {
      // 參加 and 參考 are `cān`, 參差 is `cēn`, and the numeral is `sān`. None
      // of them is ginseng, and all four read 參 in Hong Kong.
      assertIdentical(toRegionalGlyph("參", "HK", syllable("can1")), "參");
      assertIdentical(toRegionalGlyph("參", "HK", syllable("cen1")), "參");
      assertIdentical(toRegionalGlyph("參", "HK", syllable("san1")), "參");
    });

    it("keeps 參 when no reading is offered, since cān is far the commonest", () => {
      assertIdentical(toRegionalGlyph("參", "HK"), "參");
    });

    it("is reported as reading-sensitive, so the caller is told it guessed", () => {
      assertTrue(isReadingSensitive("參"));
    });

    it("still normalises Hong Kong's 蔘 back to 參 for a lookup", () => {
      assertIdentical(toCanonicalGlyph("蔘"), "參");
    });
  });

  describe("toRegionalGlyphs", () => {
    it("writes a whole word in the Hong Kong forms", () => {
      assertIdentical(toRegionalGlyphs("裡面", "HK"), "裏面");
      assertIdentical(toRegionalGlyphs("臺灣", "HK"), "台灣");
    });

    it("returns Taiwan text untouched", () => {
      assertIdentical(toRegionalGlyphs("裡面", "TW"), "裡面");
    });

    it("matches readings to characters by position", () => {
      assertIdentical(
        toRegionalGlyphs("著作", "HK", [syllable("zhu4"), syllable("zuo4")]),
        "著作",
      );
      assertIdentical(
        toRegionalGlyphs("看著", "HK", [syllable("kan4"), syllable("zhe5")]),
        "看着",
      );
    });

    it("falls back to the default where a position has no reading", () => {
      assertIdentical(toRegionalGlyphs("看著", "HK", []), "看着");
      // The other way round for 參: the default is the canonical form, so a
      // word with no reading behind it keeps 參 rather than taking 蔘.
      assertIdentical(toRegionalGlyphs("參加", "HK", []), "參加");
    });
  });
});
