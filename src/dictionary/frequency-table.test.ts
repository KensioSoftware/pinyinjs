import {
  assertIdentical,
  assertNumberBetween,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { FREQUENCY_BUCKETS, FrequencyTable } from "./frequency-table.js";

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
