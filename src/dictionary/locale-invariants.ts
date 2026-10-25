/**
 * What must hold of the zh-TW readings.
 *
 * The locale is a delta assembled from three sources and a composition pass,
 * so a refresh of any of them can move it without anything else noticing.
 */
import { writeSyllable } from "../syllable/syllable.js";
import type { BuildAssertion, BuiltDictionary } from "./built-dictionary.js";

export const LOCALE_INVARIANTS: readonly BuildAssertion[] = [
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
    // 教育部's dictionaries are where these come from. CC-CEDICT marks none of
    // the words, and its note on 和 is the conjunction's alone.
    description: "星期 and 头发 read as 教育部 reads them, 和 keeps hé",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const taiwan = (word: string): string | undefined =>
        dictionary
          .get(word)
          ?.readings.tw?.map((syllable) => writeSyllable(syllable))
          .join(" ");
      const wrong = [
        ["星期", "xīng qí"],
        ["头发", "tóu fǎ"],
      ].filter(([word, expected]) => taiwan(word ?? "") !== expected);
      if (wrong.length > 0) {
        return `zh-TW reads ${wrong.map(([word]) => `${word ?? ""} as ${taiwan(word ?? "") ?? "nothing"}`).join(", ")}`;
      }
      const character = taiwan("和");
      return character === undefined
        ? undefined
        : `和 reads ${character} in zh-TW, expected no delta`;
    },
  },
];
