import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertNonNullable,
  assertSetSize,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
  isAttestedTone,
  narrowToAttested,
  RARE_SYLLABLES,
  SYLLABLE_TONES,
} from "./inventory.js";
import { readSyllable, type Syllable, writeSyllable } from "./syllable.js";

/**
 * A pinyin syllable, parsed, for a readable expectation.
 */
function syllableOf(pinyin: string): Syllable {
  const read = readSyllable(pinyin);
  assertNonNullable(read, pinyin);
  return read;
}

/**
 * What is left of a list of candidates once the unwritten tones come off.
 */
function narrowed(pinyin: readonly string[]): readonly string[] {
  return narrowToAttested(pinyin.map((one) => syllableOf(one))).map((one) =>
    writeSyllable(one),
  );
}

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

  it("says which tones every one of its syllables is written in", () => {
    assertSetSize(new Set(SYLLABLE_TONES.keys()), DICTIONARY_SYLLABLES.size);
    for (const spelling of DICTIONARY_SYLLABLES) {
      assertNonNullable(SYLLABLE_TONES.get(spelling), spelling);
    }
  });

  it("leaves a fifth of the syllable-and-tone grid empty", () => {
    const attested = [...SYLLABLE_TONES.values()].flat();
    assertArrayLength(attested, 1708);
    // 424 syllables in five tones would be 2,120, so 412 cells are gaps: 咯
    // `lo` is only ever neutral, 半 `ban` has no second tone.
    assertArrayEquals(SYLLABLE_TONES.get("lo"), [NEUTRAL_TONE]);
    assertArrayEquals(SYLLABLE_TONES.get("ban"), [1, 3, 4, 5]);
    assertArrayEquals(SYLLABLE_TONES.get("luo"), [1, 2, 3, 4, 5]);
  });

  it("judges a syllable by the tone it carries and nothing else", () => {
    assertTrue(isAttestedTone(syllableOf("luó")));
    assertFalse(isAttestedTone(syllableOf("ló")));
    // A syllable with no tone claims nothing, and 儿化 is not the syllable's
    // own business either: 咯儿 would still be neutral.
    assertTrue(isAttestedTone(syllableOf("lo")));
    assertTrue(isAttestedTone({ ...syllableOf("lo"), erhua: true }));
    // Outside the inventory there is nothing to say: this answers which tones
    // a syllable takes, not which syllables there are.
    assertTrue(isAttestedTone(syllableOf("shōng")));
  });

  it("narrows a candidate list, but never to nothing", () => {
    assertArrayEquals(narrowed(["luó", "ló"]), ["luó"]);
    // Nothing attested in the list means the tone is wrong rather than the
    // spelling, and the caller is handed what it had.
    assertArrayEquals(narrowed(["ló"]), ["ló"]);
  });

  it("includes the rare readings the merged dictionary really uses", () => {
    // 鞥 ēng, 覅 fiào and 挼 ruá are all genuine, and all reach the dictionary
    // through Unihan's coverage of rare characters.
    assertTrue(DICTIONARY_SYLLABLES.has("eng"));
    assertTrue(DICTIONARY_SYLLABLES.has("fiao"));
    assertTrue(DICTIONARY_SYLLABLES.has("rua"));
  });
});
