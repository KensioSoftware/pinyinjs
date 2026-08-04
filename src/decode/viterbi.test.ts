import {
  dictionaryOf,
  entry,
  reading,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import { assertArrayEquals, assertArrayLength } from "@kensio/smartass";
import { describe, it } from "vitest";

import { decodeGreedily } from "./greedy.js";
import { buildLattice } from "./lattice.js";
import { readingCost, shortestPath, spacingCost } from "./viterbi.js";

const dictionary = sampleDictionary();

/**
 * The words a decode of a whole run picks, by their characters.
 */
function path(
  source: ReturnType<typeof sampleDictionary>,
  run: string,
  costOf: typeof spacingCost,
): readonly string[] {
  const lattice = buildLattice(source, run);
  return shortestPath(lattice, 0, lattice.characters.length, costOf).map(
    (edge) => edge.text,
  );
}

describe("the shortest path", () => {
  it("prefers a common word to its characters", () => {
    assertArrayEquals(path(dictionary, "北京", spacingCost), ["北京"]);
  });

  it("reconsiders a choice the greedy baseline could not", () => {
    // 银行 is the longest match at position 0, so greedy takes it and never
    // looks again, leaving 长 stranded. Scoring the whole run instead can see
    // that 行长 is worth far more than 银行 is here and trade one for the other.
    const overlapping = dictionaryOf([
      entry("银", "yín", { frequency: 4000 }),
      entry("行", "xíng", { alternates: [reading("háng")] }),
      entry("长", "zhǎng", { frequency: 40 }),
      entry("银行", "yín háng", { frequency: 40 }),
      entry("行长", "háng zhǎng", { frequency: 400_000 }),
    ]);
    assertArrayEquals(path(overlapping, "银行长", spacingCost), ["银", "行长"]);
    assertArrayEquals(
      decodeGreedily(overlapping, "银行长").map((word) => word.text),
      ["银行", "长"],
    );
  });

  it("takes only edges inside the stretch it is given", () => {
    const lattice = buildLattice(dictionary, "银行");
    // 银行 spans both characters, so a decode of the first character alone
    // cannot use it.
    assertArrayEquals(
      shortestPath(lattice, 0, 1, spacingCost).map((edge) => edge.text),
      ["银"],
    );
  });

  it("splits a rare word for spacing and keeps it whole for reading", () => {
    const rare = dictionaryOf([
      entry("地", "de", { alternates: [reading("dì")], frequency: 160_541 }),
      entry("气", "qì", { frequency: 17_826 }),
      entry("地气", "dì qì", { frequency: 44 }),
    ]);
    assertArrayEquals(path(rare, "地气", spacingCost), ["地", "气"]);
    assertArrayEquals(path(rare, "地气", readingCost), ["地气"]);
  });

  it("decodes an empty stretch to nothing", () => {
    assertArrayLength(
      shortestPath(buildLattice(dictionary, ""), 0, 0, spacingCost),
      0,
    );
  });
});
