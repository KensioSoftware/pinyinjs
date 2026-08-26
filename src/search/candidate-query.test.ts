import {
  assertArrayEquals,
  assertIdentical,
  assertNonNullable,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import { TONES } from "../tone/tone.js";
import { foldReading, readQuery } from "./candidate-query.js";

/**
 * One spelling of the inventory, parsed.
 */
function one(spelling: string): Syllable {
  const read = readSyllable(spelling);
  assertNonNullable(read, spelling);
  return read;
}

/**
 * Every syllable of the inventory whose two notations key differently.
 *
 * The two spellings are the same syllable said the same way, so a fold that
 * separates them is a fold a corpus written in marks cannot be searched with by
 * anybody typing digits.
 */
function disagreeing(): readonly string[] {
  const found: string[] = [];
  for (const spelling of DICTIONARY_SYLLABLES) {
    for (const tone of TONES) {
      const syllable = { ...one(spelling), tone };
      const marked = writeSyllable(syllable, "marks");
      const numbered = writeSyllable(syllable, "numbers");
      if (foldReading(marked) !== foldReading(numbered)) {
        found.push(`${marked} ≠ ${numbered}`);
      }
    }
  }
  return found;
}

describe("folding written pinyin", () => {
  describe("foldReading", () => {
    it("keys a stored reading the way the index was built", () => {
      assertIdentical(foldReading("ren4 shi2"), "renshi");
    });

    it("keys the same reading written in marks the same way", () => {
      assertIdentical(foldReading("rèn shí"), "renshi");
    });

    it("drops the case, which no key carries", () => {
      assertIdentical(foldReading("Bei3 jing1"), "beijing");
    });

    it("drops what a written reading separates syllables with", () => {
      assertIdentical(foldReading("xī'ān"), "xian");
      assertIdentical(foldReading("mǎ-mǎ-hū-hū"), "mamahuhu");
    });

    it("writes v, u: and ü alike, since a keyboard has only the v", () => {
      assertIdentical(foldReading("lv4 se4"), "luse");
      assertIdentical(foldReading("lu:4 se4"), "luse");
      assertIdentical(foldReading("lǜ sè"), "luse");
    });

    it("keeps the r of 儿化, as the index does", () => {
      assertIdentical(foldReading("wánr"), "wanr");
    });

    it("agrees on both notations of every syllable there is", () => {
      assertArrayEquals(disagreeing(), []);
    });
  });

  describe("readQuery", () => {
    it("keys a query the way anything else is folded", () => {
      assertIdentical(readQuery("Rèn Shí").key, foldReading("ren4 shi2"));
    });

    it("keeps the tone on what was written, for the filter to read", () => {
      assertIdentical(readQuery("Rèn Shí").written, "rènshí");
    });

    it("resolves v on what was written, where the tone stays", () => {
      assertIdentical(readQuery("lv4 se4").written, "lü4se4");
    });
  });
});
