import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { readAlignedReading, readDictionaryReading } from "./reading.js";

/**
 * The reading written back as tone-marked pinyin, for readable expectations.
 */
function written(
  word: string,
  readings: readonly string[],
): readonly string[] | undefined {
  return readDictionaryReading(word, readings)?.map((syllable) =>
    writeSyllable(syllable),
  );
}

describe("reading source dictionary entries", () => {
  describe("tone notation", () => {
    it("reads tone-numbered source readings", () => {
      assertArrayEquals(written("银行", ["yin2", "hang2"]) ?? [], [
        "yín",
        "háng",
      ]);
    });

    it("reads tone-marked source readings", () => {
      assertArrayEquals(written("银行", ["yín", "háng"]) ?? [], [
        "yín",
        "háng",
      ]);
    });

    it("reads an unmarked source syllable as neutral, not as unwritten", () => {
      // Source dictionaries mark every tone they know, so a bare syllable is
      // 轻声. User input means the opposite, which is why this is not shared.
      const syllables = readDictionaryReading("朋友", ["péng", "you"]);
      assertNonNullable(syllables);
      assertIdentical(syllables[1]?.tone, NEUTRAL_TONE);
    });

    it("converts the u: and v spellings of ü", () => {
      assertArrayEquals(written("一律", ["yi1", "lu:4"]) ?? [], ["yī", "lǜ"]);
      assertArrayEquals(written("旅行", ["lv3", "xing2"]) ?? [], [
        "lǚ",
        "xíng",
      ]);
    });
  });

  describe("erhua", () => {
    it("folds a trailing r5 into the syllable before it", () => {
      const syllables = readDictionaryReading("玩儿", ["wan2", "r5"]);
      assertNonNullable(syllables);
      assertArrayLength(syllables, 1);
      assertTrue(syllables[0].erhua);
      assertIdentical(writeSyllable(syllables[0]), "wánr");
    });

    it("accounts for the 儿 character the suffix stands for", () => {
      // 一点儿 is three characters but two syllables.
      const syllables = readDictionaryReading("一点儿", ["yi1", "dian3", "r5"]);
      assertNonNullable(syllables);
      assertArrayLength(syllables, 2);
      assertArrayEquals(
        syllables.map((syllable) => writeSyllable(syllable)),
        ["yī", "diǎnr"],
      );
    });

    it("leaves a genuine 儿 syllable alone", () => {
      // 女儿 is nǚ'ér, two syllables, and carries no r5.
      assertArrayEquals(written("女儿", ["nu:3", "er2"]) ?? [], ["nǚ", "ér"]);
    });

    it("rejects an r5 with no syllable before it", () => {
      assertUndefined(readDictionaryReading("儿", ["r5"]));
    });
  });

  describe("sandhi normalised out", () => {
    it("restores 一 to its underlying first tone", () => {
      // Source gives yí here; the dictionary stores yī and the runtime sandhi
      // pass puts the contour back.
      assertArrayEquals(written("一个", ["yí", "gè"]) ?? [], ["yī", "gè"]);
      assertArrayEquals(written("一天", ["yì", "tiān"]) ?? [], ["yī", "tiān"]);
    });

    it("restores 不 to its underlying fourth tone", () => {
      assertArrayEquals(written("不是", ["bú", "shì"]) ?? [], ["bù", "shì"]);
    });

    it("normalises the two source spellings of the same word alike", () => {
      // 一不小心 arrives with sandhi applied, 一丁不识 without. Both must end up
      // in the same underlying form.
      assertArrayEquals(written("一不", ["yí", "bù"]) ?? [], ["yī", "bù"]);
      assertArrayEquals(written("一丁", ["yī", "dīng"]) ?? [], ["yī", "dīng"]);
    });

    it("leaves 一 alone where it is not read as yi", () => {
      // Guarding on the syllable's shape, not just the character, so an
      // unexpected reading is passed through rather than silently retoned.
      assertArrayEquals(written("一", ["mǒu"]) ?? [], ["mǒu"]);
    });

    it("leaves other characters untouched", () => {
      assertArrayEquals(written("北京", ["běi", "jīng"]) ?? [], [
        "běi",
        "jīng",
      ]);
    });
  });

  describe("punctuation inside a headword", () => {
    it("consumes a comma that the source gives a reading for", () => {
      // Two-clause proverbs record the comma as a reading of its own. 642
      // entries depend on this, almost all of them 谚语.
      assertArrayEquals(
        written("一不做，二不休", [
          "yi1",
          "bu4",
          "zuo4",
          ",",
          "er4",
          "bu4",
          "xiu1",
        ]) ?? [],
        ["yī", "bù", "zuò", "èr", "bù", "xiū"],
      );
    });

    it("skips punctuation the source gives no reading for", () => {
      // The · separating the parts of a transliterated name is unread, so the
      // eight characters of 亞西爾·阿拉法特 carry seven syllables.
      const syllables = readDictionaryReading("亞西爾·阿拉法特", [
        "Ya4",
        "xi1",
        "er3",
        "A1",
        "la1",
        "fa3",
        "te4",
      ]);
      assertNonNullable(syllables);
      assertArrayLength(syllables, 7);
    });

    it("skips unread punctuation at the end of a headword", () => {
      assertArrayEquals(written("银行·", ["yin2", "hang2"]) ?? [], [
        "yín",
        "háng",
      ]);
    });

    it("rejects a punctuation reading against a character that is not punctuation", () => {
      assertUndefined(readDictionaryReading("银行", ["yin2", ","]));
    });
  });

  describe("what it rejects", () => {
    it("rejects a token that is not a syllable", () => {
      assertUndefined(readDictionaryReading("银行", ["yin2", "zzz"]));
    });

    it("rejects too few syllables for the word", () => {
      assertUndefined(readDictionaryReading("中国人", ["zhong1", "guo2"]));
    });

    it("rejects too many syllables for the word", () => {
      assertUndefined(readDictionaryReading("银行", ["yin2", "hang2", "le5"]));
    });

    it("rejects an empty reading", () => {
      assertUndefined(readDictionaryReading("银行", []));
    });

    it("rejects a headword mixing digits and Latin letters", () => {
      // 3D打印 reads as `san1 D da3 yin4`: the D is a literal letter and the 3
      // is a spelled-out numeral. Reading numbers aloud belongs to the numerals
      // package, so these are out of scope here rather than broken.
      assertUndefined(
        readDictionaryReading("3D打印", ["san1", "D", "da3", "yin4"]),
      );
      assertUndefined(readDictionaryReading("4S店", ["si4", "S", "dian4"]));
    });

    it("rejects an empty word", () => {
      assertUndefined(readDictionaryReading("", ["yin2"]));
    });
  });

  describe("the phrase corpus defects it does not repair", () => {
    it("cannot tell erhua from a real 儿 syllable without an r5", () => {
      // large_pinyin.txt writes 玩儿 as `wán er`, which reads as two syllables.
      // That is why CC-CEDICT is authoritative for erhua and this corpus is
      // not: the tone does not separate the two cases either, since 这儿 is
      // given as `zhè ér` and is also erhua.
      assertArrayEquals(written("玩儿", ["wán", "er"]) ?? [], ["wán", "er"]);
    });
  });

  describe("alignment against the word's characters", () => {
    it("pairs each syllable with the character it reads", () => {
      const aligned = readAlignedReading("银行", ["yin2", "hang2"]);
      assertNonNullable(aligned);
      assertArrayEquals(
        aligned.map((read) => read.characters),
        ["银", "行"],
      );
    });

    it("gives 儿化 both of its characters and one syllable", () => {
      // Which is what lets the 繁體 derivation convert the 儿 of 玩儿 to 兒
      // while still knowing the word is one syllable.
      const aligned = readAlignedReading("玩儿", ["wan2", "r5"]);
      assertNonNullable(aligned);
      assertArrayLength(aligned, 1);
      assertIdentical(aligned[0].characters, "玩儿");
      const [first] = aligned;
      assertNonNullable(first.syllable);
      assertIdentical(writeSyllable(first.syllable), "wánr");
    });

    it("keeps punctuation as a character with no syllable", () => {
      const aligned = readAlignedReading("一不做，二不休", [
        "yi1",
        "bu4",
        "zuo4",
        ",",
        "er4",
        "bu4",
        "xiu1",
      ]);
      assertNonNullable(aligned);
      assertArrayLength(aligned, 7);
      assertIdentical(aligned[3].characters, "，");
      assertUndefined(aligned[3].syllable);
    });

    it("keeps unread punctuation too", () => {
      // 亚西尔·阿拉法特 is eight characters read as seven syllables; the
      // separator has no reading of its own.
      const aligned = readAlignedReading("亚西尔·阿拉法特", [
        "Ya4",
        "xi1",
        "er3",
        "A1",
        "la1",
        "fa3",
        "te4",
      ]);
      assertNonNullable(aligned);
      assertArrayLength(aligned, 8);
      assertUndefined(aligned[3].syllable);
    });

    it("rejects a second r5 on a syllable already carrying one", () => {
      assertUndefined(readAlignedReading("玩儿儿", ["wan2", "r5", "r5"]));
    });

    it("rejects an r5 with no syllable before it", () => {
      assertUndefined(readAlignedReading("儿", ["r5"]));
    });

    it("rejects a reading that is nothing but punctuation", () => {
      assertUndefined(readAlignedReading("，", [","]));
    });
  });
});
