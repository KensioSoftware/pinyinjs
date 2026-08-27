/**
 * What must hold of an entry's own fields.
 *
 * The proper noun bit and the 繁體 form are both derived rather than taken from
 * one source, so each is asserted where the derivation is known to be delicate.
 */
import { writeSyllable } from "../syllable/syllable.js";
import type { BuildAssertion, BuiltDictionary } from "./built-dictionary.js";

export const ENTRY_INVARIANTS: readonly BuildAssertion[] = [
  {
    description: "北京 is a proper noun (jieba POS carried through)",
    check: (dictionary: BuiltDictionary): string | undefined =>
      dictionary.get("北京")?.isProperNoun === true
        ? undefined
        : "北京 is not marked as a proper noun",
  },
  {
    // jieba tags all four of these a proper noun; CC-CEDICT writes their
    // pinyin in lower case, and the decoder capitalises straight off this bit.
    description: "沙发, 城市, 阿姨 and 长大 are not proper nouns",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const wrong = ["沙发", "城市", "阿姨", "长大"].filter(
        (word) => dictionary.get(word)?.isProperNoun === true,
      );
      return wrong.length === 0
        ? undefined
        : `marked as proper nouns: ${wrong.join(", ")}`;
    },
  },
  {
    // The veto only demotes. These stay proper nouns, and 人民政府 is the
    // control that shows the veto still fires on an institution.
    description: "齐白石, 国务院 and 湖北 stay proper nouns",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const wrong = ["齐白石", "国务院", "湖北"].filter(
        (word) => dictionary.get(word)?.isProperNoun !== true,
      );
      return wrong.length === 0
        ? undefined
        : `no longer proper nouns: ${wrong.join(", ")}`;
    },
  },
  {
    // A capitalised sense that only says `see 長壽區|长寿区` is the district's
    // capital, not the word's. 保安 and 京都 are the control: both hold a
    // lowercase sense too, and both state their proper noun rather than
    // pointing at it.
    description: "长寿, 友谊 and 温泉 are not proper nouns, 保安 and 京都 are",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const wrong = ["长寿", "友谊", "温泉"].filter(
        (word) => dictionary.get(word)?.isProperNoun === true,
      );
      const missing = ["保安", "京都"].filter(
        (word) => dictionary.get(word)?.isProperNoun !== true,
      );
      if (wrong.length > 0) {
        return `marked as proper nouns: ${wrong.join(", ")}`;
      }
      return missing.length === 0
        ? undefined
        : `no longer proper nouns: ${missing.join(", ")}`;
    },
  },
  {
    // Nothing else is left to read where every sense refers on, so the
    // cross-reference is taken at its word. 2,347 flagged keys sit here.
    description: "三亚 and 上饶 stay proper nouns on a cross-reference alone",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const wrong = ["三亚", "上饶", "三门峡"].filter(
        (word) => dictionary.get(word)?.isProperNoun !== true,
      );
      return wrong.length === 0
        ? undefined
        : `no longer proper nouns: ${wrong.join(", ")}`;
    },
  },
  {
    // The gap composeLocaleDeltas closes, and the two ways it must not close
    // it. 運行狀況 contains the marked word 行狀 and cuts elsewhere; 一个个地
    // ends in a character whose delta is a different sense of 地 entirely.
    description:
      "垃圾分類 inherits 垃圾's 國語 reading, 運行狀況 inherits nothing",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const taiwan = (word: string): string | undefined =>
        dictionary
          .get(word)
          ?.readings.tw?.map((syllable) => writeSyllable(syllable))
          .join(" ");
      const composed = taiwan("垃圾分类");
      if (composed !== "lè sè fēn lèi") {
        return `垃圾分类 reads ${composed ?? "nothing"} in zh-TW, expected lè sè fēn lèi`;
      }
      const wrong = ["运行状况", "一个个地", "相亲相爱"].filter(
        (word) => taiwan(word) !== undefined,
      );
      return wrong.length === 0
        ? undefined
        : `composed a zh-TW reading for: ${wrong.join(", ")}`;
    },
  },
  {
    description: "头发 derives 頭髮 rather than 頭發",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const hant = dictionary.get("头发")?.hant;
      return hant === "頭髮"
        ? undefined
        : `头发 derived ${hant ?? "nothing"}, expected 頭髮`;
    },
  },
];
