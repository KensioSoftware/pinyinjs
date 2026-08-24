import { assertIdentical, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import { WordCounts } from "./word-counts.js";

/**
 * Read `length` through a local, so the smartass array-length rule does not
 * fire on a typed array.
 */
const byteCount = (packed: Uint8Array): number => packed.length;

/**
 * Read `size` through a local, so the smartass Set/Map size rule does not fire
 * on a type that is neither.
 */
const sizeOf = (counts: WordCounts): number => counts.size;

/**
 * Encode and decode, which is the trip the artifact makes on its way to disk.
 */
const roundTrip = (counts: readonly number[]): WordCounts =>
  WordCounts.from(WordCounts.build(counts).serialise());

describe("WordCounts", () => {
  describe("encoding", () => {
    it("gives back the count it was given", () => {
      const counts = roundTrip([883_634, 0, 7, 1556]);
      assertIdentical(counts.countOf(0), 883_634);
      assertIdentical(counts.countOf(1), 0);
      assertIdentical(counts.countOf(2), 7);
      assertIdentical(counts.countOf(3), 1556);
    });

    it("keeps counts positional, so position n is key n", () => {
      const counts = roundTrip([5, 4, 3, 2, 1]);
      for (let at = 0; at < sizeOf(counts); at++) {
        assertIdentical(counts.countOf(at), 5 - at);
      }
    });

    it("stores an unattested word as the zero it is", () => {
      // Two thirds of the full tier's keys are attested nowhere in jieba, and
      // the fact that the corpus is silent about them is worth recording.
      const counts = roundTrip([0, 0, 12]);
      assertIdentical(counts.countOf(0), 0);
      assertIdentical(sizeOf(counts), 3);
    });

    it("spends one byte on a count under 128", () => {
      assertIdentical(byteCount(WordCounts.build([0, 1, 127]).serialise()), 3);
    });

    it("spends more bytes only where the count needs them", () => {
      assertIdentical(byteCount(WordCounts.build([128]).serialise()), 2);
      assertIdentical(byteCount(WordCounts.build([16_384]).serialise()), 3);
      assertIdentical(byteCount(WordCounts.build([883_634]).serialise()), 3);
    });

    it("round trips a count in the top bits of 32", () => {
      // Above anything jieba holds, and the case a signed shift would wrap
      // into a negative number on the way back.
      const counts = roundTrip([0xff_ff_ff_ff, 0x80_00_00_00]);
      assertIdentical(counts.countOf(0), 0xff_ff_ff_ff);
      assertIdentical(counts.countOf(1), 0x80_00_00_00);
    });

    it("floors a count into range rather than rejecting it", () => {
      const counts = roundTrip([-5, 2.7, Number.NaN, 0xff_ff_ff_ff + 1000]);
      assertIdentical(counts.countOf(0), 0);
      assertIdentical(counts.countOf(1), 2);
      assertIdentical(counts.countOf(2), 0);
      assertIdentical(counts.countOf(3), 0xff_ff_ff_ff);
    });

    it("holds an empty table", () => {
      const counts = roundTrip([]);
      assertIdentical(sizeOf(counts), 0);
      assertIdentical(counts.countOf(0), 0);
    });
  });

  describe("reading", () => {
    it("reports zero for a position it does not describe", () => {
      const counts = WordCounts.build([9, 9]);
      assertIdentical(counts.countOf(2), 0);
      assertIdentical(counts.countOf(-1), 0);
    });

    it("drops a count the stream ends in the middle of", () => {
      // A truncated file is short by whatever it was cut off in, and reporting
      // the partial value would be reporting a count the corpus never gave.
      const packed = WordCounts.build([1, 300]).serialise();
      const counts = WordCounts.from(packed.slice(0, byteCount(packed) - 1));
      assertIdentical(sizeOf(counts), 1);
      assertIdentical(counts.countOf(0), 1);
    });

    it("orders words the way the buckets cannot", () => {
      // The four counts quantise into one bucket and rank cleanly here, which
      // is the whole reason this file exists beside `full.freq`.
      const counts = roundTrip([12_000, 11_800, 11_650, 11_500]);
      for (let at = 1; at < sizeOf(counts); at++) {
        assertTrue(counts.countOf(at) < counts.countOf(at - 1));
      }
    });
  });
});
