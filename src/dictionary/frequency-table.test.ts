import {
  assertIdentical,
  assertNumberBetween,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  countForQuantising,
  derivedWordCharge,
  FREQUENCY_BUCKETS,
  FrequencyTable,
  UNCOUNTED_NAME,
  WORD_CHARGE,
} from "./frequency-table.js";

/**
 * Read `length` through a local, so the smartass array-length rule does not
 * fire on a typed array.
 */
const byteCount = (packed: Uint8Array): number => packed.length;

/**
 * Read `size` through a local, so the smartass Set/Map size rule does not fire
 * on a type that is neither.
 */
const sizeOf = (table: FrequencyTable): number => table.size;

describe("FrequencyTable", () => {
  describe("quantising", () => {
    it("puts the most frequent word in the top bucket", () => {
      const table = FrequencyTable.build([1, 100, 10_000]);
      assertIdentical(table.bucketOf(2), FREQUENCY_BUCKETS - 1);
    });

    it("keeps buckets ordered by frequency", () => {
      const frequencies = [1, 10, 100, 1000, 10_000, 100_000];
      const table = FrequencyTable.build(frequencies);
      for (let index = 1; index < frequencies.length; index++) {
        assertTrue(table.bucketOf(index) >= table.bucketOf(index - 1));
      }
    });

    it("spaces buckets logarithmically, so small counts stay distinguishable", () => {
      // On a linear scale these six would all collapse into the bottom bucket.
      const table = FrequencyTable.build([1, 4, 16, 64, 256, 1024, 1_000_000]);
      assertTrue(table.bucketOf(0) < table.bucketOf(1));
      assertTrue(table.bucketOf(1) < table.bucketOf(2));
      assertTrue(table.bucketOf(2) < table.bucketOf(3));
    });

    it("gives an unattested word the rarest bucket rather than rejecting it", () => {
      const table = FrequencyTable.build([0, 5000]);
      assertIdentical(table.bucketOf(0), 0);
    });

    it("keeps every bucket in range", () => {
      const table = FrequencyTable.build([0, 1, 7, 999, 123_456, 9_999_999]);
      for (let index = 0; index < table.size; index++) {
        assertNumberBetween(table.bucketOf(index), 0, FREQUENCY_BUCKETS - 1);
      }
    });

    it("handles a table where nothing was attested", () => {
      const table = FrequencyTable.build([0, 0, 0]);
      assertIdentical(table.bucketOf(0), 0);
      assertIdentical(table.bucketOf(2), 0);
    });

    it("handles an empty table", () => {
      const table = FrequencyTable.build([]);
      assertIdentical(sizeOf(table), 0);
      assertIdentical(table.bucketOf(0), 0);
    });
  });

  describe("packing", () => {
    it("stores two entries per byte", () => {
      const packedBytes = FrequencyTable.build([1, 10, 100, 1000]).serialise();
      assertIdentical(byteCount(packedBytes), 2);
    });

    it("rounds an odd count up to a whole byte", () => {
      const packedBytes = FrequencyTable.build([1, 10, 100]).serialise();
      assertIdentical(byteCount(packedBytes), 2);
    });

    it("keeps neighbouring entries independent across the nibble boundary", () => {
      // A high value beside a low one would corrupt if the nibbles overlapped,
      // and the pairing means index 0/1 share a byte, as do 2/3.
      const table = FrequencyTable.build([1_000_000, 0, 0, 1_000_000]);
      assertIdentical(table.bucketOf(0), FREQUENCY_BUCKETS - 1);
      assertIdentical(table.bucketOf(1), 0);
      assertIdentical(table.bucketOf(2), 0);
      assertIdentical(table.bucketOf(3), FREQUENCY_BUCKETS - 1);
    });

    it("round-trips through its serialised form", () => {
      const frequencies = [0, 1, 42, 999, 12_345, 678_910, 3, 7];
      const original = FrequencyTable.build(frequencies);
      const reloaded = FrequencyTable.from(
        original.serialise(),
        frequencies.length,
      );
      for (let index = 0; index < frequencies.length; index++) {
        assertIdentical(reloaded.bucketOf(index), original.bucketOf(index));
      }
    });
  });

  describe("countForQuantising", () => {
    it("passes a counted word through untouched", () => {
      assertIdentical(countForQuantising(269, false), 269);
      assertIdentical(countForQuantising(269, true), 269);
    });

    it("gives a name the corpus never counted jieba's default", () => {
      assertIdentical(countForQuantising(0, true), UNCOUNTED_NAME);
    });

    it("leaves an ordinary uncounted word at zero", () => {
      // The floor over every uncounted key lifts two thirds of the dictionary
      // and joins 從容地, 都會 and 過得. See UNCOUNTED_NAME.
      assertIdentical(countForQuantising(0, false), 0);
    });

    it("charges enough less to keep 脸书 from splitting", () => {
      // Real counts from the shipped corpus: 了 as the most frequent word it
      // holds, then 脸, 书 and 脸书, which jieba never counted. At a count of
      // zero 脸书 cost 19.62 against the 18.24 of its characters and the
      // decoder read Facebook as a face and a book.
      const counts = [883_634, 10_566, 18_993, countForQuantising(0, true)];
      const table = FrequencyTable.build(counts);
      assertIdentical(table.bucketOf(3), 2);
      assertTrue(table.costOf(3) < table.costOf(1) + table.costOf(2));
    });
  });

  describe("costOf", () => {
    it("charges less for a more frequent word", () => {
      const table = FrequencyTable.build([1, 1_000_000]);
      assertTrue(table.costOf(1) < table.costOf(0));
    });

    it("always charges something, so more words cost more than fewer", () => {
      // Without a per-word charge the decoder would happily split one word into
      // several of equal total likelihood.
      const table = FrequencyTable.build([1_000_000]);
      assertTrue(table.costOf(0) > 0);
    });

    it("charges the most for an entry it does not know", () => {
      const table = FrequencyTable.build([1, 1_000_000]);
      assertTrue(table.costOf(99) >= table.costOf(0));
      assertTrue(table.costOf(99) > table.costOf(1));
    });

    it("derives the shipped charge from jieba's corpus", () => {
      // The corpus every count in the dictionary is taken from, as the build
      // parses it: 60,101,964 occurrences with 了 the busiest at 883,634.
      assertNumberBetween(
        derivedWordCharge(60_101_964, 883_634),
        WORD_CHARGE - 0.005,
        WORD_CHARGE + 0.005,
      );
    });

    it("is not derived from the counts the artifact ships", () => {
      // Summing full.counts gives 82,372,768, because a 繁體 key carries its
      // 简体 word's count and the same corpus is counted again under it. The
      // build checks the constant against jieba's total for that reason.
      assertTrue(derivedWordCharge(82_372_768, 883_634) > WORD_CHARGE + 0.3);
    });

    it("grows with the corpus and falls as its busiest word grows", () => {
      assertTrue(
        derivedWordCharge(120_000_000, 883_634) >
          derivedWordCharge(60_000_000, 883_634),
      );
      assertTrue(
        derivedWordCharge(60_000_000, 1_800_000) <
          derivedWordCharge(60_000_000, 883_634),
      );
    });

    it("charges enough per word to keep 还给 from splitting", () => {
      // Real counts from the shipped corpus: 了 as the most frequent word it
      // holds, then 还, 给 and 还给. At the per-word charge of 1 this table
      // started with, 还 + 给 came to less than 还给 and the decoder read the
      // word as `hái gěi`. See WORD_CHARGE for where 4.62 comes from.
      const table = FrequencyTable.build([883_634, 157_058, 69_480, 269]);
      assertTrue(table.costOf(3) < table.costOf(1) + table.costOf(2));
    });
  });
});
