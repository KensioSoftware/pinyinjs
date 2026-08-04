import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertMapSize,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { CedictEntry } from "../sources/cedict.js";
import type { JiebaEntry } from "../sources/jieba.js";
import type { UnihanReadings, UnihanVariants } from "../sources/unihan.js";
import { writeSyllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import { mergeSources, type MergeSources } from "./merge.js";

/**
 * A CC-CEDICT entry, with the fields the merge reads.
 */
function cedictEntry(
  traditional: string,
  simplified: string,
  readings: string,
  extra: Partial<CedictEntry> = {},
): CedictEntry {
  return {
    traditional,
    simplified,
    readings: readings.split(" "),
    isProperNoun: false,
    definitions: ["a definition"],
    ...extra,
  };
}

/**
 * Sources with nothing in them, for tests to add only what they need to.
 */
function sources(overrides: Partial<MergeSources> = {}): MergeSources {
  return {
    unihanReadings: new Map<string, UnihanReadings>(),
    unihanVariants: { simplified: new Map(), traditional: new Map() },
    phrase: new Map<string, readonly string[]>(),
    cedict: [],
    jieba: new Map<string, JiebaEntry>(),
    ...overrides,
  };
}

/**
 * The merged entries, keyed by their 简体 form.
 */
function merge(overrides: Partial<MergeSources> = {}): {
  readonly byWord: ReadonlyMap<string, DictionaryEntry>;
  readonly result: ReturnType<typeof mergeSources>;
} {
  const result = mergeSources(sources(overrides));
  return {
    byWord: new Map(result.entries.map((entry) => [entry.hans, entry])),
    result,
  };
}

/**
 * A word's reading, written back out.
 */
function reading(
  byWord: ReadonlyMap<string, DictionaryEntry>,
  word: string,
): string | undefined {
  const entry = byWord.get(word);
  return entry?.readings.cn
    .map((syllable) => writeSyllable(syllable))
    .join(" ");
}

/**
 * Unihan readings for the characters the tests use.
 */
const CHARACTERS: ReadonlyMap<string, UnihanReadings> = new Map([
  ["银", { readings: ["yín"] }],
  ["行", { readings: ["xíng", "háng", "héng"] }],
  ["头", { readings: ["tóu"] }],
  ["发", { readings: ["fā", "fà"] }],
  ["还", { readings: ["hái", "huán"] }],
  ["是", { readings: ["shì"] }],
  ["玩", { readings: ["wán"] }],
  ["儿", { readings: ["ér"] }],
  ["女", { readings: ["nǚ"] }],
  ["大", { readings: ["dà"] }],
  ["夫", { readings: ["fū"] }],
  ["万", { readings: ["wàn", "mò"], taiwanReading: "mò" }],
]);

const VARIANTS: UnihanVariants = {
  simplified: new Map(),
  traditional: new Map([
    ["发", ["發", "髮"]],
    ["头", ["头", "頭"]],
    ["儿", ["兒"]],
    ["万", ["万", "萬"]],
  ]),
};

describe("merging the sources", () => {
  describe("readings", () => {
    it("takes a word's reading from the phrase corpus", () => {
      const { byWord } = merge({
        phrase: new Map([["银行", ["yín", "háng"]]]),
      });
      assertIdentical(reading(byWord, "银行"), "yín háng");
    });

    it("takes a character's reading from Unihan, most likely first", () => {
      const { byWord } = merge({ unihanReadings: CHARACTERS });
      assertIdentical(reading(byWord, "行"), "xíng");
    });

    it("keeps a character's other readings as polyphone priors", () => {
      const { byWord } = merge({ unihanReadings: CHARACTERS });
      assertIdentical(
        (byWord.get("行")?.alternates ?? [])
          .map((alternate) => alternate.map((s) => writeSyllable(s)).join(""))
          .join(","),
        "háng,héng",
      );
    });

    it("gives a multi-character word no priors", () => {
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["银行", ["yín", "háng"]]]),
      });
      assertUndefined(byWord.get("银行")?.alternates);
    });

    it("falls back to CC-CEDICT for a word the phrase corpus lacks", () => {
      const { byWord } = merge({
        cedict: [cedictEntry("銀行", "银行", "yin2 hang2")],
      });
      assertIdentical(reading(byWord, "银行"), "yín háng");
    });

    it("normalises 一 and 不 sandhi out", () => {
      const { byWord } = merge({
        phrase: new Map([["一不小心", ["yí", "bù", "xiǎo", "xīn"]]]),
      });
      assertIdentical(reading(byWord, "一不小心"), "yī bù xiǎo xīn");
    });

    it("drops a word no source can be read", () => {
      const { byWord, result } = merge({
        cedict: [cedictEntry("3D打印", "3D打印", "san1 D da3 yin4")],
      });
      assertUndefined(byWord.get("3D打印"));
      assertMapSize(result.rejected, 1);
      assertIdentical(result.stats.rejected, 1);
    });
  });

  describe("conflicts between the sources", () => {
    it("takes CC-CEDICT's neutral tone over the phrase corpus's full one", () => {
      const { byWord, result } = merge({
        phrase: new Map([["头发", ["tóu", "fà"]]]),
        cedict: [cedictEntry("頭髮", "头发", "tou2 fa5")],
      });
      assertIdentical(reading(byWord, "头发"), "tóu fa");
      assertIdentical(result.stats.neutralToneCorrections, 1);
    });

    it("takes it for 还是 too", () => {
      const { byWord } = merge({
        phrase: new Map([["还是", ["hái", "shì"]]]),
        cedict: [cedictEntry("還是", "还是", "hai2 shi5")],
      });
      assertIdentical(reading(byWord, "还是"), "hái shi");
    });

    it("keeps the phrase corpus's syllable where the two disagree on more", () => {
      // Only the tone is taken, and only when CC-CEDICT's is neutral.
      const { byWord } = merge({
        phrase: new Map([["银行", ["yín", "háng"]]]),
        cedict: [cedictEntry("銀行", "银行", "yin2 xing2")],
      });
      assertIdentical(reading(byWord, "银行"), "yín háng");
    });

    it("ignores a CC-CEDICT sense of a different length", () => {
      // 玩儿 is one syllable once repaired, and the second sense here is two.
      // A sense of a different length describes a different pronunciation, so
      // there is nothing to correct against it.
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["玩儿", ["wán", "er"]]]),
        cedict: [
          cedictEntry("玩兒", "玩儿", "wan2 r5"),
          cedictEntry("玩兒", "玩儿", "wan2 er5"),
        ],
      });
      assertIdentical(reading(byWord, "玩儿"), "wánr");
    });

    it("makes no correction when every sense is a different length", () => {
      const { byWord, result } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["女儿", ["nǚ", "ér"]]]),
        cedict: [cedictEntry("女兒", "女儿", "nu:3 r5")],
      });
      // CC-CEDICT marks 儿化, so the reading collapses to one syllable and its
      // own two-syllable phrase reading is gone; nothing is left to correct.
      assertIdentical(reading(byWord, "女儿"), "nǚr");
      assertIdentical(result.stats.neutralToneCorrections, 0);
    });

    it("compares against the nearest sense when a word has several", () => {
      const { byWord } = merge({
        phrase: new Map([["行长", ["háng", "zhǎng"]]]),
        cedict: [
          cedictEntry("行長", "行长", "xing2 zhang3"),
          cedictEntry("行長", "行长", "hang2 zhang5"),
        ],
      });
      assertIdentical(reading(byWord, "行长"), "háng zhang");
    });
  });

  describe("儿化", () => {
    it("repairs the phrase corpus's separate er syllable", () => {
      const { byWord, result } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["玩儿", ["wán", "er"]]]),
        cedict: [cedictEntry("玩兒", "玩儿", "wan2 r5")],
      });
      assertIdentical(reading(byWord, "玩儿"), "wánr");
      assertIdentical(result.stats.erhuaRepairs, 1);
    });

    it("follows CC-CEDICT when it says a word is not 儿化", () => {
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["女儿", ["nǚ", "ér"]]]),
        cedict: [cedictEntry("女兒", "女儿", "nu:3 er2")],
      });
      assertIdentical(reading(byWord, "女儿"), "nǚ ér");
    });

    it("consults the exception list where CC-CEDICT is silent", () => {
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([
          ["女儿", ["nǚ", "ér"]],
          ["玩儿", ["wán", "er"]],
        ]),
      });
      assertIdentical(reading(byWord, "女儿"), "nǚ ér");
      assertIdentical(reading(byWord, "玩儿"), "wánr");
    });

    it("takes CC-CEDICT's whole reading when the 儿化 is mid-word", () => {
      // 一点儿事 is three syllables over four characters, and the trailing
      // repair cannot reach it. Only CC-CEDICT's r5 says where it belongs.
      const { byWord, result } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["一点儿事", ["yī", "diǎn", "er", "shì"]]]),
        cedict: [cedictEntry("一點兒事", "一点儿事", "yi1 dian3 r5 shi4")],
      });
      assertIdentical(reading(byWord, "一点儿事"), "yī diǎnr shì");
      assertIdentical(result.stats.erhuaRepairs, 1);
    });

    it("leaves a mid-word 儿 alone when CC-CEDICT does not mark it", () => {
      // 儿童 is a word in its own right, not a suffix.
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["少年儿童", ["shào", "nián", "ér", "tóng"]]]),
      });
      assertIdentical(reading(byWord, "少年儿童"), "shào nián ér tóng");
    });

    it("keeps the alignment, so the 繁體 form still converts both characters", () => {
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        unihanVariants: VARIANTS,
        phrase: new Map([["玩儿", ["wán", "er"]]]),
      });
      assertIdentical(byWord.get("玩儿")?.hant, "玩兒");
    });
  });

  describe("overrides", () => {
    it("has the last word over both sources", () => {
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["大夫", ["dà", "fū"]]]),
        cedict: [cedictEntry("大夫", "大夫", "da4 fu1")],
      });
      assertIdentical(reading(byWord, "大夫"), "dài fu");
    });
  });

  describe("繁體 forms", () => {
    it("takes CC-CEDICT's where it has one", () => {
      const { byWord } = merge({
        phrase: new Map([["银行", ["yín", "háng"]]]),
        cedict: [cedictEntry("銀行", "银行", "yin2 hang2")],
      });
      assertIdentical(byWord.get("银行")?.hant, "銀行");
    });

    it("derives one using the reading where CC-CEDICT is silent", () => {
      const { byWord, result } = merge({
        unihanReadings: new Map([
          ...CHARACTERS,
          ["發", { readings: ["fā", "fà"] }],
          ["髮", { readings: ["fà"] }],
          ["頭", { readings: ["tóu"] }],
        ]),
        unihanVariants: VARIANTS,
        phrase: new Map([["头发", ["tóu", "fà"]]]),
      });
      assertIdentical(byWord.get("头发")?.hant, "頭髮");
      assertTrue(result.stats.derivedTraditional >= 1);
    });

    it("takes the sense matching the reading, not whichever came first", () => {
      // 万 is 萬 read wàn and 万 read mò, and CC-CEDICT carries both.
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        unihanVariants: VARIANTS,
        cedict: [
          cedictEntry("万", "万", "Mo4"),
          cedictEntry("萬", "万", "wan4"),
        ],
      });
      assertIdentical(reading(byWord, "万"), "wàn");
      assertIdentical(byWord.get("万")?.hant, "萬");
    });

    it("leaves a word whose scripts agree", () => {
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["大夫", ["dà", "fū"]]]),
      });
      assertIdentical(byWord.get("大夫")?.hant, "大夫");
    });
  });

  describe("zh-TW readings", () => {
    it("takes CC-CEDICT's Taiwan note", () => {
      const { byWord, result } = merge({
        phrase: new Map([["垃圾", ["lā", "jī"]]]),
        cedict: [
          cedictEntry("垃圾", "垃圾", "la1 ji1", {
            taiwanReadings: ["le4", "se4"],
          }),
        ],
      });
      assertIdentical(
        byWord
          .get("垃圾")
          ?.readings.tw?.map((s) => writeSyllable(s))
          .join(" "),
        "lè sè",
      );
      assertIdentical(result.stats.taiwanReadings, 1);
    });

    it("takes Unihan's second kMandarin value for a character", () => {
      const { byWord } = merge({ unihanReadings: CHARACTERS });
      assertIdentical(
        byWord
          .get("万")
          ?.readings.tw?.map((s) => writeSyllable(s))
          .join(""),
        "mò",
      );
    });

    it("stores nothing when the two locales agree", () => {
      const { byWord } = merge({
        phrase: new Map([["垃圾", ["lā", "jī"]]]),
        cedict: [
          cedictEntry("垃圾", "垃圾", "la1 ji1", {
            taiwanReadings: ["la1", "ji1"],
          }),
        ],
      });
      assertUndefined(byWord.get("垃圾")?.readings.tw);
    });
  });

  describe("frequency, part of speech and proper nouns", () => {
    it("takes the frequency and tag from jieba", () => {
      const { byWord } = merge({
        phrase: new Map([["北京", ["běi", "jīng"]]]),
        jieba: new Map([["北京", { frequency: 34_488, partOfSpeech: "ns" }]]),
      });
      assertIdentical(byWord.get("北京")?.frequency, 34_488);
      assertIdentical(byWord.get("北京")?.partOfSpeech, "ns");
      assertTrue(byWord.get("北京")?.isProperNoun ?? false);
    });

    it("gives a word jieba does not list a frequency of zero", () => {
      const { byWord } = merge({
        phrase: new Map([["银行", ["yín", "háng"]]]),
      });
      assertIdentical(byWord.get("银行")?.frequency, 0);
      assertIdentical(byWord.get("银行")?.partOfSpeech, "");
    });

    it("does not treat an ordinary jieba tag as a proper noun", () => {
      const { byWord } = merge({
        phrase: new Map([["银行", ["yín", "háng"]]]),
        jieba: new Map([["银行", { frequency: 7684, partOfSpeech: "n" }]]),
      });
      assertFalse(byWord.get("银行")?.isProperNoun ?? true);
    });

    it("lets CC-CEDICT's capitalisation decide only where jieba is silent", () => {
      const { byWord } = merge({
        cedict: [
          cedictEntry("巴黎", "巴黎", "Ba1 li2", { isProperNoun: true }),
        ],
      });
      assertTrue(byWord.get("巴黎")?.isProperNoun ?? false);
    });

    it("prefers jieba's verdict over CC-CEDICT's capitalisation", () => {
      const { byWord } = merge({
        cedict: [
          cedictEntry("巴黎", "巴黎", "Ba1 li2", { isProperNoun: true }),
        ],
        jieba: new Map([["巴黎", { frequency: 10, partOfSpeech: "n" }]]),
      });
      assertFalse(byWord.get("巴黎")?.isProperNoun ?? true);
    });
  });

  describe("the result", () => {
    it("orders entries by their 简体 form", () => {
      const { result } = merge({
        phrase: new Map([
          ["银行", ["yín", "háng"]],
          ["大夫", ["dà", "fū"]],
        ]),
      });
      const keys = result.entries.map((entry) => entry.hans);
      assertArrayEquals(
        keys,
        [...keys].toSorted((left, right) => left.localeCompare(right)),
      );
    });

    it("counts what it did", () => {
      const { result } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["银行", ["yín", "háng"]]]),
        cedict: [cedictEntry("銀行", "银行", "yin2 hang2")],
      });
      assertIdentical(result.stats.characters, CHARACTERS.size);
      assertIdentical(result.stats.phraseWords, 1);
      assertIdentical(result.stats.cedictWords, 1);
      assertNonNullable(result.stats.scriptPairs);
    });

    it("merges nothing from nothing", () => {
      const { result } = merge();
      assertArrayLength(result.entries, 0);
    });
  });
});
