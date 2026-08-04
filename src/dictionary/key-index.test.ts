import {
  assertArrayEquals,
  assertFalse,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { KeyIndex } from "./key-index.js";

/**
 * Declared in the code unit order the index holds them in, so the expected
 * order of any listing is just this array.
 */
const WORDS = ["中国", "中国人", "中心", "银行", "长城", "长江"];

/**
 * Every key the index holds, in order.
 *
 * The index deliberately has no enumeration method — it exists for lookup, and
 * materialising 412k keys would undo the point of holding them as one string.
 */
const listKeys = (index: KeyIndex): string[] =>
  Array.from({ length: index.size }, (_, position) => index.keyAt(position));

/**
 * Read `size` through a local, so the smartass Set/Map size rule does not fire
 * on a type that is neither.
 */
const sizeOf = (index: KeyIndex): number => index.size;

describe("KeyIndex", () => {
  describe("building", () => {
    it("holds every key it was built from", () => {
      const index = KeyIndex.fromKeys(WORDS);
      assertIdentical(sizeOf(index), WORDS.length);
      assertArrayEquals(listKeys(index), WORDS);
    });

    it("sorts by code unit order, which is what the search relies on", () => {
      const index = KeyIndex.fromKeys(["b", "a", "c"]);
      assertArrayEquals(listKeys(index), ["a", "b", "c"]);
    });

    it("round-trips through its serialised form", () => {
      const index = KeyIndex.fromKeys(WORDS);
      const reloaded = KeyIndex.from(index.serialise());
      assertArrayEquals(listKeys(reloaded), listKeys(index));
    });

    it("handles an empty blob", () => {
      const index = KeyIndex.from("");
      assertIdentical(sizeOf(index), 0);
      assertArrayEquals(listKeys(index), []);
      assertFalse(index.has("中国"));
      assertFalse(index.hasPrefix("中"));
    });

    it("keeps duplicate keys, as documented", () => {
      const index = KeyIndex.fromKeys(["中国", "中国", "银行"]);
      assertIdentical(sizeOf(index), 3);
      assertTrue(index.has("中国"));
      assertArrayEquals(listKeys(index), ["中国", "中国", "银行"]);
    });

    it("handles a single key", () => {
      const index = KeyIndex.fromKeys(["中国"]);
      assertIdentical(sizeOf(index), 1);
      assertTrue(index.has("中国"));
      assertFalse(index.has("中"));
      assertTrue(index.hasPrefix("中"));
    });
  });

  describe("exact lookup", () => {
    const index = KeyIndex.fromKeys(WORDS);

    it("finds every key", () => {
      for (const word of WORDS) {
        assertTrue(index.has(word));
      }
    });

    it("rejects words it does not hold", () => {
      assertFalse(index.has("中"));
      assertFalse(index.has("中国人民"));
      assertFalse(index.has("北京"));
      assertFalse(index.has(""));
    });

    it("reports the position, which indexes the parallel value arrays", () => {
      for (const [position, word] of WORDS.entries()) {
        assertIdentical(index.lookup(word).index, position);
      }
    });
  });

  describe("prefix lookup", () => {
    const index = KeyIndex.fromKeys(WORDS);

    it("reports a prefix that is not itself a key", () => {
      const lookup = index.lookup("中");
      assertTrue(lookup.isPrefix);
      assertFalse(lookup.isKey);
    });

    it("reports a key that is also a prefix of a longer key", () => {
      const lookup = index.lookup("中国");
      assertTrue(lookup.isPrefix);
      assertTrue(lookup.isKey);
    });

    it("reports a key that no longer key extends", () => {
      const lookup = index.lookup("银行");
      assertTrue(lookup.isPrefix);
      assertTrue(lookup.isKey);
    });

    it("rejects a prefix no key begins with", () => {
      assertFalse(index.hasPrefix("北"));
      assertFalse(index.hasPrefix("中华"));
      assertFalse(index.hasPrefix("龍"));
    });

    it("does not run past a key into the one after it", () => {
      // 长城 is followed by 长江 in the blob; a needle spanning the separator
      // must not match.
      assertFalse(index.hasPrefix("长城长"));
      assertFalse(index.hasPrefix("中国人民银行"));
    });

    it("stops extending exactly where the lattice should stop walking", () => {
      // How the decoder walks forward from a position in 中国人民.
      const walked: string[] = [];
      const text = "中国人民";
      for (let length = 1; length <= text.length; length++) {
        const candidate = text.slice(0, length);
        if (!index.hasPrefix(candidate)) {
          break;
        }
        walked.push(candidate);
      }
      assertArrayEquals(walked, ["中", "中国", "中国人"]);
    });
  });

  describe("keyAt", () => {
    const index = KeyIndex.fromKeys(WORDS);

    it("returns the key at a position", () => {
      assertIdentical(index.keyAt(0), WORDS[0]);
    });

    it("returns nothing for a position out of range", () => {
      assertIdentical(index.keyAt(index.size), "");
      assertIdentical(index.keyAt(-1), "");
      assertIdentical(index.keyAt(999), "");
    });
  });

  describe("at scale", () => {
    it("searches a large index correctly", () => {
      // Enough keys that the binary search does real work, with a shape that
      // exercises shared prefixes.
      const many = Array.from({ length: 5000 }, (_, n) => `词${String(n)}`);
      const index = KeyIndex.fromKeys(many);
      assertIdentical(sizeOf(index), 5000);
      for (const word of many) {
        assertTrue(index.has(word));
      }
      assertTrue(index.hasPrefix("词"));
      assertFalse(index.has("词"));
      assertFalse(index.has("词99999"));
    });
  });
});
