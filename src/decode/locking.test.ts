import {
  dictionaryOf,
  entry,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertIdentical,
  assertNonNullable,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { Dictionary } from "../dictionary/dictionary.js";
import { writeSyllable } from "../syllable/syllable.js";
import { allEdges, buildLattice } from "./lattice.js";
import { projectReadings, unitsOf } from "./locking.js";

const dictionary = sampleDictionary();

/**
 * What each position of a run locked to, written out, or `?` where it did not.
 */
function locks(source: Dictionary, run: string): readonly string[] {
  return projectReadings(buildLattice(source, run)).locked.map((unit) =>
    unit === undefined
      ? "?"
      : unit.reading.map((syllable) => writeSyllable(syllable)).join(" "),
  );
}

/**
 * The spans an edge contributes, written as `from-to`.
 */
function spansOf(run: string, text: string): readonly string[] {
  const found = allEdges(buildLattice(dictionary, run)).find(
    (edge) => edge.text === text,
  );
  assertNonNullable(found);
  return unitsOf(found).map(
    (unit) => `${String(unit.from)}-${String(unit.to)}`,
  );
}

describe("reading projection", () => {
  it("locks a position only one reading survives at", () => {
    assertArrayEquals(locks(dictionary, "北京"), ["běi", "jīng"]);
  });

  it("leaves a polyphone open", () => {
    assertArrayEquals(locks(dictionary, "行"), ["?"]);
  });

  it("locks around an open position rather than giving up on the run", () => {
    // 银 reads one way whichever path is taken; 行 has three readings.
    assertArrayEquals(locks(dictionary, "银行"), ["yín", "?"]);
  });

  it("counts what it locked", () => {
    const projection = projectReadings(buildLattice(dictionary, "银行"));
    assertIdentical(projection.positions, 2);
    assertIdentical(projection.lockedPositions, 1);
  });

  it("leaves both halves of a 儿化 word open, since the split disagrees", () => {
    // 玩儿 reads `wánr` over two characters where 玩 + 儿 reads `wán ér`, so
    // neither position has a single surviving claim.
    assertArrayEquals(locks(dictionary, "玩儿"), ["?", "?"]);
  });

  it("locks a word whose reading no other path can contradict", () => {
    // 垃 and 圾 read one way each, and 垃圾 agrees with both.
    assertArrayEquals(locks(dictionary, "垃圾"), ["lā", "jī"]);
  });

  it("locks only the position a disagreement does not reach", () => {
    // 好好 is read `hǎo hāo`, so the second position has two claims and the
    // first has one — and the two-character claim is not honoured at either,
    // since it is sole at neither.
    const reduplicated = dictionaryOf([
      entry("好", "hǎo"),
      entry("好好", "hǎo hāo"),
    ]);
    assertArrayEquals(locks(reduplicated, "好好"), ["hǎo", "?"]);
  });

  it("treats two edges making the same claim as one claim", () => {
    // Every edge here agrees about every character, so nothing is left open
    // even though three of them overlap.
    const agreeing = dictionaryOf([
      entry("一", "yī"),
      entry("天", "tiān"),
      entry("一天", "yī tiān"),
      entry("一天天", "yī tiān tiān"),
    ]);
    assertArrayEquals(locks(agreeing, "一天天"), ["yī", "tiān", "tiān"]);
  });

  it("locks a character with no reading at all, since it has only one claim", () => {
    assertArrayEquals(locks(dictionary, "囧"), [""]);
  });

  it("projects nothing from an empty run", () => {
    const projection = projectReadings(buildLattice(dictionary, ""));
    assertIdentical(projection.positions, 0);
    assertIdentical(projection.lockedPositions, 0);
    assertUndefined(projection.locked[0]);
  });
});

describe("reading units", () => {
  it("splits an edge that reads one syllable per character", () => {
    assertArrayEquals(spansOf("北京", "北京"), ["0-1", "1-2"]);
  });

  it("keeps an edge whose reading cannot be split whole", () => {
    assertArrayEquals(spansOf("玩儿", "玩儿"), ["0-2"]);
  });
});
