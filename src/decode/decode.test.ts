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
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import {
  decodeReadings,
  decodeRun,
  decodeRunScored,
  decodeSpacing,
} from "./decode.js";
import { buildLattice } from "./lattice.js";
import { projectReadings } from "./locking.js";
import { READING_RULES } from "./reading-rules.js";

const dictionary = sampleDictionary();

/**
 * The words a run decodes into, as their written characters.
 */
function words(run: string): readonly string[] {
  return decodeRun(dictionary, run).map((word) => word.text);
}

/**
 * The reading a run decodes to, written out.
 */
function readingOf(run: string): string {
  return decodeRun(dictionary, run)
    .flatMap((word) => word.reading.map((syllable) => writeSyllable(syllable)))
    .join(" ");
}

describe("the lattice decoder", () => {
  it("reads a word the dictionary knows", () => {
    assertArrayEquals(words("银行"), ["银行"]);
    assertIdentical(readingOf("银行"), "yín háng");
  });

  it("reads a polyphone from the word it is in", () => {
    assertIdentical(readingOf("行长"), "háng zhǎng");
  });

  it("falls back to a character's most likely reading where no word matches", () => {
    assertIdentical(readingOf("行"), "xíng");
  });

  it("decodes a run into several words", () => {
    assertArrayEquals(words("北京银行"), ["北京", "银行"]);
  });

  it("carries the proper noun flag and tag through", () => {
    const decoded = decodeRun(dictionary, "北京");
    assertNonNullable(decoded[0]);
    assertTrue(decoded[0].isProperNoun);
    assertIdentical(decoded[0].partOfSpeech, "ns");
  });

  it("finds a word under its 繁體 key", () => {
    assertArrayEquals(words("銀行"), ["銀行"]);
    assertIdentical(readingOf("銀行"), "yín háng");
  });

  it("reads 儿化 as the one syllable it is", () => {
    assertArrayEquals(words("玩儿"), ["玩儿"]);
    assertIdentical(readingOf("玩儿"), "wánr");
  });

  it("keeps a character it has no reading for, rather than dropping it", () => {
    const decoded = decodeRun(dictionary, "囧");
    assertArrayLength(decoded, 1);
    assertIdentical(decoded[0].text, "囧");
    assertArrayLength(decoded[0].reading, 0);
    assertFalse(decoded[0].isKnown);
  });

  it("decodes an empty run to nothing", () => {
    assertArrayLength(decodeRun(dictionary, ""), 0);
  });

  it("beats the greedy baseline where the longest match is the wrong one", () => {
    const overlapping = dictionaryOf([
      entry("银", "yín", { frequency: 4000 }),
      entry("行", "xíng", { alternates: [reading("háng")] }),
      entry("长", "zhǎng", { frequency: 40 }),
      entry("银行", "yín háng", { frequency: 40 }),
      entry("行长", "háng zhǎng", { frequency: 400_000 }),
    ]);
    assertArrayEquals(
      decodeRun(overlapping, "银行长").map((word) => word.text),
      ["银", "行长"],
    );
  });
});

describe("the reading decode", () => {
  it("takes a settled stretch from the locks without scoring it", () => {
    // Every position of 北京 locks, so the readings come straight from the
    // projection and no path is ever run over that stretch.
    const lattice = buildLattice(dictionary, "北京");
    const projection = projectReadings(lattice);
    assertIdentical(projection.lockedPositions, projection.positions);
    assertArrayEquals(
      decodeReadings(lattice, projection).map((unit) =>
        unit.reading.map((syllable) => writeSyllable(syllable)).join(""),
      ),
      ["běi", "jīng"],
    );
  });

  it("scores a stretch that did not settle", () => {
    const lattice = buildLattice(dictionary, "银行");
    const projection = projectReadings(lattice);
    assertTrue(projection.lockedPositions < projection.positions);
    assertArrayEquals(
      decodeReadings(lattice, projection).map((unit) =>
        unit.reading.map((syllable) => writeSyllable(syllable)).join(""),
      ),
      ["yín", "háng"],
    );
  });
});

describe("the spacing decode", () => {
  it("reports where the words begin", () => {
    assertArrayEquals(
      [...decodeSpacing(buildLattice(dictionary, "北京银行"))],
      [0, 2],
    );
  });

  it("is advisory: a boundary inside a reading unit is dropped", () => {
    // 玩儿 is one syllable over two characters, so even a spacing decode that
    // wanted to split 玩 from 儿 could not be allowed to.
    assertArrayEquals(words("玩儿"), ["玩儿"]);
    assertArrayLength(decodeRun(dictionary, "玩儿")[0]?.reading ?? [], 1);
  });
});

/**
 * The words a run decodes into with context in front of it.
 */
function after(before: string, run: string): readonly string[] {
  return decodeRun(dictionary, run, READING_RULES, before).map(
    (word) => word.text,
  );
}

describe("the Han in front of a run", () => {
  it("changes what the run decodes to, and is not reported", () => {
    // 行长 on its own is one word. Put a 银 in front and the 行 belongs to
    // 银行 instead, leaving 长 to itself — and the 银 is the caller's, so it
    // comes back with neither a word nor a reading of its own.
    assertArrayEquals(words("行长"), ["行长"]);
    assertArrayEquals(after("银", "行长"), ["行", "长"]);
    assertIdentical(
      decodeRun(dictionary, "行长", READING_RULES, "银")
        .flatMap((word) => word.reading.map((s) => writeSyllable(s)))
        .join(" "),
      "háng zhǎng",
    );
  });

  it("decodes the run alone where a reading straddles the join", () => {
    // 玩儿 is `wánr`, one syllable over the 玩 the context supplied and the 儿
    // the run did, and no part of it can be handed back on its own.
    assertArrayEquals(after("玩", "儿"), ["儿"]);
  });

  it("is nothing by default, which is every other caller", () => {
    assertArrayEquals(after("", "行长"), words("行长"));
  });
});

describe("the scored decode", () => {
  it("decodes the same words as the plain decode", () => {
    assertArrayEquals(
      decodeRunScored(dictionary, "北京银行").map((scored) => scored.word.text),
      words("北京银行"),
    );
  });

  it("reports confidence for every syllable of a word", () => {
    const scored = decodeRunScored(dictionary, "银行");
    assertNonNullable(scored[0]);
    assertArrayLength(scored[0].confidence, scored[0].word.reading.length);
  });

  it("reports a settled word as locked throughout", () => {
    const scored = decodeRunScored(dictionary, "北京");
    assertNonNullable(scored[0]);
    assertTrue(scored[0].confidence.every((spot) => spot.isLocked));
  });

  it("reports the reading a polyphone was chosen over", () => {
    const scored = decodeRunScored(dictionary, "银行");
    assertNonNullable(scored[0]);
    assertNonNullable(scored[0].confidence[1]);
    assertArrayEquals(
      scored[0].confidence[1].alternatives.map((alternative) =>
        alternative.reading.map((syllable) => writeSyllable(syllable)).join(""),
      ),
      ["xíng", "héng"],
    );
  });

  it("reports one entry per syllable, not per character", () => {
    // 玩儿 is two characters and one syllable.
    const scored = decodeRunScored(dictionary, "玩儿");
    assertNonNullable(scored[0]);
    assertArrayLength(scored[0].confidence, 1);
  });

  it("reports nothing for a character it has no reading for", () => {
    const scored = decodeRunScored(dictionary, "囧");
    assertNonNullable(scored[0]);
    assertArrayLength(scored[0].confidence, 0);
  });
});
