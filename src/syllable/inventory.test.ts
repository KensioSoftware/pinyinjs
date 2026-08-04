import {
  assertArrayLength,
  assertFalse,
  assertNonNullable,
  assertSetSize,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
  RARE_SYLLABLES,
} from "./inventory.js";
import { readSyllable, writeSyllable } from "./syllable.js";

describe("the syllable inventory", () => {
  it("holds the 408 syllables the phrase corpus attests plus interjections", () => {
    assertArrayLength(ATTESTED_SYLLABLES, 415);
  });

  it("holds the rare syllables only Unihan and CC-CEDICT reach", () => {
    assertArrayLength(RARE_SYLLABLES, 9);
  });

  it("combines the two without overlapping", () => {
    assertSetSize(
      DICTIONARY_SYLLABLES,
      ATTESTED_SYLLABLES.length + RARE_SYLLABLES.length,
    );
  });

  it("holds only well-formed syllables, written the standard way", () => {
    for (const spelling of DICTIONARY_SYLLABLES) {
      const syllable = readSyllable(spelling);
      assertNonNullable(syllable);
      assertTrue(writeSyllable(syllable, "none") === spelling);
    }
  });

  it("holds no toneless spelling twice", () => {
    assertSetSize(new Set(ATTESTED_SYLLABLES), ATTESTED_SYLLABLES.length);
  });

  it("excludes spellings the parser accepts but Mandarin does not use", () => {
    // The inventory is what turns "the parser accepted it" into "this is a
    // real syllable", which is the check that catches a source refresh
    // smuggling in a token that is not one.
    assertFalse(DICTIONARY_SYLLABLES.has("shong"));
    assertFalse(DICTIONARY_SYLLABLES.has("kiang"));
    assertNonNullable(readSyllable("shong"));
  });

  it("includes the rare readings the merged dictionary really uses", () => {
    // 鞥 ēng, 覅 fiào and 挼 ruá are all genuine, and all reach the dictionary
    // through Unihan's coverage of rare characters.
    assertTrue(DICTIONARY_SYLLABLES.has("eng"));
    assertTrue(DICTIONARY_SYLLABLES.has("fiao"));
    assertTrue(DICTIONARY_SYLLABLES.has("rua"));
  });
});
