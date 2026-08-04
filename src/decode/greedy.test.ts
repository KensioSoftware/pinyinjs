import { sampleDictionary } from "#test/fixtures/decoder-dictionary.js";
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
import { decodeGreedily } from "./greedy.js";

const dictionary = sampleDictionary();

/**
 * The words a run decodes into, as their written characters.
 */
function words(run: string): readonly string[] {
  return decodeGreedily(dictionary, run).map((word) => word.text);
}

/**
 * The reading a run decodes to, written out.
 */
function readingOf(run: string): string {
  return decodeGreedily(dictionary, run)
    .flatMap((word) => word.reading.map((syllable) => writeSyllable(syllable)))
    .join(" ");
}

describe("the greedy baseline decoder", () => {
  it("takes the longest match at each position", () => {
    assertArrayEquals(words("银行"), ["银行"]);
    assertIdentical(readingOf("银行"), "yín háng");
  });

  it("reads a polyphone from the word it is in", () => {
    assertIdentical(readingOf("行长"), "háng zhǎng");
  });

  it("falls back to a character's own reading where no word matches", () => {
    assertArrayEquals(words("行"), ["行"]);
    assertIdentical(readingOf("行"), "xíng");
  });

  it("stops scanning as soon as no word carries the prefix", () => {
    // 银大 is not a word and nothing starts with it, so the scan gives up after
    // one character rather than walking to the length limit.
    assertArrayEquals(words("银大"), ["银", "大"]);
  });

  it("decodes a run into several words", () => {
    assertArrayEquals(words("北京银行"), ["北京", "银行"]);
  });

  it("carries the proper noun flag through", () => {
    const decoded = decodeGreedily(dictionary, "北京");
    assertNonNullable(decoded[0]);
    assertTrue(decoded[0].isProperNoun);
    assertIdentical(decoded[0].partOfSpeech, "ns");
  });

  it("finds a word under its 繁體 key", () => {
    assertArrayEquals(words("銀行"), ["銀行"]);
    assertIdentical(readingOf("銀行"), "yín háng");
  });

  it("reads 儿化 as the one syllable it is", () => {
    assertArrayLength(decodeGreedily(dictionary, "玩儿")[0]?.reading ?? [], 1);
    assertIdentical(readingOf("玩儿"), "wánr");
  });

  it("keeps a character it has no reading for, rather than dropping it", () => {
    const decoded = decodeGreedily(dictionary, "囧");
    assertArrayLength(decoded, 1);
    assertIdentical(decoded[0].text, "囧");
    assertArrayLength(decoded[0].reading, 0);
    assertFalse(decoded[0].isKnown);
  });

  it("reports a dictionary match as known", () => {
    assertTrue(decodeGreedily(dictionary, "银行")[0]?.isKnown ?? false);
  });

  it("decodes an empty run to nothing", () => {
    assertArrayLength(decodeGreedily(dictionary, ""), 0);
  });

  it("is locally optimal, which is the flaw it exists to demonstrate", () => {
    // 长大 is a word and so is 大, so a greedy scan takes 长大 and never
    // reconsiders — there is no scoring that could prefer another split.
    assertArrayEquals(words("长大"), ["长大"]);
  });
});
