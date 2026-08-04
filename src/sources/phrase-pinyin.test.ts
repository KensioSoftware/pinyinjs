import {
  assertArrayEquals,
  assertMapSize,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { parsePhrasePinyin } from "./phrase-pinyin.js";

/**
 * Real lines from `large_pinyin.txt`, including the malformed ones it carries.
 */
const SAMPLE = [
  "# version: 0.19.0",
  "# source: https://github.com/mozillazg/phrase-pinyin-data",
  "银行: yín háng",
  "长城: cháng chéng",
  "中国人: zhōng guó rén",
  "玩儿: wán er",
  "一不小心: yí bù xiǎo xīn",
  "一丁不识: yī dīng bù shí",
  // The one line upstream carrying an inline comment, verbatim.
  "地藏: dì zàng #包括一切 地藏xxx ，比如地藏寺、地藏王、地藏菩萨等等",
  "没有冒号",
].join("\n");

describe("phrase pinyin source", () => {
  describe("parsePhrasePinyin", () => {
    it("reads a word's syllables", () => {
      const entries = parsePhrasePinyin(SAMPLE);
      assertArrayEquals(entries.get("银行") ?? [], ["yín", "háng"]);
      assertArrayEquals(entries.get("中国人") ?? [], ["zhōng", "guó", "rén"]);
    });

    it("keeps a word whose reading carries a trailing comment", () => {
      // 地藏 is a real word; the comment after it contributed three
      // non-syllables to the inventory before this was handled.
      const entries = parsePhrasePinyin(SAMPLE);
      assertArrayEquals(entries.get("地藏") ?? [], ["dì", "zàng"]);
    });

    it("drops the header lines, which are comments containing a colon", () => {
      const entries = parsePhrasePinyin(SAMPLE);
      assertUndefined(entries.get("# version"));
      assertUndefined(entries.get("# source"));
      assertMapSize(entries, 7);
    });

    it("skips a line whose reading is nothing but a comment", () => {
      const entries = parsePhrasePinyin("银行: # no reading here");
      assertUndefined(entries.get("银行"));
    });

    it("skips a line with no separator", () => {
      assertUndefined(parsePhrasePinyin(SAMPLE).get("没有冒号"));
    });

    it("returns readings exactly as written, defects and all", () => {
      // The parser does not repair anything: 玩儿 is given as two syllables
      // rather than as erhua, and 一 sandhi is baked in inconsistently. Both
      // are fixed downstream, and the tests for that repair depend on these
      // arriving unmodified.
      const entries = parsePhrasePinyin(SAMPLE);
      assertArrayEquals(entries.get("玩儿") ?? [], ["wán", "er"]);
      assertArrayEquals(entries.get("一不小心") ?? [], [
        "yí",
        "bù",
        "xiǎo",
        "xīn",
      ]);
      assertArrayEquals(entries.get("一丁不识") ?? [], [
        "yī",
        "dīng",
        "bù",
        "shí",
      ]);
    });

    it("returns nothing for an empty file", () => {
      assertMapSize(parsePhrasePinyin(""), 0);
    });
  });
});
