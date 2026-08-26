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

import { type Syllable, writeSyllable } from "../syllable/syllable.js";
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

/**
 * Where a word sits in key order, which is what a posting is.
 */
function positionOf(word: string): number {
  for (let at = 0; at < dictionary.size; at++) {
    if (dictionary.wordAt(at) === word) {
      return at;
    }
  }
  throw new Error(`${word} is not a key`);
}

/**
 * A list of readings, written out.
 */
function written(readings: readonly (readonly Syllable[])[]): string {
  return readings
    .map((found) => found.map((syllable) => writeSyllable(syllable)).join(""))
    .join(",");
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

  describe("frequencyOf", () => {
    it("buckets a common word above a rare one", () => {
      const common = dictionary.frequencyOf("北京");
      const rare = dictionary.frequencyOf("玩儿");
      assertNonNullable(common);
      assertNonNullable(rare);
      assertTrue(common > rare);
    });

    it("agrees with the bucket at the position the word sits at", () => {
      for (const word of ["银行", "北京", "长大", "玩儿", "垃圾"]) {
        assertIdentical(
          dictionary.frequencyOf(word),
          dictionary.frequencyAt(positionOf(word)),
        );
      }
    });

    it("reports nothing for a word it does not hold", () => {
      assertUndefined(dictionary.frequencyOf("没有"));
    });

    it("reports the rarest bucket for a key the corpus never counted", () => {
      // A key the dictionary holds and the corpus is silent about is bucket 0,
      // and a word the dictionary lacks is undefined. The two are different
      // answers.
      assertIdentical(dictionary.frequencyOf("鸥"), 0);
    });

    it("gives the same word the same bucket under either script", () => {
      assertIdentical(
        dictionary.frequencyOf("银行"),
        dictionary.frequencyOf("銀行"),
      );
      assertIdentical(
        dictionary.frequencyOf("玩儿"),
        dictionary.frequencyOf("玩兒"),
      );
    });

    it("gives a Hong Kong glyph form its Taiwan counterpart's bucket", () => {
      // 裏 is not a key of its own — the entry is under Taiwan's 裡 — so an
      // unnormalised search would land on 裒, which sorts between the two, and
      // report that entry's bucket.
      const glyphs = dictionaryOf([
        entry("裒", "póu"),
        entry("裡", "lǐ", { frequency: 9000 }),
      ]);
      assertIdentical(glyphs.frequencyOf("裏"), glyphs.frequencyOf("裡"));
      assertTrue(
        (glyphs.frequencyOf("裏") ?? 0) > (glyphs.frequencyOf("裒") ?? 0),
      );
    });

    it("reports nothing on an empty dictionary", () => {
      assertUndefined(Dictionary.from(buildArtifact([])).frequencyOf("银行"));
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

    it("gives a Hong Kong glyph form its Taiwan counterpart's readings", () => {
      // 裏 is not a key — the entry is under Taiwan's 裡 — so the alternates
      // have to be read off that line rather than off wherever 裏 would be
      // inserted, which here is 裒, sorting between the two.
      const glyphs = dictionaryOf([
        entry("裒", "póu"),
        entry("裡", "lǐ", { alternates: [reading("li")] }),
      ]);
      assertIdentical(written(glyphs.readingsOf("裏")), "lǐ,li");
      assertIdentical(
        written(glyphs.readingsOf("裏")),
        written(glyphs.readingsOf("裡")),
      );
    });

    it("gives a character with one reading just the one", () => {
      assertArrayLength(dictionary.readingsOf("银"), 1);
    });

    it("gives nothing for a character it does not hold", () => {
      assertArrayLength(dictionary.readingsOf("囧"), 0);
    });
  });

  describe("positions", () => {
    it("names the word at a position", () => {
      assertIdentical(dictionary.wordAt(positionOf("银行")), "银行");
    });

    it("gives nothing for a position it does not hold", () => {
      assertIdentical(dictionary.wordAt(dictionary.size), "");
    });

    it("buckets a common word above a rare one", () => {
      assertTrue(
        dictionary.frequencyAt(positionOf("北京")) >
          dictionary.frequencyAt(positionOf("玩儿")),
      );
    });

    it("reads a stored reading off the line", () => {
      const readings = dictionary.readingsInOrder();
      assertIdentical(readings.readingAt(positionOf("行长")), "hang2 zhang3");
    });

    it("derives a reading the line does not store", () => {
      // 长大 is exactly its characters' defaults, so nothing is written on its
      // line at all and the reading has to be put back together.
      const readings = dictionary.readingsInOrder();
      assertIdentical(readings.readingAt(positionOf("长大")), "zhang3 da4");
    });

    it("counts as many readings as the dictionary has keys", () => {
      // `DictionaryReadings.size` is a plain number field on a cursor; the
      // rule's Map and Set assertions do not apply to it.
      assertIdentical(dictionary.readingsInOrder().size, dictionary.size);
    });

    it("gives no reading for a position it does not hold", () => {
      assertIdentical(
        dictionary.readingsInOrder().readingAt(dictionary.size),
        "",
      );
    });

    it("gives nothing where a character has no reading of its own", () => {
      const orphan = dictionaryOf([entry("银行", "yín háng")]);
      // The line stores the reading, so the word itself is fine; a word whose
      // characters are missing and whose line is empty is what comes back
      // empty, which is what a tier dropping a character would look like.
      assertIdentical(orphan.readingsInOrder().readingAt(0), "yin2 hang2");
      const derived = Dictionary.from({
        ...buildArtifact([entry("银行", "yín háng")]),
        entries: "",
      });
      assertIdentical(derived.readingsInOrder().readingAt(0), "");
    });

    it("reads a key outside the basic plane as one character", () => {
      // 𠀀 is a surrogate pair, so a walk that counted code units would take it
      // for two characters and derive nothing.
      const wide = dictionaryOf([entry("𠀀", "hē"), entry("𠀀𠀀", "hē hē")]);
      const readings = wide.readingsInOrder();
      const at = wide.wordAt(0) === "𠀀" ? 1 : 0;
      assertIdentical(wide.wordAt(at), "𠀀𠀀");
      assertIdentical(readings.readingAt(at), "he1 he1");
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
