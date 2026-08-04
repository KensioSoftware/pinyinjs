import {
  assertArrayEquals,
  assertFalse,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import {
  attachErhua,
  isErFinal,
  NON_ERHUA_ER_WORDS,
  withErhua,
} from "./erhua.js";

/**
 * Read a syllable, refusing anything that is not one.
 *
 * Throws rather than asserting non-null so the test fixtures cannot quietly
 * carry a typo.
 */
function syllableOf(text: string): Syllable {
  const parsed = readSyllable(text);
  if (parsed === undefined) {
    throw new Error(`not a syllable: ${text}`);
  }
  return parsed;
}

/**
 * Read a space-separated reading, for readable expectations.
 */
function reading(text: string): readonly Syllable[] {
  return text.split(" ").map((token) => syllableOf(token));
}

/**
 * Write a reading back out, for readable expectations.
 */
function written(syllables: readonly Syllable[]): readonly string[] {
  return syllables.map((syllable) => writeSyllable(syllable));
}

describe("儿化", () => {
  describe("isErFinal", () => {
    it("recognises a 简体 word ending in 儿", () => {
      assertTrue(isErFinal("玩儿"));
    });

    it("recognises a 繁體 word ending in 兒", () => {
      assertTrue(isErFinal("玩兒"));
    });

    it("rejects the bare character, which is the word 儿 itself", () => {
      assertFalse(isErFinal("儿"));
    });

    it("rejects a word with 儿 anywhere but the end", () => {
      assertFalse(isErFinal("儿子"));
    });
  });

  describe("withErhua", () => {
    it("marks an ordinary syllable", () => {
      const suffixed = withErhua(syllableOf("wán"));
      assertIdentical(writeSyllable(suffixed), "wánr");
    });

    it("keeps the tone", () => {
      assertIdentical(withErhua(syllableOf("wán")).tone, 2);
    });

    it("absorbs the suffix into a bare e, which is already ér", () => {
      // é with r-colouring is exactly ér, and pinyin writes them the same, so
      // recording it as e-plus-a-suffix would claim a distinction the spelling
      // cannot carry — and would not survive a round trip through an artifact.
      const suffixed = withErhua(syllableOf("é"));
      assertIdentical(writeSyllable(suffixed), "ér");
      assertIdentical(suffixed.final, "er");
      assertFalse(suffixed.erhua ?? false);
    });

    it("leaves an already r-coloured er alone", () => {
      const suffixed = withErhua(syllableOf("ér"));
      assertIdentical(writeSyllable(suffixed), "ér");
      assertFalse(suffixed.erhua ?? false);
    });
  });

  describe("attachErhua", () => {
    it("folds a trailing toneless er into the syllable before it", () => {
      // 玩儿 arrives from the phrase corpus as `wán er`.
      const attached = attachErhua(reading("wán er"));
      assertArrayEquals(written(attached), ["wánr"]);
    });

    it("folds a trailing toned ér too, since the tone settles nothing", () => {
      // 这儿 arrives as `zhè ér` and is still 儿化.
      const attached = attachErhua(reading("zhè ér"));
      assertArrayEquals(written(attached), ["zhèr"]);
    });

    it("leaves a reading with no trailing er alone", () => {
      const untouched = reading("yín háng");
      assertIdentical(attachErhua(untouched), untouched);
    });

    it("leaves a single syllable alone, having nothing to attach it to", () => {
      const untouched = reading("ér");
      assertIdentical(attachErhua(untouched), untouched);
    });

    it("leaves a reading whose last syllable is already 儿化", () => {
      const untouched = reading("wánr");
      assertIdentical(attachErhua(untouched), untouched);
    });

    it("does not attach to a syllable that is already r-coloured", () => {
      const untouched = reading("wánr er");
      assertIdentical(attachErhua(untouched), untouched);
    });

    it("keeps the syllables before the folded one", () => {
      const attached = attachErhua(reading("yī diǎn er"));
      assertArrayEquals(written(attached), ["yī", "diǎnr"]);
    });
  });

  describe("NON_ERHUA_ER_WORDS", () => {
    it("holds the words where 儿 is a syllable of its own", () => {
      assertTrue(NON_ERHUA_ER_WORDS.has("女儿"));
      assertTrue(NON_ERHUA_ER_WORDS.has("儿童"));
    });

    it("does not hold words where 儿 is a diminutive suffix", () => {
      assertFalse(NON_ERHUA_ER_WORDS.has("玩儿"));
      assertFalse(NON_ERHUA_ER_WORDS.has("这儿"));
    });
  });
});
