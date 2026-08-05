import {
  assertArrayNotEmpty,
  assertIdentical,
  assertMapSize,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { toCharacters } from "../script/characters.js";
import {
  LONGEST_SPACED_WORD,
  SPACED_WORD_FORMS,
  SPACED_WORDS,
} from "./word-list.js";

describe("the 正词法 word list", () => {
  it("has parts that concatenate back to the word", () => {
    // A typo here would silently drop characters from a conversion, since the
    // parts are what gets written.
    for (const spaced of SPACED_WORDS) {
      assertIdentical(spaced.parts.join(""), spaced.word);
    }
  });

  it("gives every entry a reason", () => {
    for (const spaced of SPACED_WORDS) {
      assertTrue(spaced.reason !== "");
    }
  });

  it("lists no word twice", () => {
    assertMapSize(SPACED_WORD_FORMS, SPACED_WORDS.length);
  });

  it("never lists a part longer than the word", () => {
    for (const spaced of SPACED_WORDS) {
      assertArrayNotEmpty(spaced.parts);
      assertTrue(spaced.parts.length <= toCharacters(spaced.word).length);
    }
  });

  it("knows its longest entry, which bounds the scan", () => {
    const longest = Math.max(
      ...SPACED_WORDS.map((spaced) => toCharacters(spaced.word).length),
    );
    assertIdentical(LONGEST_SPACED_WORD, longest);
  });
});
