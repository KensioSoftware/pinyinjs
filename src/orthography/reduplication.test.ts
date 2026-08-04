import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertNonNullable,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { DecodedWord } from "../decode/word.js";
import { AABB_REDUPLICATION, ABAB_REDUPLICATION } from "./reduplication.js";

/**
 * A decoded word, with the fields the rules read.
 */
function word(
  text: string,
  pinyin: string,
  flags: { readonly isProperNoun?: boolean; readonly isKnown?: boolean } = {},
): DecodedWord {
  const { isProperNoun = false, isKnown = true } = flags;
  return {
    text,
    reading: reading(pinyin),
    isProperNoun,
    partOfSpeech: "",
    isKnown,
  };
}

const dictionary = dictionaryOf([entry("干", "gān"), entry("净", "jìng")]);

/**
 * How a rule writes a run: the words it leaves, with their separators.
 */
function written(
  rule: typeof AABB_REDUPLICATION,
  words: readonly DecodedWord[],
): readonly string[] {
  return rule
    .apply(words, dictionary)
    .map((result) => `${result.separator ?? ""}${result.text}`);
}

describe("reduplication hyphens", () => {
  describe("AABB", () => {
    it("splits a four-character AABB word into hyphenated halves", () => {
      assertArrayEquals(
        written(AABB_REDUPLICATION, [word("干干净净", "gān gān jìng jìng")]),
        ["干干", "-净净"],
      );
    });

    it("gives each half the reading of its own characters", () => {
      const [head, tail] = AABB_REDUPLICATION.apply(
        [word("高高兴兴", "gāo gāo xìng xìng")],
        dictionary,
      );
      assertNonNullable(head);
      assertNonNullable(tail);
      assertArrayLength(head.reading, 2);
      assertArrayLength(tail.reading, 2);
      assertUndefined(head.separator);
    });

    it("leaves a word whose halves are the same character alone", () => {
      // 一一得一 is not two doubled halves, and 丁丁 doubled has no halves to
      // separate.
      assertArrayEquals(
        written(AABB_REDUPLICATION, [word("丁丁丁丁", "dīng dīng dīng dīng")]),
        ["丁丁丁丁"],
      );
    });

    it("leaves a proper noun alone", () => {
      // 斯斯文文 and 老老少少 carry jieba name tags CC-CEDICT did not veto, and
      // a name shaped this way is not a reduplication of anything.
      assertArrayEquals(
        written(AABB_REDUPLICATION, [
          word("斯斯文文", "sī sī wén wén", { isProperNoun: true }),
        ]),
        ["斯斯文文"],
      );
    });

    it("leaves two decoded words alone, since they are two words", () => {
      // 爸爸妈妈 is `bàba māma`, not a reduplication of 爸妈.
      assertArrayEquals(
        written(AABB_REDUPLICATION, [
          word("爸爸", "bà ba"),
          word("妈妈", "mā ma"),
        ]),
        ["爸爸", "妈妈"],
      );
    });

    it("cannot split a reading that is not one syllable per character", () => {
      const erhua: DecodedWord = {
        text: "花花点点",
        reading: reading("huā huā diǎn"),
        isProperNoun: false,
        partOfSpeech: "",
        isKnown: true,
      };
      assertArrayEquals(written(AABB_REDUPLICATION, [erhua]), ["花花点点"]);
    });

    it("leaves a word that is not four characters alone", () => {
      assertArrayEquals(
        written(AABB_REDUPLICATION, [word("看看", "kàn kan")]),
        ["看看"],
      );
    });
  });

  describe("ABAB", () => {
    it("hyphenates a repeated two-character word", () => {
      // 研究研究 is not a dictionary entry, so it arrives as two words.
      assertArrayEquals(
        written(ABAB_REDUPLICATION, [
          word("研究", "yán jiū"),
          word("研究", "yán jiū"),
        ]),
        ["研究", "-研究"],
      );
    });

    it("leaves a repeated single character alone", () => {
      // 看看 is `kànkan`, written solid with a neutral second syllable.
      assertArrayEquals(
        written(ABAB_REDUPLICATION, [word("看", "kàn"), word("看", "kan")]),
        ["看", "看"],
      );
    });

    it("leaves a repeated proper noun alone", () => {
      assertArrayEquals(
        written(ABAB_REDUPLICATION, [
          word("北京", "běi jīng", { isProperNoun: true }),
          word("北京", "běi jīng", { isProperNoun: true }),
        ]),
        ["北京", "北京"],
      );
    });

    it("leaves a repeat the dictionary never knew alone", () => {
      assertArrayEquals(
        written(ABAB_REDUPLICATION, [
          word("蹦跶", "bèng da", { isKnown: false }),
          word("蹦跶", "bèng da", { isKnown: false }),
        ]),
        ["蹦跶", "蹦跶"],
      );
    });

    it("leaves two different words alone", () => {
      assertArrayEquals(
        written(ABAB_REDUPLICATION, [
          word("研究", "yán jiū"),
          word("问题", "wèn tí"),
        ]),
        ["研究", "问题"],
      );
    });

    it("hyphenates each repeat of a word said three times", () => {
      assertArrayEquals(
        written(ABAB_REDUPLICATION, [
          word("好久", "hǎo jiǔ"),
          word("好久", "hǎo jiǔ"),
          word("好久", "hǎo jiǔ"),
        ]),
        ["好久", "-好久", "-好久"],
      );
    });
  });
});
