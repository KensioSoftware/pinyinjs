import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { DecodedWord } from "../decode/word.js";
import { writeSyllable } from "../syllable/syllable.js";
import {
  applyGrouping,
  ASPECT_PARTICLES,
  PLACE_GENERICS,
  SPACED_WORD_LIST,
  SUFFIXES,
} from "./grouping.js";

/**
 * A decoded word, with the fields the rules read.
 */
function word(
  text: string,
  pinyin: string,
  partOfSpeech = "",
  isProperNoun = false,
): DecodedWord {
  return {
    text,
    reading: reading(pinyin),
    isProperNoun,
    partOfSpeech,
    isKnown: true,
  };
}

const dictionary = dictionaryOf([
  entry("南", "nán"),
  entry("京", "jīng"),
  entry("市", "shì"),
  entry("北", "běi"),
  entry("南京", "nán jīng", { isProperNoun: true, partOfSpeech: "ns" }),
  entry("南京市", "nán jīng shì", {
    isProperNoun: true,
    partOfSpeech: "ns",
  }),
  entry("上山下乡", "shàng shān xià xiāng", { partOfSpeech: "ns" }),
]);

/**
 * The words a rule leaves behind, by their characters.
 */
function grouped(words: readonly DecodedWord[]): readonly string[] {
  return applyGrouping(words, dictionary).map((result) => result.text);
}

describe("word grouping", () => {
  describe("aspect particles", () => {
    it("attaches 了 to the verb in front of it", () => {
      assertArrayEquals(
        grouped([
          word("他", "tā", "r"),
          word("看", "kàn", "v"),
          word("了", "le", "ul"),
        ]),
        ["他", "看了"],
      );
    });

    it("leaves a sentence-final 了 alone", () => {
      // 我还给你了 is `Wǒ huán gěi nǐ le`: the 了 after a pronoun closes the
      // sentence rather than marking aspect, so it is written on its own.
      assertArrayEquals(
        grouped([word("你", "nǐ", "r"), word("了", "le", "ul")]),
        ["你", "了"],
      );
    });

    it("attaches to an adjective as well as a verb", () => {
      assertArrayEquals(
        grouped([word("好", "hǎo", "a"), word("了", "le", "ul")]),
        ["好了"],
      );
    });

    it("attaches 着 and 过 the same way", () => {
      assertArrayEquals(
        grouped([word("走", "zǒu", "v"), word("着", "zhe", "uz")]),
        ["走着"],
      );
      assertArrayEquals(
        grouped([word("去", "qù", "v"), word("过", "guo", "ug")]),
        ["去过"],
      );
    });

    it("keeps the head's flags, since the particle is not the word", () => {
      const [joined] = ASPECT_PARTICLES.apply(
        [word("看", "kàn", "v"), word("了", "le", "ul")],
        dictionary,
      );
      assertNonNullable(joined);
      assertIdentical(joined.partOfSpeech, "v");
      assertArrayLength(joined.reading, 2);
    });

    it("leaves a particle with nothing in front of it alone", () => {
      assertArrayEquals(grouped([word("了", "le", "ul")]), ["了"]);
    });
  });

  describe("suffixes", () => {
    it("attaches a suffix to the word in front of it", () => {
      assertArrayEquals(
        grouped([word("作", "zuò", "v"), word("者", "zhě", "k")]),
        ["作者"],
      );
    });

    it("leaves a word that is not a suffix alone", () => {
      assertArrayEquals(
        SUFFIXES.apply(
          [word("作", "zuò", "v"), word("家", "jiā", "q")],
          dictionary,
        ).map((result) => result.text),
        ["作", "家"],
      );
    });
  });

  describe("place-name generics", () => {
    it("writes the generic half separately and capitalises both", () => {
      const split = PLACE_GENERICS.apply(
        [word("南京市", "nán jīng shì", "ns", true)],
        dictionary,
      );
      assertArrayEquals(
        split.map((part) => part.text),
        ["南京", "市"],
      );
      assertTrue(split.every((part) => part.isProperNoun));
    });

    it("leaves a two-character name alone, which no rule could split", () => {
      // 黄河 is `Huáng Hé` and 青海 is `Qīnghǎi`; nothing distinguishes them.
      assertArrayEquals(grouped([word("上海", "shàng hǎi", "ns", true)]), [
        "上海",
      ]);
    });

    it("holds back where the part before the generic is not a word", () => {
      // 上山下乡 is tagged ns and would otherwise come apart as
      // `Shàngshānxià Xiāng`.
      assertArrayEquals(
        grouped([word("上山下乡", "shàng shān xià xiāng", "ns")]),
        ["上山下乡"],
      );
    });

    it("leaves a word that is not a place name alone", () => {
      assertArrayEquals(grouped([word("城市", "chéng shì", "n")]), ["城市"]);
    });

    it("cannot split a reading that is not one syllable per character", () => {
      const erhua: DecodedWord = {
        text: "南京市",
        reading: reading("nán jīng"),
        isProperNoun: true,
        partOfSpeech: "ns",
        isKnown: true,
      };
      assertArrayEquals(grouped([erhua]), ["南京市"]);
    });
  });

  it("runs the rules in order over a whole run", () => {
    assertArrayEquals(
      applyGrouping(
        [
          word("南京市", "nán jīng shì", "ns", true),
          word("看", "kàn", "v"),
          word("了", "le", "ul"),
        ],
        dictionary,
      ).map((result) =>
        result.reading.map((syllable) => writeSyllable(syllable)).join(""),
      ),
      ["nánjīng", "shì", "kànle"],
    );
  });

  it("applies no rules when given none", () => {
    assertArrayEquals(
      applyGrouping(
        [word("看", "kàn", "v"), word("了", "le", "ul")],
        dictionary,
        [],
      ).map((result) => result.text),
      ["看", "了"],
    );
  });
});

