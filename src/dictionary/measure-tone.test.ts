import {
  assertArrayEquals,
  assertIdentical,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { toCharacters } from "../script/characters.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import type { DictionaryEntry } from "./entry.js";
import { countingToneAt, settleMeasureTones } from "./measure-tone.js";

/**
 * Read a space-separated reading, refusing anything that is not one.
 *
 * Throws rather than asserting non-null so a typo in a fixture cannot pass as
 * an unsettled 个.
 */
function reading(text: string): readonly Syllable[] {
  return text.split(" ").map((token) => {
    const syllable = readSyllable(token);
    if (syllable === undefined) {
      throw new Error(`not a syllable: ${token}`);
    }
    return syllable;
  });
}

/**
 * An entry holding nothing the pass reads but the word and its reading.
 */
function entryFor(hans: string, cn: string): DictionaryEntry {
  return {
    hans,
    hant: hans,
    readings: { cn: reading(cn) },
    frequency: 0,
    partOfSpeech: "",
    isProperNoun: false,
  };
}

/**
 * How the pass reads one word, as written syllables.
 */
function settled(hans: string, cn: string): readonly string[] {
  const { entries } = settleMeasureTones([entryFor(hans, cn)]);
  return (entries[0]?.readings.cn ?? []).map((syllable) =>
    writeSyllable(syllable),
  );
}

describe("countingToneAt", () => {
  it("gives the tone to a 个 a numeral counts with", () => {
    assertIdentical(countingToneAt(toCharacters("一个"), 1), 4);
  });

  it("gives the tone to a numeral written 繁體", () => {
    assertIdentical(countingToneAt(toCharacters("兩個"), 1), 4);
  });

  it("takes it away after a listed determiner", () => {
    assertIdentical(countingToneAt(toCharacters("那个"), 1), NEUTRAL_TONE);
  });

  it("settles a 个 wherever in the word it sits", () => {
    assertIdentical(countingToneAt(toCharacters("我这个人"), 2), NEUTRAL_TONE);
  });

  it("settles nothing for a 个 that starts the word", () => {
    assertUndefined(countingToneAt(toCharacters("个人"), 0));
  });

  it("settles nothing where neither a numeral nor a determiner leads", () => {
    assertUndefined(countingToneAt(toCharacters("几个"), 1));
  });
});

describe("settleMeasureTones", () => {
  it("writes the tone on a counted 个", () => {
    assertArrayEquals(settled("一个", "yī ge5"), ["yī", "gè"]);
  });

  it("holds a longer key to the same answer", () => {
    assertArrayEquals(settled("上一个", "shàng yī ge5"), ["shàng", "yī", "gè"]);
  });

  it("takes the tone off a 个 a determiner leads", () => {
    assertArrayEquals(settled("那个人", "nà gè rén"), ["nà", "ge", "rén"]);
  });

  it("settles both 个 of a word holding two", () => {
    assertArrayEquals(settled("一个接一个", "yī ge5 jiē yī ge5"), [
      "yī",
      "gè",
      "jiē",
      "yī",
      "gè",
    ]);
  });

  it("leaves a 个 nothing counts as its source wrote it", () => {
    assertArrayEquals(settled("半个", "bàn ge5"), ["bàn", "ge"]);
  });

  it("leaves 个's other reading alone, wherever it sits", () => {
    assertArrayEquals(settled("独自个", "dú zì gě"), ["dú", "zì", "gě"]);
    // 那 settles the position, and a `gě` there would be a different word.
    assertArrayEquals(settled("那个", "nà gě"), ["nà", "gě"]);
  });

  it("leaves a reading that names no character per syllable", () => {
    // 单个儿 is `dān gèr` over three characters, so nothing here says which
    // character the second syllable reads.
    assertArrayEquals(settled("单个儿", "dān gèr"), ["dān", "gèr"]);
  });

  it("counts only the entries it moved", () => {
    const { settled: moved } = settleMeasureTones([
      entryFor("一个", "yī ge5"),
      entryFor("两个", "liǎng gè"),
      entryFor("半个", "bàn ge5"),
    ]);
    assertIdentical(moved, 1);
  });

  it("returns the same entry object where nothing moved", () => {
    const held = entryFor("两个", "liǎng gè");
    const { entries } = settleMeasureTones([held]);
    assertIdentical(entries[0], held);
  });
});
