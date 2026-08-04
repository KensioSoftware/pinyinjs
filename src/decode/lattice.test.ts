import {
  dictionaryOf,
  entry,
  reading,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertArrayNotEmpty,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import {
  allEdges,
  buildLattice,
  cutPoints,
  type LatticeEdge,
} from "./lattice.js";

const dictionary = sampleDictionary();

/**
 * The edges of a run, written as `text:reading`.
 */
function edgesOf(run: string): readonly string[] {
  return allEdges(buildLattice(dictionary, run)).map(
    (edge) =>
      `${edge.text}:${edge.reading.map((syllable) => writeSyllable(syllable)).join(" ")}`,
  );
}

/**
 * One edge of a run, found by the characters it covers and its reading.
 */
function edge(run: string, text: string, reading: string): LatticeEdge {
  const found = allEdges(buildLattice(dictionary, run)).find(
    (candidate) =>
      candidate.text === text &&
      candidate.reading.map((syllable) => writeSyllable(syllable)).join(" ") ===
        reading,
  );
  assertNonNullable(found);
  return found;
}

describe("the lattice", () => {
  it("emits an edge for every dictionary match at a position", () => {
    // 银行 is a word and so is 银, so both leave position 0.
    assertArrayEquals(edgesOf("银行"), [
      "银行:yín háng",
      "银:yín",
      "行:xíng",
      "行:háng",
      "行:héng",
    ]);
  });

  it("offers every reading of a character, not only its most likely", () => {
    assertArrayEquals(edgesOf("行"), ["行:xíng", "行:háng", "行:héng"]);
  });

  it("stops scanning as soon as no word carries the prefix", () => {
    // Nothing begins 银大, so the scan gives up after one character rather than
    // walking to the length limit.
    assertArrayEquals(edgesOf("银大"), ["银:yín", "大:dà"]);
  });

  it("spans several characters with one edge where a word does", () => {
    const covering = edge("北京银行", "北京", "běi jīng");
    assertIdentical(covering.from, 0);
    assertIdentical(covering.to, 2);
  });

  it("keeps a character it has no reading for, rather than dropping it", () => {
    const unknown = edge("囧", "囧", "");
    assertFalse(unknown.isKnown);
    assertArrayLength(unknown.reading, 0);
  });

  it("charges an unknown character more than any known reading", () => {
    const unknown = edge("囧", "囧", "");
    const known = edge("银", "银", "yín");
    assertTrue(unknown.cost > known.cost);
    assertTrue(unknown.readingCost > known.readingCost);
  });

  it("charges each step down a character's readings a little more", () => {
    assertTrue(edge("行", "行", "háng").cost > edge("行", "行", "xíng").cost);
    assertTrue(edge("行", "行", "héng").cost > edge("行", "行", "háng").cost);
  });

  it("prices a rare word above its characters for spacing, below for reading", () => {
    // The asymmetry in one dictionary: 地气 is far rarer than 地 followed by
    // 气, so the spacing cost prefers the split and the reading cost does not.
    const rare = dictionaryOf([
      entry("地", "de", { alternates: [reading("dì")], frequency: 160_541 }),
      entry("气", "qì", { frequency: 17_826 }),
      entry("地气", "dì qì", { frequency: 44 }),
    ]);
    const edges = allEdges(buildLattice(rare, "地气"));
    const whole = edges.find((candidate) => candidate.text === "地气");
    const first = edges.find((candidate) => candidate.text === "地");
    const second = edges.find((candidate) => candidate.text === "气");
    assertNonNullable(whole);
    assertNonNullable(first);
    assertNonNullable(second);
    assertTrue(whole.cost > first.cost + second.cost);
    assertTrue(whole.readingCost < first.readingCost + second.readingCost);
  });

  it("reads 儿化 as one syllable over two characters", () => {
    const erhua = edge("玩儿", "玩儿", "wánr");
    assertIdentical(erhua.to - erhua.from, 2);
    assertArrayLength(erhua.reading, 1);
  });

  it("finds a word under its 繁體 key", () => {
    assertArrayNotEmpty(
      allEdges(buildLattice(dictionary, "銀行")).filter(
        (candidate) => candidate.text === "銀行",
      ),
    );
  });

  it("builds nothing from an empty run", () => {
    assertArrayLength(allEdges(buildLattice(dictionary, "")), 0);
  });

  describe("cut points", () => {
    it("puts one at each end of the run", () => {
      assertArrayEquals([...cutPoints(buildLattice(dictionary, "银"))], [0, 1]);
    });

    it("finds every position where no edge spans", () => {
      // Nothing joins 银 to 大, so the run cuts cleanly between them.
      assertArrayEquals(
        [...cutPoints(buildLattice(dictionary, "银大"))],
        [0, 1, 2],
      );
    });

    it("leaves out a position a word spans", () => {
      // 银行 covers the gap between the two characters, so it cannot be cut.
      assertArrayEquals(
        [...cutPoints(buildLattice(dictionary, "银行"))],
        [0, 2],
      );
    });

    it("finds none inside a run every word overlaps", () => {
      // 银行长大: 银行 spans 0–2 and 行长 spans 1–3, so only the ends are free.
      const dense = dictionaryOf([
        entry("银", "yín"),
        entry("行", "xíng"),
        entry("长", "zhǎng"),
        entry("银行", "yín háng"),
        entry("行长", "háng zhǎng"),
      ]);
      assertArrayEquals([...cutPoints(buildLattice(dense, "银行长"))], [0, 3]);
    });
  });
});
