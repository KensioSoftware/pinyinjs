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

import { segment } from "./segment.js";

const dictionary = sampleDictionary();

/**
 * The words a text segments into, as text.
 */
function words(text: string): readonly string[] {
  return segment(dictionary, text).map((found) => found.text);
}

describe("segmenting a text", () => {
  it("finds words rather than characters", () => {
    assertArrayEquals(words("银行"), ["银行"]);
  });

  it("cuts where the reading says to, not where the longest match is", () => {
    // The case the whole decoder exists for: 行长 and 银行 both claim 行, and
    // only one cut leaves both words standing.
    assertArrayEquals(words("行长银行"), ["行长", "银行"]);
  });

  it("gives back every stretch of the text, in order", () => {
    assertArrayEquals(words("银行。"), ["银行", "。"]);
  });

  it("rejoins into exactly the text it was given", () => {
    // The property that makes it safe to rebuild a document from: nothing is
    // dropped, nothing is rewritten, and the order is the text's own.
    for (const text of ["银行。", "hello 银行", "玩儿", "北京市", ""]) {
      assertIdentical(words(text).join(""), text);
    }
  });

  it("says where each word starts, in code points", () => {
    const found = segment(dictionary, "去银行。");
    assertArrayEquals(
      found.map((one) => one.at),
      [0, 1, 3],
    );
  });

  it("counts a character outside the basic plane as one position", () => {
    // 𠮷 is two UTF-16 units and one character, and a position that counted
    // units would put every later word one out.
    const found = segment(dictionary, "𠮷银行");
    assertIdentical(found.at(-1)?.at, 1);
  });

  it("carries the tag and the proper-noun mark", () => {
    const found = segment(dictionary, "北京")[0];
    assertNonNullable(found);
    assertTrue(found.isProperNoun);
    assertIdentical(found.partOfSpeech, "ns");
  });

  it("carries the reading, which need not be one syllable per character", () => {
    // 玩儿 is two characters and the single syllable wánr.
    const found = segment(dictionary, "玩儿")[0];
    assertNonNullable(found);
    assertArrayLength(found.reading, 1);
  });

  it("marks a stretch that was never Han as unknown, with no reading", () => {
    const found = segment(dictionary, "银行。").at(-1);
    assertNonNullable(found);
    assertFalse(found.isKnown);
    assertArrayLength(found.reading, 0);
    assertIdentical(found.partOfSpeech, "");
  });

  it("counts a lone character the dictionary holds as known", () => {
    // isKnown is about the entry, not about wordhood: 天 stands alone here and
    // the dictionary has it, so a caller filtering on it keeps the character.
    const found = segment(dictionary, "天")[0];
    assertNonNullable(found);
    assertTrue(found.isKnown);
  });

  it("marks a Han character no source can read as unknown", () => {
    const found = segment(dictionary, "龘")[0];
    assertNonNullable(found);
    assertFalse(found.isKnown);
  });

  it("takes the number in front of a run into account", () => {
    // The one thing outside a Han run that moves a boundary inside it: the 个
    // counts with the 2, where 个人 alone is a word.
    assertArrayEquals(words("2个"), ["2", "个"]);
    assertArrayEquals(words("个"), ["个"]);
  });

  it("does not apply the word spacing pinyin is written with", () => {
    // 分词连写 attaches an aspect particle to its verb, which is a fact about
    // writing pinyin rather than about where the words are.
    assertArrayEquals(words("大了"), ["大", "了"]);
  });

  it("segments nothing at all as nothing at all", () => {
    assertArrayLength(segment(dictionary, ""), 0);
  });
});
