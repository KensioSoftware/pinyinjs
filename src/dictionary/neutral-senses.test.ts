import {
  assertArrayEquals,
  assertArrayMinLength,
  assertArrayNotEmpty,
  assertSetSize,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { NEUTRAL_SENSE_LOOKUP, NEUTRAL_SENSE_WORDS } from "./neutral-senses.js";

describe("the 轻声 sense list", () => {
  it("names words rather than readings, so CC-CEDICT supplies them", () => {
    for (const listed of NEUTRAL_SENSE_WORDS) {
      // A reading here would be a hand-typed one that a source refresh could
      // silently contradict. The entry carries the word and the reason only.
      assertArrayEquals(Object.keys(listed).toSorted(), ["displaces", "word"]);
    }
  });

  it("says of every word what its full-tone sense is", () => {
    assertArrayNotEmpty(NEUTRAL_SENSE_WORDS);
    for (const listed of NEUTRAL_SENSE_WORDS) {
      assertArrayMinLength(listed.displaces.split(" "), 3);
    }
  });

  it("lists each word once", () => {
    assertSetSize(NEUTRAL_SENSE_LOOKUP, NEUTRAL_SENSE_WORDS.length);
  });

  it("stays a list of judgements, not a dumping ground", () => {
    // 98 words are in this shape and only the ones whose full-tone sense is
    // literary, technical or a name belong here. Where both senses are current
    // — 地方, 大意, 多少, 地道 — choosing trades one wrong answer for another.
    assertTrue(
      NEUTRAL_SENSE_WORDS.length <= 40,
      "the 轻声 sense list must stay reviewable",
    );
  });

  it("does not list a word the override table already decides", async () => {
    const { OVERRIDE_READINGS } = await import("./overrides.js");
    for (const listed of NEUTRAL_SENSE_WORDS) {
      assertTrue(
        !OVERRIDE_READINGS.has(listed.word),
        `${listed.word} is decided twice`,
      );
    }
  });
});
