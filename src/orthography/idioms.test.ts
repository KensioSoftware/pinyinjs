import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { DecodedWord } from "../decode/word.js";
import { characterCount } from "../script/characters.js";
import { HYPHENATED_IDIOM_FORMS, HYPHENATED_IDIOMS } from "./idiom-list.js";
import { IDIOM_HYPHENS } from "./idioms.js";

const dictionary = dictionaryOf([entry("风", "fēng")]);

/**
 * A decoded word, with the fields the rule reads.
 */
function word(text: string, pinyin: string): DecodedWord {
  return {
    text,
    reading: reading(pinyin),
    isProperNoun: false,
    partOfSpeech: "i",
    isKnown: true,
  };
}

/**
 * How the rule writes a run: the words it leaves, with their separators.
 */
function written(words: readonly DecodedWord[]): readonly string[] {
  return IDIOM_HYPHENS.apply(words, dictionary).map(
    (result) => `${result.separator ?? ""}${result.text}`,
  );
}

describe("the 成语 hyphen", () => {
  it("cuts a listed idiom in two and marks the second half", () => {
    assertArrayEquals(written([word("风平浪静", "fēng píng làng jìng")]), [
      "风平",
      "-浪静",
    ]);
  });

  it("cuts a 繁體 idiom the same way, as a key in its own right", () => {
    assertArrayEquals(written([word("層出不窮", "céng chū bù qióng")]), [
      "層出",
      "-不窮",
    ]);
  });

  it("leaves an idiom that is not listed alone", () => {
    // 不亦乐乎 cannot be read as two disyllables, and the standard writes it
    // solid.
    assertArrayEquals(written([word("不亦乐乎", "bù yì lè hū")]), ["不亦乐乎"]);
  });

  it("leaves a word that is not an idiom alone", () => {
    assertArrayEquals(written([word("北京", "běi jīng")]), ["北京"]);
  });

  it("gives each half the reading of its own characters", () => {
    const [head, tail] = IDIOM_HYPHENS.apply(
      [word("千军万马", "qiān jūn wàn mǎ")],
      dictionary,
    );
    assertIdentical(head?.reading.length, 2);
    assertIdentical(tail?.reading.length, 2);
  });

  it("cannot cut a reading that is not one syllable per character", () => {
    assertArrayEquals(written([word("风平浪静", "fēng píng làng")]), [
      "风平浪静",
    ]);
  });
});

describe("the list itself", () => {
  it("holds only four-character words, in both scripts", () => {
    assertArrayEquals(
      HYPHENATED_IDIOMS.filter(
        (idiom) =>
          characterCount(idiom.hans) !== 4 || characterCount(idiom.hant) !== 4,
      ),
      [],
    );
  });

  it("lists each idiom once", () => {
    assertArrayLength(
      HYPHENATED_IDIOMS,
      new Set(HYPHENATED_IDIOMS.map((idiom) => idiom.hans)).size,
    );
  });

  it("holds the number the documentation quotes", () => {
    // README.md and docs/orthography/ both say 117. Growing the list is fine;
    // growing it without saying so is what this catches.
    assertArrayLength(HYPHENATED_IDIOMS, 117);
  });

  it("takes either script as the key", () => {
    // Which spelling reaches the rule depends on what was written, since 繁體
    // is a dictionary key in its own right rather than converted before lookup.
    assertTrue(HYPHENATED_IDIOM_FORMS.has("风平浪静"));
    assertTrue(HYPHENATED_IDIOM_FORMS.has("風平浪靜"));
  });
});