describe("the 正词法 word list rule", () => {
  it("splits a word the standard writes apart", () => {
    assertArrayEquals(
      SPACED_WORD_LIST.apply([word("不是", "bù shì", "c")], dictionary).map(
        (result) => result.text,
      ),
      ["不", "是"],
    );
  });

  it("joins words the standard writes together", () => {
    assertArrayEquals(
      SPACED_WORD_LIST.apply(
        [word("中国", "zhōng guó", "ns", true), word("人", "rén", "n")],
        dictionary,
      ).map((result) => result.text),
      ["中国人"],
    );
  });

  it("keeps the head's proper noun flag across a rewrite", () => {
    const [joined] = SPACED_WORD_LIST.apply(
      [word("中国", "zhōng guó", "ns", true), word("人", "rén", "n")],
      dictionary,
    );
    assertNonNullable(joined);
    assertTrue(joined.isProperNoun);
    assertArrayLength(joined.reading, 3);
  });

  it("leaves a word the list does not mention alone", () => {
    assertArrayEquals(
      SPACED_WORD_LIST.apply([word("不但", "bù dàn", "c")], dictionary).map(
        (result) => result.text,
      ),
      ["不但"],
    );
  });

  it("cannot rewrite a reading that is not one syllable per character", () => {
    const erhua: DecodedWord = {
      text: "一个",
      reading: reading("yīr"),
      isProperNoun: false,
      partOfSpeech: "m",
      isKnown: true,
    };
    assertArrayEquals(
      SPACED_WORD_LIST.apply([erhua], dictionary).map((r) => r.text),
      ["一个"],
    );
  });

  it("matches across a word boundary the decode put in", () => {
    // 中国 and 人 arrive as two words and leave as one.
    assertArrayLength(
      SPACED_WORD_LIST.apply(
        [
          word("他", "tā", "r"),
          word("中国", "zhōng guó", "ns", true),
          word("人", "rén", "n"),
        ],
        dictionary,
      ),
      2,
    );
  });
});
