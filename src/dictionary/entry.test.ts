import { assertFalse, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { isSameReading, isSameSyllable } from "./entry.js";

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

describe("dictionary entries", () => {
  describe("isSameSyllable", () => {
    it("matches a syllable against itself", () => {
      assertTrue(isSameSyllable(syllableOf("háng"), syllableOf("hang2")));
    });

    it("separates syllables differing only in tone", () => {
      assertFalse(isSameSyllable(syllableOf("háng"), syllableOf("hàng")));
    });

    it("separates syllables differing only in the initial", () => {
      assertFalse(isSameSyllable(syllableOf("háng"), syllableOf("wáng")));
    });

    it("separates syllables differing only in the final", () => {
      assertFalse(isSameSyllable(syllableOf("háng"), syllableOf("héng")));
    });

    it("separates 儿化 from the plain syllable", () => {
      assertFalse(isSameSyllable(syllableOf("wánr"), syllableOf("wán")));
    });

    it("treats an absent 儿化 flag as false rather than as a difference", () => {
      const plain = syllableOf("wán");
      assertTrue(isSameSyllable(plain, { ...plain, erhua: false }));
    });
  });

  describe("isSameReading", () => {
    it("matches readings syllable for syllable", () => {
      assertTrue(isSameReading(reading("yín háng"), reading("yin2 hang2")));
    });

    it("separates readings of different lengths", () => {
      assertFalse(isSameReading(reading("yín háng"), reading("yín")));
    });

    it("separates readings differing in one syllable", () => {
      assertFalse(isSameReading(reading("yín háng"), reading("yín xíng")));
    });

    it("matches two empty readings", () => {
      assertTrue(isSameReading([], []));
    });
  });
});
