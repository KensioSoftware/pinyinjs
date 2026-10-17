import {
  assertArrayEquals,
  assertMapSize,
  assertStringIncludes,
  assertThrowsErrorLike,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import {
  FREE_READINGS,
  FREE_SYLLABLES,
  freeSyllable,
  leadWithFreeReading,
} from "./free-readings.js";

/**
 * Syllables from tone-marked pinyin, for a ranking to be built out of.
 */
function syllables(...readings: readonly string[]): readonly Syllable[] {
  return readings.map((reading) => {
    const syllable = readSyllable(reading);
    if (syllable === undefined) {
      throw new Error(`not a syllable: ${reading}`);
    }
    return syllable;
  });
}

/**
 * A ranking written back out, for comparing.
 */
function written(ranked: readonly Syllable[]): readonly string[] {
  return ranked.map((syllable) => writeSyllable(syllable));
}

describe("free readings", () => {
  it("indexes every character exactly once", () => {
    assertMapSize(FREE_SYLLABLES, FREE_READINGS.length);
  });

  describe("leadWithFreeReading", () => {
    it("moves the free reading to the front and keeps the rest in order", () => {
      const ranked = leadWithFreeReading("铺", syllables("pù", "pū", "pu"));
      assertArrayEquals(written(ranked), ["pū", "pù", "pu"]);
    });

    it("leaves a character the table does not list as it was ranked", () => {
      const ranked = leadWithFreeReading("行", syllables("xíng", "háng"));
      assertArrayEquals(written(ranked), ["xíng", "háng"]);
    });

    it("refuses a free reading the sources no longer give the character", () => {
      const error = assertThrowsErrorLike(() =>
        leadWithFreeReading("剥", syllables("bō")),
      );
      assertStringIncludes(error.message, "not one the sources give it");
    });
  });

  describe("freeSyllable", () => {
    it("refuses a reading with no tone, which would not say which one leads", () => {
      const error = assertThrowsErrorLike(() =>
        freeSyllable({ character: "剥", reading: "bao", displaces: "a typo" }),
      );
      assertStringIncludes(error.message, "is not a reading");
    });
  });
});
