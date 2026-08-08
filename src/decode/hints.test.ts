import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { convert } from "./convert.js";
import { type ReadingHints, resolveHints } from "./hints.js";
import { allEdges, buildLattice } from "./lattice.js";

/**
 * A dictionary with the cases a hint has to reach past or into: a polyphone
 * whose word disagrees with its characters, a longer word containing a hinted
 * character, and a 儿化 word the dictionary does not hold.
 */
const dictionary = dictionaryOf([
  entry("长", "zhǎng", {
    partOfSpeech: "a",
    frequency: 20_000,
    alternates: [reading("cháng")],
  }),
  entry("校", "xiào", { partOfSpeech: "n", frequency: 8000 }),
  entry("校长", "xiào zhǎng", { partOfSpeech: "n", frequency: 4000 }),
  entry("太", "tài", { partOfSpeech: "d", frequency: 30_000 }),
  entry("不", "bù", { partOfSpeech: "d", frequency: 90_000 }),
  entry("银", "yín", { frequency: 5000 }),
  entry("行", "xíng", { frequency: 9000, alternates: [reading("háng")] }),
  entry("银行", "yín háng", { partOfSpeech: "n", frequency: 6000 }),
  entry("玩", "wán", { frequency: 7000 }),
  entry("儿", "ér", { frequency: 3000 }),
  entry("的", "de", { partOfSpeech: "uj", frequency: 95_000 }),
  entry("文章", "wén zhāng", { partOfSpeech: "n", frequency: 5000 }),
]);

/** What a text converts to under a set of hints. */
function read(text: string, readings?: ReadingHints): string {
  return convert(dictionary, text, {
    capitals: "none",
    ...(readings !== undefined && { readings }),
  });
}

describe("readings a caller asserts", () => {
  it("reads a stretch the sources read another way", () => {
    assertIdentical(read("长文章"), "zhǎng wénzhāng");
    assertIdentical(read("长文章", { 长: "cháng" }), "cháng wénzhāng");
  });

  it("leaves a longer word alone under a bare character hint", () => {
    // The property that makes a corrections table safe to accumulate: the
    // dictionary knowing 校长 outranks a caller's remark about one character.
    assertIdentical(read("校长", { 长: "cháng" }), "xiàozhǎng");
  });

  it("overrides a word the dictionary does have an opinion about", () => {
    // The exact span is the one way a word hint reaches a dictionary word, and
    // the word stays whole rather than splitting into two.
    assertIdentical(read("银行"), "yínháng");
    assertIdentical(read("银行", { 银行: "yín xíng" }), "yínxíng");
  });

  it("prefers the longer of two hints that both match", () => {
    assertIdentical(
      read("长文章", { 长: "zhǎng", 长文章: "cháng wén zhāng" }),
      "cháng wénzhāng",
    );
  });

  it("does not disturb the spacing around it", () => {
    assertIdentical(read("长的文章"), "zhǎng de wénzhāng");
    assertIdentical(read("长的文章", { 长: "cháng" }), "cháng de wénzhāng");
  });

  it("brings its own edge where the characters have no word", () => {
    // 玩儿 is not a key here, and `wánr` is one syllable over two characters,
    // so there is no per-character reading of it to write.
    assertIdentical(read("玩儿"), "wán ér");
    assertIdentical(read("玩儿", { 玩儿: "wánr" }), "wánr");
  });

  it("does not claim a dictionary entry backs an edge it brought", () => {
    // The 玩儿 edge above is the caller's word, not the dictionary's, and says
    // so — `isKnown` is what tells a reader which of the two it is looking at.
    const lattice = buildLattice(
      dictionary,
      "玩儿",
      resolveHints({ 玩儿: "wánr" }),
    );
    const brought = allEdges(lattice).find((edge) => edge.to - edge.from === 2);
    assertNonNullable(brought, "the hint brings a two-character edge");
    assertFalse(brought.isKnown);
    // A hint written over an entry the dictionary does have keeps that answer.
    const over = allEdges(
      buildLattice(dictionary, "银行", resolveHints({ 银行: "yín xíng" })),
    ).find((edge) => edge.to - edge.from === 2);
    assertNonNullable(over, "银行 is an entry");
    assertTrue(over.isKnown);
  });

  it("takes an unmarked syllable as the neutral tone", () => {
    assertIdentical(read("的", { 的: "de" }), "de");
  });
});

describe("readings a caller asserts at a position", () => {
  it("reads the character named and no other", () => {
    assertIdentical(read("长长"), "zhǎng zhǎng");
    assertIdentical(read("长长", [{ at: 0, reading: "cháng" }]), "cháng zhǎng");
    assertIdentical(read("长长", [{ at: 1, reading: "cháng" }]), "zhǎng cháng");
  });

  it("reaches inside a word, which a word hint will not", () => {
    // The escape hatch: nothing outranks a position, because the caller is
    // talking about this text rather than about the language.
    assertIdentical(read("校长", [{ at: 1, reading: "cháng" }]), "xiàocháng");
  });

  it("counts from the start of the text, across a run it is not in", () => {
    assertIdentical(read("A长", [{ at: 1, reading: "cháng" }]), "Acháng");
  });

  it("says nothing about a position in another run", () => {
    assertIdentical(
      read("长A长", [{ at: 0, reading: "cháng" }]),
      "chángAzhǎng",
    );
  });

  it("mixes with word hints in one list", () => {
    assertIdentical(
      read("校长长文章", [
        { word: "长文章", reading: "cháng wén zhāng" },
        { at: 1, reading: "cháng" },
      ]),
      "xiàocháng cháng wénzhāng",
    );
  });
});

describe("a hint that cannot be read", () => {
  /** The message a set of hints fails with. */
  function refusal(text: string, readings: ReadingHints): string {
    return assertThrowsError(() => read(text, readings)).message;
  }

  it("rejects a reading that is not pinyin", () => {
    assertStringIncludes(refusal("长", { 长: "nope" }), "is not pinyin: nope");
  });

  it("rejects an empty reading", () => {
    assertStringIncludes(refusal("长", { 长: "  " }), "is empty");
  });

  it("rejects an empty word", () => {
    assertStringIncludes(refusal("长", { "": "cháng" }), "has no word");
  });

  it("rejects a reading of more than one syllable at a position", () => {
    // A position names one character, so there is nowhere to put a second
    // syllable. Before this it parsed and was then quietly dropped, which is
    // the one outcome a correction must never have.
    assertStringIncludes(
      refusal("校长", [{ at: 1, reading: "cháng zhǎng" }]),
      "is not one syllable: cháng zhǎng",
    );
  });

  it("rejects a position that is not an index", () => {
    assertStringIncludes(
      refusal("长", [{ at: -1, reading: "cháng" }]),
      "not an index",
    );
    assertStringIncludes(
      refusal("长", [{ at: 1.5, reading: "cháng" }]),
      "not an index",
    );
  });

  it("is reported whether or not a run reaches it", () => {
    // Parsed once for the whole text, so a table with a mistake in it fails on
    // the mistake rather than on whichever text happens to contain the word.
    assertStringIncludes(refusal("校", { 长: "nope" }), "is not pinyin");
  });
});
