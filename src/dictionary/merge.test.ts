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
 * A Unihan entry, with the per-field detail the merge reads.
 *
 * Readings are attributed to `kTGHZ2013` by default, which is the ordinary
 * case: only `kHanyuPinlu` ever omits a tone mark, so a character with no
 * frequency-field reading needs no tone resolved.
 */
function unihan(
  readings: readonly string[],
  extra: Partial<UnihanReadings> = {},
): UnihanReadings {
  return {
    readings,
    fields: new Map([["kTGHZ2013", readings]]),
    ...extra,
  };
}

/**
 * A character as Unihan really records it: the frequency field first, the
 * dictionary fields after.
 *
 * Only `kHanyuPinlu` ever omits a tone mark, so this is the shape the tone
 * resolution has to reason about.
 */
function withFrequencyField(
  frequency: readonly string[],
  dictionaries: readonly string[],
): UnihanReadings {
  return {
    readings: [...new Set([...frequency, ...dictionaries])],
    fields: new Map([
      ["kHanyuPinlu", frequency],
      ["kTGHZ2013", dictionaries],
    ]),
  };
}

/**
 * Unihan readings for the characters the tests use.
 */
const CHARACTERS: ReadonlyMap<string, UnihanReadings> = new Map([
  ["银", unihan(["yín"])],
  ["行", unihan(["xíng", "háng", "héng"])],
  ["头", unihan(["tóu"])],
  ["发", unihan(["fā", "fà"])],
  ["还", unihan(["hái", "huán"])],
  ["是", unihan(["shì"])],
  ["玩", unihan(["wán"])],
  ["儿", unihan(["ér"])],
  ["女", unihan(["nǚ"])],
  ["大", unihan(["dà"])],
  ["夫", unihan(["fū"])],
  ["万", unihan(["wàn", "mò"], { taiwanReading: "mò" })],
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

  describe("tones kHanyuPinlu leaves off", () => {
    it("restores a tone the frequency field omitted", () => {
      // 李 is `li(36)` in kHanyuPinlu and `lǐ` everywhere else. Read as 轻声,
      // 李华 comes out `Li Huá`.
      const { byWord } = merge({
        unihanReadings: new Map([["李", withFrequencyField(["li"], ["lǐ"])]]),
      });
      assertIdentical(reading(byWord, "李"), "lǐ");
    });

    it("leaves a genuine 轻声 alone", () => {
      // 们 is bare in every field, so the neutral tone is real.
      const { byWord } = merge({
        unihanReadings: new Map([
          ["们", withFrequencyField(["men"], ["men", "mén"])],
        ]),
      });
      assertIdentical(reading(byWord, "们"), "men");
    });

    it("trusts a frequency field that marks any tone at all", () => {
      // 个 lists gè and ge side by side, so the bare one means 轻声 and the
      // field is evidently marking tones where it means to.
      const { byWord } = merge({
        unihanReadings: new Map([
          ["个", withFrequencyField(["gè", "ge"], ["gè"])],
        ]),
      });
      assertIdentical(reading(byWord, "个"), "gè");
      assertIdentical(
        (byWord.get("个")?.alternates ?? [])
          .map((alternate) => alternate.map((s) => writeSyllable(s)).join(""))
          .join(","),
        "ge",
      );
    });

    it("demotes a 轻声 the field only counted inside words", () => {
      // 西 is `xi(902) xī(738)`, and the 902 are 东西. Left leading, 往西 read
      // `wǎng xi`.
      const { byWord } = merge({
        unihanReadings: new Map([["西", withFrequencyField(["xi", "xī"], [])]]),
      });
      assertIdentical(reading(byWord, "西"), "xī");
    });

    it("keeps the demoted reading as a candidate", () => {
      const { byWord } = merge({
        unihanReadings: new Map([["西", withFrequencyField(["xi", "xī"], [])]]),
      });
      assertArrayEquals(
        (byWord.get("西")?.alternates ?? []).map((alternate) =>
          alternate.map((syllable) => writeSyllable(syllable)).join(""),
        ),
        ["xi"],
      );
    });

    it("holds it where CC-CEDICT reads the bare character 轻声", () => {
      // 吗 is `ma(1456) má(93)`, and CC-CEDICT calls the bare character a
      // question particle. A particle's whole use is the bare character.
      const { byWord } = merge({
        unihanReadings: new Map([["吗", withFrequencyField(["ma", "má"], [])]]),
        cedict: [cedictEntry("嗎", "吗", "ma5", { definitions: ["particle"] })],
      });
      assertIdentical(reading(byWord, "吗"), "ma");
    });

    it("holds it for the 繁體 spelling too", () => {
      const { byWord } = merge({
        unihanReadings: new Map([["嗎", withFrequencyField(["ma", "má"], [])]]),
        cedict: [cedictEntry("嗎", "吗", "ma5", { definitions: ["particle"] })],
      });
      assertIdentical(reading(byWord, "嗎"), "ma");
    });

    it("does not take a suffix sense for a claim about the character", () => {
      // 子's neutral CC-CEDICT headword is `noun suffix, as in 椅子`, which
      // says the character is unstressed in words — and words are what the
      // corpus can already see. A bare 子 is `zǐ`.
      const { byWord } = merge({
        unihanReadings: new Map([["子", withFrequencyField(["zi", "zǐ"], [])]]),
        cedict: [
          cedictEntry("子", "子", "zi5", {
            definitions: ['noun suffix, as in 椅子[yi3 zi5] "chair"'],
          }),
        ],
      });
      assertIdentical(reading(byWord, "子"), "zǐ");
    });

    it("leaves a 轻声 the field never wrote with a tone", () => {
      // 吧 is `ba(2073)` and nothing else, so there is no twin to demote it
      // under and the 语气词 keeps its reading.
      const { byWord } = merge({
        unihanReadings: new Map([["吧", withFrequencyField(["ba"], ["ba"])]]),
      });
      assertIdentical(reading(byWord, "吧"), "ba");
    });

    it("leaves a character with no frequency reading untouched", () => {
      const { byWord } = merge({
        unihanReadings: new Map([
          [
            "囧",
            {
              readings: ["jiǒng"],
              fields: new Map([["kTGHZ2013", ["jiǒng"]]]),
            },
          ],
        ]),
      });
      assertIdentical(reading(byWord, "囧"), "jiǒng");
    });

    it("keeps a bare reading no other field writes with a tone", () => {
      const { byWord } = merge({
        unihanReadings: new Map([["噢", withFrequencyField(["o"], [])]]),
      });
      assertIdentical(reading(byWord, "噢"), "o");
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

    it("makes no correction where the nearest sense already agrees", () => {
      // The shape the 轻声 sense list exists for: 东西's `dong1 xi1` is exactly
      // what the corpus wrote, so it is the nearest sense and has no neutral
      // tone to give. Unlisted, the word keeps the reading it came with.
      const { byWord } = merge({
        phrase: new Map([["买东", ["dōng", "xī"]]]),
        cedict: [
          cedictEntry("買東", "买东", "dong1 xi1"),
          cedictEntry("買東", "买东", "dong1 xi5"),
        ],
      });
      assertIdentical(reading(byWord, "买东"), "dōng xī");
    });

    it("takes the sense that reduces a syllable for a listed word", () => {
      const { byWord } = merge({
        phrase: new Map([["东西", ["dōng", "xī"]]]),
        cedict: [
          cedictEntry("東西", "东西", "dong1 xi1"),
          cedictEntry("東西", "东西", "dong1 xi5"),
        ],
      });
      assertIdentical(reading(byWord, "东西"), "dōng xi");
    });

    it("leaves a listed word alone where no sense reduces one", () => {
      // The list names a word, not a reading, so a CC-CEDICT that stopped
      // carrying the 轻声 sense would leave the word as its sources have it
      // rather than as a hand-typed reading — which is what the build
      // assertion covering the list is there to catch.
      const { byWord } = merge({
        phrase: new Map([["东西", ["dōng", "xī"]]]),
        cedict: [cedictEntry("東西", "东西", "dong1 xi1")],
      });
      assertIdentical(reading(byWord, "东西"), "dōng xī");
    });

    it("takes the listed sense's neutral tone and nothing else of it", () => {
      // Still only the tone, and only where it is neutral: the reduced 手 is
      // taken and the 把 the sense writes `bà` is not.
      const { byWord } = merge({
        phrase: new Map([["把手", ["bǎ", "shǒu"]]]),
        cedict: [
          cedictEntry("把手", "把手", "ba3 shou3"),
          cedictEntry("把手", "把手", "ba4 shou5"),
        ],
      });
      assertIdentical(reading(byWord, "把手"), "bǎ shou");
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

    it("takes no entry from a 繁體 headword in the 简体 corpus", () => {
      // large_pinyin.txt is 简体, and reads the 繁體 headwords it carries
      // anyway as though the characters were 简体: 特徵 is tè zhǐ there,
      // because 徵 alone is zhǐ rather than standing for 征. Left as an entry
      // of its own it outranks the 繁體 key derived from 特征, so the word
      // reads one way in a tier holding the phrase tail and another without.
      const { byWord } = merge({
        phrase: new Map([
          ["特征", ["tè", "zhēng"]],
          ["特徵", ["tè", "zhǐ"]],
        ]),
        cedict: [cedictEntry("特徵", "特征", "te4 zheng1")],
      });
      assertUndefined(byWord.get("特徵"));
      assertIdentical(byWord.get("特征")?.hant, "特徵");
      assertIdentical(reading(byWord, "特征"), "tè zhēng");
    });

    it("keeps a 繁體 headword CC-CEDICT does not pair", () => {
      // The rule is narrow: only CC-CEDICT can say a headword is another
      // word's 繁體 spelling. A rare word it has never heard of is read by its
      // characters, which is the best available answer and worth keeping.
      const { byWord } = merge({
        phrase: new Map([["一箭双鵰", ["yī", "jiàn", "shuāng", "diāo"]]]),
      });
      assertIdentical(reading(byWord, "一箭双鵰"), "yī jiàn shuāng diāo");
    });

    it("derives one using the reading where CC-CEDICT is silent", () => {
      const { byWord, result } = merge({
        unihanReadings: new Map([
          ...CHARACTERS,
          ["發", unihan(["fā", "fà"])],
          ["髮", unihan(["fà"])],
          ["頭", unihan(["tóu"])],
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

    it("keeps every spelling of a word written more than one way", () => {
      // 台湾 is 臺灣 and 台灣, both current and both read the same. Keeping only
      // the first leaves the other converting character by character.
      const { byWord, result } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["台湾", ["tái", "wān"]]]),
        cedict: [
          cedictEntry("台灣", "台湾", "Tai2 wan1"),
          cedictEntry("臺灣", "台湾", "Tai2 wan1"),
        ],
      });
      assertIdentical(byWord.get("台湾")?.hant, "台灣");
      assertArrayEquals(byWord.get("台湾")?.hantVariants ?? [], ["臺灣"]);
      assertIdentical(result.stats.variantSpellings, 1);
    });

    it("keeps only the spellings belonging to the chosen reading", () => {
      // 万 read wàn is 萬; the 万 spelling belongs to mò, a different word, and
      // must not be dragged in as a second spelling of this one.
      const { byWord, result } = merge({
        unihanReadings: CHARACTERS,
        unihanVariants: VARIANTS,
        cedict: [
          cedictEntry("万", "万", "Mo4"),
          cedictEntry("萬", "万", "wan4"),
        ],
      });
      assertIdentical(byWord.get("万")?.hant, "萬");
      assertUndefined(byWord.get("万")?.hantVariants);
      assertIdentical(result.stats.variantSpellings, 0);
    });

    it("records a spelling once however many senses write it", () => {
      const { byWord } = merge({
        phrase: new Map([["银行", ["yín", "háng"]]]),
        cedict: [
          cedictEntry("銀行", "银行", "yin2 hang2"),
          cedictEntry("銀行", "银行", "yin2 hang2"),
        ],
      });
      assertUndefined(byWord.get("银行")?.hantVariants);
    });

    it("guesses no second spelling when no sense could be measured", () => {
      // Readings of a different length describe a different pronunciation, so
      // there is nothing to say the two spellings are the same word.
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        phrase: new Map([["台湾", ["tái", "wān"]]]),
        cedict: [
          cedictEntry("台灣", "台湾", "Tai2"),
          cedictEntry("臺灣", "台湾", "Tai2"),
        ],
      });
      assertIdentical(byWord.get("台湾")?.hant, "台灣");
      assertUndefined(byWord.get("台湾")?.hantVariants);
    });

    it("does not record a spelling that is already the 简体 form", () => {
      const { byWord } = merge({
        unihanReadings: CHARACTERS,
        cedict: [
          cedictEntry("臺", "台", "tai2"),
          cedictEntry("台", "台", "tai2"),
        ],
      });
      assertIdentical(byWord.get("台")?.hant, "臺");
      assertUndefined(byWord.get("台")?.hantVariants);
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

    it("refuses a note that is another 普通话 sense of the word", () => {
      // 地[de5] and 地[di4] are both CC-CEDICT entries, so `dì` is a sense of
      // 地 rather than what 國語 does to it.
      const { byWord } = merge({
        phrase: new Map([["地", ["de"]]]),
        cedict: [
          cedictEntry("地", "地", "de5", { taiwanReadings: ["di4"] }),
          cedictEntry("地", "地", "di4"),
        ],
      });
      assertUndefined(byWord.get("地")?.readings.tw);
    });

    it("looks for that sense under the 繁體 headword too", () => {
      // 沈's other sense is filed under the 简体 form it simplifies to, 沉.
      const { byWord } = merge({
        phrase: new Map([["沈", ["shěn"]]]),
        cedict: [
          cedictEntry("沈", "沈", "shen3", { taiwanReadings: ["chen2"] }),
          cedictEntry("沈", "沉", "chen2"),
        ],
      });
      assertUndefined(byWord.get("沈")?.readings.tw);
    });

    it("keeps a note no 普通话 sense reads that way", () => {
      const { byWord } = merge({
        phrase: new Map([["和", ["hé"]]]),
        cedict: [
          cedictEntry("和", "和", "he2", { taiwanReadings: ["han4"] }),
          cedictEntry("和", "和", "huo4"),
        ],
      });
      assertIdentical(
        byWord
          .get("和")
          ?.readings.tw?.map((s) => writeSyllable(s))
          .join(""),
        "hàn",
      );
    });

    it("refuses a character's note that sits on a later sense", () => {
      // 從's `zòng` is the 侍從 and 從兄弟 senses, all of them bound forms. The
      // character on its own is `cóng` in Taipei as in Beijing, and taking the
      // note made 我从北京来 read `wǒ zòng Běijīng lái`.
      const { byWord } = merge({
        phrase: new Map([["从", ["cóng"]]]),
        cedict: [
          cedictEntry("從", "从", "cong2", {
            taiwanReadings: ["zong4"],
            taiwanScope: "sense",
          }),
        ],
      });
      assertUndefined(byWord.get("从")?.readings.tw);
    });

    it("keeps a character's note where the entry leads with it", () => {
      // 和's `hàn` is the conjunction, which is what a bare 和 nearly always is.
      const { byWord } = merge({
        phrase: new Map([["和", ["hé"]]]),
        cedict: [
          cedictEntry("和", "和", "he2", {
            taiwanReadings: ["han4"],
            taiwanScope: "leading",
          }),
        ],
      });
      assertIdentical(
        byWord
          .get("和")
          ?.readings.tw?.map((s) => writeSyllable(s))
          .join(""),
        "hàn",
      );
    });

    it("keeps a sense-scoped note on a word", () => {
      // A word is only reached where it is written, so its dominant sense is
      // the one that matters: 相親 is the matchmaking meeting far more often
      // than it is 彼此親近.
      const { byWord } = merge({
        phrase: new Map([["相亲", ["xiāng", "qīn"]]]),
        cedict: [
          cedictEntry("相親", "相亲", "xiang1 qin1", {
            taiwanReadings: ["xiang4", "qin1"],
            taiwanScope: "sense",
          }),
        ],
      });
      assertIdentical(
        byWord
          .get("相亲")
          ?.readings.tw?.map((s) => writeSyllable(s))
          .join(" "),
        "xiàng qīn",
      );
    });

    it("ignores a note hung on a sense that reads otherwise", () => {
      // CC-CEDICT marks `Taiwan pr. [zhuo2]` on 著's chess-move sense, which
      // reads `zhāo`. The aspect particle knows nothing about it.
      const { byWord } = merge({
        phrase: new Map([["着", ["zhe"]]]),
        cedict: [
          cedictEntry("着", "着", "zhao1", { taiwanReadings: ["zhuo2"] }),
          cedictEntry("着", "着", "zhe5"),
        ],
      });
      assertUndefined(byWord.get("着")?.readings.tw);
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

    it("does not let CC-CEDICT promote a word jieba calls ordinary", () => {
      // A capital in CC-CEDICT is not proof: it capitalises any headword
      // written with Latin letters too.
      const { byWord } = merge({
        cedict: [
          cedictEntry("巴黎", "巴黎", "Ba1 li2", { isProperNoun: true }),
        ],
        jieba: new Map([["巴黎", { frequency: 10, partOfSpeech: "n" }]]),
      });
      assertFalse(byWord.get("巴黎")?.isProperNoun ?? true);
    });

    it("lets CC-CEDICT's lower case veto a jieba proper noun tag", () => {
      // jieba tags 沙发 nz. CC-CEDICT writes `sha1 fa1`, and nothing but a
      // common noun is written that way.
      const { byWord, result } = merge({
        phrase: new Map([["沙发", ["shā", "fā"]]]),
        cedict: [cedictEntry("沙發", "沙发", "sha1 fa1")],
        jieba: new Map([["沙发", { frequency: 862, partOfSpeech: "nz" }]]),
      });
      assertFalse(byWord.get("沙发")?.isProperNoun ?? true);
      assertIdentical(result.stats.properNounVetoes, 1);
    });

    it("gives the 繁體 spelling the tag jieba only counted 简体", () => {
      // jieba's corpus is 简体, so 听 is `v` and 聽 arrives with nothing. Every
      // rule that asks what the word beside it is decides on that tag.
      const { byWord, result } = merge({
        unihanReadings: new Map([
          ["听", unihan(["tīng"])],
          ["聽", unihan(["tīng"])],
        ]),
        cedict: [cedictEntry("聽", "听", "ting1")],
        jieba: new Map([["听", { frequency: 20_000, partOfSpeech: "v" }]]),
      });
      assertIdentical(byWord.get("听")?.partOfSpeech, "v");
      assertIdentical(byWord.get("聽")?.partOfSpeech, "v");
      assertIdentical(result.stats.carriedTags, 1);
    });

    it("gives the 繁體 spelling the count jieba only counted 简体", () => {
      const { byWord, result } = merge({
        unihanReadings: new Map([
          ["听", unihan(["tīng"])],
          ["聽", unihan(["tīng"])],
        ]),
        cedict: [cedictEntry("聽", "听", "ting1")],
        jieba: new Map([["听", { frequency: 20_435, partOfSpeech: "v" }]]),
      });
      assertIdentical(byWord.get("听")?.frequency, 20_435);
      assertIdentical(byWord.get("聽")?.frequency, 20_435);
      assertIdentical(result.stats.carriedCounts, 1);
    });

    it("gives the 繁體 spelling the proper-noun bit its 简体 word reached", () => {
      const { byWord, result } = merge({
        unihanReadings: new Map([
          ["麦", unihan(["mài"])],
          ["麥", unihan(["mài"])],
        ]),
        cedict: [cedictEntry("麥", "麦", "Mai4", { isProperNoun: true })],
        jieba: new Map([["麦", { frequency: 900, partOfSpeech: "nr" }]]),
      });
      assertTrue(byWord.get("麦")?.isProperNoun ?? false);
      assertTrue(byWord.get("麥")?.isProperNoun ?? false);
      assertIdentical(result.stats.carriedCapitals, 1);
    });

    it("leaves a jieba proper noun CC-CEDICT also capitalises", () => {
      const { byWord, result } = merge({
        phrase: new Map([["北京", ["běi", "jīng"]]]),
        cedict: [
          cedictEntry("北京", "北京", "Bei3 jing1", { isProperNoun: true }),
        ],
        jieba: new Map([["北京", { frequency: 34_488, partOfSpeech: "ns" }]]),
      });
      assertTrue(byWord.get("北京")?.isProperNoun ?? false);
      assertIdentical(result.stats.properNounVetoes, 0);
    });

    it("carries the 姓 boundary CC-CEDICT's capitalisation states", () => {
      const { byWord, result } = merge({
        phrase: new Map([["毛泽东", ["máo", "zé", "dōng"]]]),
        cedict: [
          cedictEntry("毛澤東", "毛泽东", "Mao2 Ze2 dong1", {
            isProperNoun: true,
          }),
        ],
        jieba: new Map([["毛泽东", { frequency: 5638, partOfSpeech: "nr" }]]),
      });
      assertArrayEquals(byWord.get("毛泽东")?.nameBoundaries ?? [], [1]);
      assertIdentical(result.stats.nameBoundaries, 1);
    });

    it("states no boundary for a transliteration", () => {
      // 马克思 is `Ma3 ke4 si1`: capitalised once and never again, which is
      // what keeps Marx from coming apart as `Mǎ Kèsī`.
      const { byWord, result } = merge({
        phrase: new Map([["马克思", ["mǎ", "kè", "sī"]]]),
        cedict: [
          cedictEntry("馬克思", "马克思", "Ma3 ke4 si1", {
            isProperNoun: true,
          }),
        ],
        jieba: new Map([["马克思", { frequency: 1160, partOfSpeech: "nr" }]]),
      });
      assertUndefined(byWord.get("马克思")?.nameBoundaries);
      assertIdentical(result.stats.nameBoundaries, 0);
    });

    it("states no boundary on a word the veto demoted", () => {
      // Nothing that is not a proper noun has a 姓 to end, so the boundary is
      // not carried even where the capitalisation would otherwise state one.
      const { byWord, result } = merge({
        phrase: new Map([["沙发", ["shā", "fā"]]]),
        cedict: [cedictEntry("沙發", "沙发", "sha1 Fa1")],
        jieba: new Map([["沙发", { frequency: 862, partOfSpeech: "nz" }]]),
      });
      assertUndefined(byWord.get("沙发")?.nameBoundaries);
      assertIdentical(result.stats.nameBoundaries, 0);
    });

    it("keeps jieba's verdict where CC-CEDICT has nothing to say", () => {
      const { byWord } = merge({
        phrase: new Map([["襄阳", ["xiāng", "yáng"]]]),
        jieba: new Map([["襄阳", { frequency: 13_196, partOfSpeech: "ns" }]]),
      });
      assertTrue(byWord.get("襄阳")?.isProperNoun ?? false);
    });

    it("compares against the sense matching the reading, not just any sense", () => {
      // 万 is 萬 and a proper noun surname when read wàn, and 万 read mò is a
      // different word; the veto must consult the sense that was chosen.
      const { byWord } = merge({
        phrase: new Map([["万", ["mò"]]]),
        cedict: [
          cedictEntry("萬", "万", "Wan4", { isProperNoun: true }),
          cedictEntry("万", "万", "mo4"),
        ],
        jieba: new Map([["万", { frequency: 100, partOfSpeech: "nr" }]]),
      });
      assertFalse(byWord.get("万")?.isProperNoun ?? true);
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
