import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { normaliseQuery, readQueryChunks, skipSeparators } from "./query.js";

/**
 * A syllable to read a query against.
 */
function one(pinyin: string): Syllable {
  const syllable = readSyllable(pinyin);
  assertNonNullable(syllable, pinyin);
  return syllable;
}

/**
 * Where a query can be read up to, taking one syllable from a position.
 */
function chunks(query: string, at: number, pinyin: string): readonly number[] {
  return readQueryChunks(query, at, one(pinyin)).map((chunk) => chunk.next);
}

describe("normalising a query", () => {
  it("drops case", () => {
    assertIdentical(normaliseQuery("BeiJing"), "beijing");
  });

  it("writes every separator as one space", () => {
    assertIdentical(normaliseQuery("bei   jing"), "bei jing");
    assertIdentical(normaliseQuery("xi'an"), "xi an");
    assertIdentical(normaliseQuery("gan-jing"), "gan jing");
    assertIdentical(normaliseQuery("  bei jing  "), "bei jing");
  });

  it("takes every ü convention", () => {
    assertIdentical(normaliseQuery("lv"), "lü");
    assertIdentical(normaliseQuery("lu:"), "lü");
    assertIdentical(normaliseQuery("lü"), "lü");
    assertIdentical(normaliseQuery("LV"), "lü");
  });

  it("drops a tone written as a mark, keeping the ü of one", () => {
    // Where the syllable ends is what a mark cannot say, and a query is text
    // whose syllables are not settled yet. A digit says it by being there.
    assertIdentical(normaliseQuery("běijīng"), "beijing");
    assertIdentical(normaliseQuery("lǜ"), "lü");
    assertIdentical(normaliseQuery("bei3jing1"), "bei3jing1");
  });

  it("normalises a query that was typed as combining marks", () => {
    assertIdentical(normaliseQuery("béi"), "bei");
  });

  it("normalises a query of nothing but separators to nothing", () => {
    assertIdentical(normaliseQuery("  -  "), "");
    assertIdentical(normaliseQuery(""), "");
  });
});

describe("stepping over separators", () => {
  it("stops at the first letter", () => {
    assertIdentical(skipSeparators("bei jing", 3), 4);
    assertIdentical(skipSeparators("bei jing", 0), 0);
  });

  it("stops at the end of the query", () => {
    assertIdentical(skipSeparators("bei ", 3), 4);
  });
});

describe("reading one syllable out of a query", () => {
  it("offers every form the query could be writing at once", () => {
    // `bei` is 北 written out; the `b` of it is 北 abbreviated, with `eijing`
    // still to account for. Which of them the query meant is not a question
    // one syllable can answer, so both are offered and the search settles it.
    assertArrayEquals(chunks("beijing", 0, "běi"), [3, 1]);
  });

  it("takes a syllable abbreviated to its initial", () => {
    assertArrayEquals(chunks("bjing", 0, "běi"), [1]);
  });

  it("takes the first letter of a syllable that has no initial", () => {
    // 安 is typed `a` by anybody abbreviating it, and has no initial at all,
    // which is why the abbreviation is taken from the spelling.
    assertArrayEquals(chunks("an", 0, "ān"), [2, 1]);
    assertArrayEquals(chunks("yj", 0, "yī"), [1]);
  });

  it("takes a retroflex initial with or without its h", () => {
    assertArrayEquals(chunks("zw", 0, "zhōng"), [1]);
    assertArrayEquals(chunks("zhw", 0, "zhōng"), [1, 2]);
  });

  it("takes a tone written as a digit, where the reading carries it", () => {
    assertArrayEquals(chunks("bei3jing1", 0, "běi"), [4, 3, 1]);
    // 北 is běi, so `bei1` accounts for the spelling and not for the digit,
    // which leaves a digit no later syllable can start with.
    assertArrayEquals(chunks("bei1jing1", 0, "běi"), [3, 1]);
  });

  it("takes any digit against a reading that writes no tone", () => {
    // 西 is stored as `xi` with `xī` beside it, and a stored reading with no
    // tone on it cannot contradict the one a query wrote.
    assertArrayEquals(chunks("xi1", 0, "xi"), [3, 2, 1]);
  });

  it("takes a syllable the query merely starts, at the end of the query", () => {
    assertArrayEquals(chunks("be", 0, "běi"), [1, 2]);
    assertArrayEquals(chunks("zho", 0, "zhōng"), [1, 2, 3]);
  });

  it("refuses a part-syllable with more query behind it", () => {
    // `bejing` is a typo rather than an abbreviation, and a search box is not
    // where a typo should be guessed at: the `b` is taken as an initial, and
    // nothing takes the `be`.
    assertArrayEquals(chunks("bejing", 0, "běi"), [1]);
  });

  it("refuses a syllable the query does not start", () => {
    assertArrayLength(readQueryChunks("jing", 0, one("běi")), 0);
  });

  it("reads a ü syllable a query wrote with v", () => {
    assertArrayEquals(chunks(normaliseQuery("lvse"), 0, "lǜ"), [2, 1]);
  });

  it("reads from part way along a query", () => {
    assertArrayEquals(chunks("beijing", 3, "jīng"), [7, 4]);
  });

  it("reports each position once, however many ways it is reached", () => {
    // `b` is both the initial of 北 and the whole of what is left to read.
    assertArrayLength(readQueryChunks("b", 0, one("běi")), 1);
  });
});
