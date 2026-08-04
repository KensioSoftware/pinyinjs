import {
  assertArrayEquals,
  assertArrayIncludes,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { Syllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import {
  DEFAULT_TIER,
  selectTier,
  STANDARD_TIER_WORDS,
  TIERS,
} from "./tiers.js";

/**
 * A stand-in reading; tiering never looks at one.
 */
const YI: Syllable = { initial: "", final: "i", tone: 1 };

/**
 * A minimal entry, since tiering only looks at the key and the frequency.
 */
function entry(hans: string, frequency: number, hant = hans): DictionaryEntry {
  return {
    hans,
    hant,
    readings: { cn: [YI] },
    frequency,
    partOfSpeech: "",
    isProperNoun: false,
  };
}

/**
 * Characters, a word using them, and a character no word uses.
 */
const ENTRIES: readonly DictionaryEntry[] = [
  entry("银", 0),
  entry("行", 0),
  entry("𱿅", 0),
  entry("的", 900),
  entry("银行", 7684, "銀行"),
  entry("行长", 419, "行長"),
];

/**
 * The keys a tier holds.
 */
function keysOf(tier: "core" | "standard" | "full"): readonly string[] {
  return selectTier(ENTRIES, tier).map((selected) => selected.hans);
}

describe("dictionary tiers", () => {
  it("lists the tiers smallest first", () => {
    assertArrayLength(TIERS, 3);
    assertIdentical(TIERS[0], "core");
    assertIdentical(TIERS[2], "full");
  });

  it("defaults to the full tier, since accuracy is the point", () => {
    assertIdentical(DEFAULT_TIER, "full");
  });

  describe("core", () => {
    it("holds the characters that words are written with", () => {
      assertArrayIncludes(keysOf("core"), "银");
      assertArrayIncludes(keysOf("core"), "行");
    });

    it("drops a character no word uses and jieba does not attest", () => {
      // 𱿅 is a real Unihan character with a reading and no modern vocabulary.
      assertFalse(keysOf("core").includes("𱿅"));
    });

    it("keeps a character jieba attests as a word in its own right", () => {
      assertArrayIncludes(keysOf("core"), "的");
    });

    it("holds no multi-character words", () => {
      assertFalse(keysOf("core").includes("银行"));
    });

    it("counts characters by code point, so non-BMP ones are single", () => {
      // 𱿅 is two UTF-16 code units; treating it as a word would put it in
      // the phrase tail rather than the character set.
      assertFalse(
        selectTier(ENTRIES, "standard").some(
          (selected) => selected.hans === "𱿅",
        ),
      );
    });
  });

  describe("standard", () => {
    it("holds the characters as well as the words", () => {
      assertArrayIncludes(keysOf("standard"), "银");
      assertArrayIncludes(keysOf("standard"), "银行");
    });

    it("keeps the commonest words first when the tail is cut", () => {
      const words = Array.from({ length: STANDARD_TIER_WORDS + 10 }, (_, at) =>
        entry(`词${String(at)}`, at),
      );
      const selected = selectTier(words, "standard");
      assertArrayLength(selected, STANDARD_TIER_WORDS);
      // The rarest ten are the ones dropped.
      assertFalse(selected.some((held) => held.hans === "词0"));
      assertTrue(
        selected.some((held) => held.hans === `词${String(words.length - 1)}`),
      );
    });

    it("cuts the tail at the documented size", () => {
      assertIdentical(STANDARD_TIER_WORDS, 50_000);
    });

    it("breaks a frequency tie by key, so the cut is reproducible", () => {
      // Two words that are equally common must not swap places between builds,
      // or the committed artifact churns for no reason.
      const tied = [entry("乙乙", 5), entry("甲甲", 5), entry("丙丙", 5)];
      const order = selectTier(tied, "standard").map((held) => held.hans);
      assertArrayEquals(
        order,
        [...order].toSorted((left, right) => left.localeCompare(right)),
      );
    });
  });

  describe("full", () => {
    it("holds everything, rare characters included", () => {
      assertArrayLength(selectTier(ENTRIES, "full"), ENTRIES.length);
      assertArrayIncludes(keysOf("full"), "𱿅");
    });

    it("is the same array it was given, not a copy", () => {
      assertIdentical(selectTier(ENTRIES, "full"), ENTRIES);
    });
  });

  it("nests the tiers, so a browser can load them in order", () => {
    const core = new Set(keysOf("core"));
    const standard = new Set(keysOf("standard"));
    for (const key of core) {
      assertTrue(standard.has(key));
    }
    for (const key of standard) {
      assertArrayIncludes(keysOf("full"), key);
    }
  });
});
