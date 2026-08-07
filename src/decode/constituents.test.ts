import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import { assertArrayEquals, assertUndefined } from "@kensio/smartass";
import { describe, it } from "vitest";

import { divisionOf } from "./constituents.js";

/**
 * The words a division can be built out of, and the ones being divided.
 *
 * 展覽館 and 紙老虎 are the pair the whole thing exists for: the first divides
 * left and the second right, and nothing but the dictionary says which. The
 * rest set up the choices the tie-breaks have to make — 莫名其 is not a word
 * anyone would list, and is here so that 莫名其妙 has an uneven division to
 * reject.
 */
const dictionary = dictionaryOf([
  entry("展览", "zhǎn lǎn"),
  entry("展览馆", "zhǎn lǎn guǎn"),
  entry("馆", "guǎn"),
  entry("纸", "zhǐ"),
  entry("老虎", "lǎo hǔ"),
  entry("纸老虎", "zhǐ lǎo hǔ"),
  entry("水", "shuǐ", { frequency: 90_000 }),
  entry("水彩", "shuǐ cǎi", { frequency: 300 }),
  entry("彩笔", "cǎi bǐ", { frequency: 20 }),
  entry("笔", "bǐ", { frequency: 8000 }),
  entry("水彩笔", "shuǐ cǎi bǐ"),
  entry("莫名", "mò míng"),
  entry("莫名其", "mò míng qí"),
  entry("其妙", "qí miào"),
  entry("妙", "miào"),
  entry("莫名其妙", "mò míng qí miào"),
  entry("玩儿", "wánr"),
  entry("好玩儿", "hǎo wánr"),
  entry("好", "hǎo"),
  entry("银行", "yín háng"),
]);

/**
 * Where a word divides, given the reading its own entry carries.
 */
function division(word: string): readonly number[] | undefined {
  return divisionOf(dictionary, word, dictionary.lookup(word)?.reading ?? []);
}

describe("dividing a word into constituents", () => {
  it("divides where both halves are words", () => {
    assertArrayEquals(division("展览馆") ?? [], [2, 1]);
    assertArrayEquals(division("纸老虎") ?? [], [1, 2]);
  });

  it("leaves a word with no room to divide alone", () => {
    assertUndefined(division("银行"));
    assertUndefined(division("好"));
  });

  it("takes the most even division", () => {
    // Two feet of two, not three and one, even though 莫名其 is a key here.
    assertArrayEquals(division("莫名其妙") ?? [], [2, 2]);
  });

  it("breaks a tie on the half that is rarer", () => {
    // Both divisions of a three-syllable word are equally even, so the question
    // is which two-syllable half is really a word in it. 水彩 is the commoner
    // word, though 水 is far commoner than either.
    assertArrayEquals(division("水彩笔") ?? [], [2, 1]);
  });

  it("leaves a word alone where the reading is shorter than the word", () => {
    // 好 and 玩儿 are both entries, but 儿化 folds two characters into one
    // syllable, so no character boundary here is a syllable boundary.
    assertUndefined(division("好玩儿"));
  });

  it("leaves a word alone where neither half is a word", () => {
    assertUndefined(divisionOf(dictionary, "银行家", reading("yín háng jiā")));
  });
});
