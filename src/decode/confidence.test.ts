import {
  dictionaryOf,
  entry,
  reading,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertNumberBetween,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import type { Dictionary } from "../dictionary/dictionary.js";
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import { isUncertain, scoreReadings, type ScoredUnit } from "./confidence.js";
import { buildLattice, READING_CHARGE } from "./lattice.js";
import { projectReadings } from "./locking.js";

const dictionary = sampleDictionary();

/**
 * Score a run's readings with the shared test dictionary.
 */
function score(
  run: string,
  source: Dictionary = dictionary,
): readonly ScoredUnit[] {
  const lattice = buildLattice(source, run);
  return scoreReadings(lattice, projectReadings(lattice));
}

/**
 * A written reading, whether it is one syllable or several.
 */
function written(reading: readonly Syllable[]): string {
  return reading.map((syllable) => writeSyllable(syllable)).join("");
}

/**
 * The unit covering a character position.
 */
function unitAt(units: readonly ScoredUnit[], at: number): ScoredUnit {
  const found = units.find((unit) => unit.from <= at && at < unit.to);
  assertNonNullable(found);
  return found;
}

describe("scoring a run's readings", () => {
  it("reads the same run the decode does", () => {
    assertArrayEquals(
      score("银行").map((unit) => written(unit.reading)),
      ["yín", "háng"],
    );
  });

  it("reports a locked reading as locked, with nothing rejected", () => {
    const locked = unitAt(score("银行"), 0);
    assertTrue(locked.isLocked);
    assertArrayLength(locked.alternatives, 0);
  });

  it("reports what an open reading was chosen over", () => {
    const open = unitAt(score("银行"), 1);
    assertFalse(open.isLocked);
    assertArrayEquals(
      open.alternatives.map((alternative) => written(alternative.reading)),
      ["xíng", "héng"],
    );
  });

  it("prices a rejected reading by the cheapest decode that takes it", () => {
    // Reading 行 as xíng here means giving up the word 银行 and paying for a
    // second word, which is what the reading charge is.
    const open = unitAt(score("银行"), 1);
    assertNonNullable(open.alternatives[0]);
    assertNumberBetween(
      open.alternatives[0].cost,
      READING_CHARGE,
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("orders what it rejected cheapest first", () => {
    const costs = unitAt(score("银行"), 1).alternatives.map(
      (alternative) => alternative.cost,
    );
    assertArrayEquals(
      [...costs].toSorted((left, right) => left - right),
      [...costs],
    );
  });

  it("charges a character's alternate readings by their rank alone", () => {
    // Nothing in the data says how much likelier a character's first reading
    // is than its second, so with no word to appeal to they sit one frequency
    // bucket apart — which is why the cost is evidence of evidence, and not a
    // probability. See ROADMAP.md.
    const alone = unitAt(score("行"), 0);
    assertArrayEquals(
      alone.alternatives.map((alternative) => alternative.cost),
      [1, 2],
    );
  });

  it("keeps a rival that spans differently, rather than only the same span", () => {
    // 玩儿 reads as one syllable over two characters; 玩 followed by 儿 is a
    // claim about different stretches and still competes with it.
    const erhua = unitAt(score("玩儿"), 0);
    assertIdentical(written(erhua.reading), "wánr");
    assertTrue(
      erhua.alternatives.some(
        (alternative) => alternative.to - alternative.from === 1,
      ),
    );
  });

  it("skips a settled stretch, which has nothing to report", () => {
    const settled = score("北京");
    assertArrayEquals(
      settled.map((unit) => written(unit.reading)),
      ["běi", "jīng"],
    );
    assertTrue(settled.every((unit) => unit.isLocked));
    assertTrue(settled.every((unit) => unit.alternatives.length === 0));
  });

  it("scores an empty run as nothing", () => {
    assertArrayLength(score(""), 0);
  });

  it("keeps a character it has no reading for", () => {
    const unknown = score("囧");
    assertArrayLength(unknown, 1);
    assertArrayLength(unknown[0].reading, 0);
  });

  it("prices a rival by what it forces around it, not only by itself", () => {
    // Reading 银 here as anything but yín is impossible, so the whole cost of
    // rejecting 行长 falls on the one position that could vary.
    const overlapping = dictionaryOf([
      entry("银", "yín", { frequency: 4000 }),
      entry("行", "xíng", { alternates: [reading("háng")] }),
      entry("长", "zhǎng", { frequency: 40 }),
      entry("行长", "háng zhǎng", { frequency: 400_000 }),
    ]);
    const open = unitAt(score("银行长", overlapping), 1);
    assertIdentical(written(open.reading), "háng");
    assertNonNullable(open.alternatives[0]);
    assertNumberBetween(
      open.alternatives[0].cost,
      READING_CHARGE,
      Number.MAX_SAFE_INTEGER,
    );
  });
});

describe("reporting a reading as uncertain", () => {
  it("calls a locked reading certain", () => {
    const locked = unitAt(score("银行"), 0);
    assertFalse(isUncertain(locked));
  });

  it("calls a reading the dictionary backs certain", () => {
    // 行 in 银行 is open — the character has three readings — but taking
    // another one means breaking the word apart.
    const backed = unitAt(score("银行"), 1);
    assertFalse(backed.isLocked);
    assertFalse(isUncertain(backed));
  });

  it("calls a bare polyphone uncertain", () => {
    const alone = unitAt(score("行"), 0);
    assertTrue(isUncertain(alone));
    assertNonNullable(alone.alternatives[0]);
    assertIdentical(alone.alternatives[0].cost, 1);
  });
});
