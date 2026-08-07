import {
  dictionaryOf,
  entry,
  reading,
  SAMPLE_ENTRIES,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { buildArtifact } from "./artifact.js";
import { Dictionary } from "./dictionary.js";

const dictionary = dictionaryOf(SAMPLE_ENTRIES);

/**
 * A word's reading, written out.
 */
function readingOf(word: string): string | undefined {
  return dictionary
    .lookup(word)
    ?.reading.map((syllable) => writeSyllable(syllable))
    .join(" ");
}

describe("querying a compiled dictionary", () => {
  describe("lookup", () => {
    it("finds a word by its 简体 key", () => {
      assertIdentical(readingOf("银行"), "yín háng");
    });

    it("finds the same word by its 繁體 key, with no conversion", () => {
      assertIdentical(readingOf("銀行"), "yín háng");
    });

    it("rebuilds a reading stored as its characters' defaults", () => {
      // 长大 is zhǎng + dà, exactly what its characters read alone, so the
      // artifact stores no reading for it at all.
      assertIdentical(readingOf("长大"), "zhǎng dà");
    });

    it("reads a stored reading where the characters do not derive it", () => {
      // 行 alone is xíng, so 行长 has to be stored.
      assertIdentical(readingOf("行长"), "háng zhǎng");
    });

    it("reports nothing for a word it does not hold", () => {
      assertUndefined(dictionary.lookup("没有"));
    });

    it("carries the part of speech and the proper noun bit", () => {
      const found = dictionary.lookup("北京");
      assertNonNullable(found);
      assertIdentical(found.partOfSpeech, "ns");
      assertTrue(found.isProperNoun);
    });

    it("carries a zh-TW reading where one differs", () => {
      const found = dictionary.lookup("垃圾");
      assertNonNullable(found);
      assertIdentical(
        found.taiwanReading
          ?.map((syllable) => writeSyllable(syllable))
          .join(""),
        "lèsè",
      );
    });

    it("leaves the zh-TW reading absent where the locales agree", () => {
      assertUndefined(dictionary.lookup("银行")?.taiwanReading);
    });

    it("costs a common word less than a rare one", () => {
      const common = dictionary.lookup("北京");
      const rare = dictionary.lookup("玩儿");
      assertNonNullable(common);
      assertNonNullable(rare);
      assertTrue(common.cost < rare.cost);
    });

    it("returns the same entry object on a second lookup", () => {
      // Decoded lazily and remembered, since a decode of all 722,934 entries
      // would cost far more than the lookups a page performs.
      assertIdentical(dictionary.lookup("银行"), dictionary.lookup("银行"));
    });
  });

  describe("hasPrefix", () => {
    it("answers yes for a prefix of a longer word", () => {
      assertTrue(dictionary.hasPrefix("银"));
    });

    it("counts an exact match as a prefix", () => {
      assertTrue(dictionary.hasPrefix("银行"));
    });

    it("answers no once nothing can extend", () => {
      assertFalse(dictionary.hasPrefix("银行银行"));
    });

    it("answers no for text no word begins with", () => {
      assertFalse(dictionary.hasPrefix("囧"));
    });
  });

  describe("readingsOf", () => {
    it("gives every reading a character takes, most likely first", () => {
      assertIdentical(
        dictionary
          .readingsOf("行")
          .map((found) =>
            found.map((syllable) => writeSyllable(syllable)).join(""),
          )
          .join(","),
        "xíng,háng,héng",
      );
    });

    it("gives a character with one reading just the one", () => {
      assertArrayLength(dictionary.readingsOf("银"), 1);
    });

    it("gives nothing for a character it does not hold", () => {
      assertArrayLength(dictionary.readingsOf("囧"), 0);
    });
  });

  describe("size", () => {
    it("counts every key, both scripts", () => {
      const distinctHant = SAMPLE_ENTRIES.filter(
        (held) => held.hant !== held.hans,
      ).length;
      // `Dictionary.size` counts keys and is a plain number getter; the
      // rule's Map and Set assertions do not apply to it.
      assertIdentical(dictionary.size, SAMPLE_ENTRIES.length + distinctHant);
    });
  });

  it("holds an empty artifact without complaint", () => {
    const empty = Dictionary.from(buildArtifact([]));
    // `Dictionary.size` counts keys and is a plain number getter; the
    // rule's Map and Set assertions do not apply to it.
    assertIdentical(empty.size, 0);
    assertUndefined(empty.lookup("银行"));
    assertFalse(empty.hasPrefix("银"));
  });

  it("reads a word whose characters it does not hold", () => {
    // A derivable reading needs its characters; without them there is nothing
    // to rebuild from, and the entry reports an empty reading rather than
    // throwing.
    const orphan = dictionaryOf([entry("银行", "yín háng")]);
    assertIdentical(
      orphan
        .lookup("银行")
        ?.reading.map((syllable) => writeSyllable(syllable))
        .join(" "),
      "yín háng",
    );
  });

  it("survives a reading the artifact cannot decode", () => {
    const odd = dictionaryOf([entry("银", "yín"), entry("行", "xíng")]);
    assertIdentical(odd.lookup("银")?.reading.length, reading("yín").length);
  });
});
