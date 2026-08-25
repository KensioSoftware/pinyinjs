import { assertIdentical, assertNonNullable } from "@kensio/smartass";
import { describe, it } from "vitest";

import { readSyllable, type Syllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import { carryToTraditional, isTagged } from "./traditional-carry.js";

/**
 * A reading, for entries whose reading these tests do not care about.
 */
function reading(text: string): readonly Syllable[] {
  const syllable = readSyllable(text);
  assertNonNullable(syllable);
  return [syllable];
}

/**
 * An entry, with the fields the carry reads.
 */
function entry(
  hans: string,
  hant: string,
  partOfSpeech: string,
  frequency = 1000,
): DictionaryEntry {
  return {
    hans,
    hant,
    readings: { cn: reading("jiàn") },
    frequency,
    partOfSpeech,
    isProperNoun: false,
  };
}

/**
 * The tag each spelling carries after the pass.
 */
function tagsAfter(
  entries: readonly DictionaryEntry[],
): ReadonlyMap<string, string> {
  const { entries: carried } = carryToTraditional(entries);
  return new Map(
    carried.map((one: DictionaryEntry) => [one.hans, one.partOfSpeech]),
  );
}

/**
 * The count each spelling carries after the pass.
 */
function countsAfter(
  entries: readonly DictionaryEntry[],
): ReadonlyMap<string, number> {
  const { entries: carried } = carryToTraditional(entries);
  return new Map(
    carried.map((one: DictionaryEntry) => [one.hans, one.frequency]),
  );
}

describe("reading a tag", () => {
  it("takes jieba's uncategorised tag for no tag at all", () => {
    // `zg` is written on a character jieba counted and did not classify, 简体
    // and 繁體 alike, so it says the character was seen rather than what it is.
    assertIdentical(isTagged("zg"), false);
    assertIdentical(isTagged(""), false);
    assertIdentical(isTagged("v"), true);
    assertIdentical(isTagged("ns"), true);
  });
});

describe("carrying a tag to the 繁體 spelling", () => {
  it("gives an untagged spelling the tag its 简体 word carries", () => {
    const tags = tagsAfter([entry("听", "聽", "v"), entry("聽", "聽", "")]);
    assertIdentical(tags.get("聽"), "v");
  });

  it("reaches a spelling jieba left uncategorised", () => {
    const tags = tagsAfter([entry("来", "來", "v"), entry("來", "來", "zg")]);
    assertIdentical(tags.get("來"), "v");
  });

  it("leaves a spelling jieba did classify alone", () => {
    // 個 is `q` in its own right for this test, and nothing about 个 having
    // one too should overwrite it.
    const tags = tagsAfter([entry("个", "個", "m"), entry("個", "個", "q")]);
    assertIdentical(tags.get("個"), "q");
  });

  it("leaves the 简体 word alone, which is where the tag came from", () => {
    const tags = tagsAfter([entry("听", "聽", "v"), entry("聽", "聽", "")]);
    assertIdentical(tags.get("听"), "v");
  });

  it("says nothing where the 简体 word has nothing to say", () => {
    const tags = tagsAfter([entry("讀", "讀", ""), entry("读", "讀", "zg")]);
    assertIdentical(tags.get("讀"), "");
  });

  it("keeps a proper noun's tag where it is", () => {
    // The tag travels with `isProperNoun`, which `properNounOf` settles from
    // jieba and CC-CEDICT together and can veto. Carrying one without the
    // other would leave an entry claiming a name it also denies.
    const tags = tagsAfter([
      entry("汤姆", "湯姆", "nr"),
      entry("湯姆", "湯姆", ""),
    ]);
    assertIdentical(tags.get("湯姆"), "");
  });

  it("lends from the commoner word where two name one spelling", () => {
    const tags = tagsAfter([
      entry("后", "後", "f", 200),
      entry("厚", "後", "a", 900),
      entry("後", "後", ""),
    ]);
    assertIdentical(tags.get("後"), "a");
  });

  it("counts what it carried", () => {
    const { carriedTags } = carryToTraditional([
      entry("听", "聽", "v"),
      entry("聽", "聽", "", 0),
      entry("读", "讀", "v"),
      entry("讀", "讀", "zg", 0),
      entry("看", "看", "v"),
    ]);
    assertIdentical(carriedTags, 2);
  });

  it("lends a tag from a rarer word where the commoner one has none", () => {
    const tags = tagsAfter([
      entry("甲", "後", "", 9000),
      entry("厚", "後", "a", 200),
      entry("後", "後", "", 0),
    ]);
    assertIdentical(tags.get("後"), "a");
  });
});

describe("carrying a count to the 繁體 spelling", () => {
  it("gives an uncounted spelling the count its 简体 word carries", () => {
    const counts = countsAfter([
      entry("听", "聽", "v", 20_435),
      entry("聽", "聽", "", 0),
    ]);
    assertIdentical(counts.get("聽"), 20_435);
  });

  it("takes the larger of the two, not the lender's outright", () => {
    // A 繁體 spelling jieba counted at all was counted incidentally in a
    // corpus written the other way.
    const counts = countsAfter([
      entry("过", "過", "ug", 40_000),
      entry("過", "過", "zg", 300),
    ]);
    assertIdentical(counts.get("過"), 40_000);
  });

  it("leaves a spelling counted more often than its 简体 word alone", () => {
    const counts = countsAfter([
      entry("台", "臺", "n", 100),
      entry("臺", "臺", "n", 900),
    ]);
    assertIdentical(counts.get("臺"), 900);
  });

  it("leaves the 简体 word alone, which is where the count came from", () => {
    const counts = countsAfter([
      entry("听", "聽", "v", 20_435),
      entry("聽", "聽", "", 0),
    ]);
    assertIdentical(counts.get("听"), 20_435);
  });

  it("lends nothing where the 简体 word was counted nowhere either", () => {
    const counts = countsAfter([
      entry("讀", "讀", "", 0),
      entry("读", "讀", "", 0),
    ]);
    assertIdentical(counts.get("讀"), 0);
  });

  it("counts what it carried", () => {
    const { carriedCounts } = carryToTraditional([
      entry("听", "聽", "v", 20_435),
      entry("聽", "聽", "", 0),
      entry("过", "過", "ug", 40_000),
      entry("過", "過", "zg", 300),
      entry("看", "看", "v", 900),
    ]);
    assertIdentical(carriedCounts, 2);
  });
});
