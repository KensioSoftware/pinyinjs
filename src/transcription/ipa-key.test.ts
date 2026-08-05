import {
  assertArrayEquals,
  assertArrayLength,
  assertNonNullable,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { IPA_KEY, type IpaKeyRow } from "#test/fixtures/ipa-mandarin.js";

import { readSyllable } from "../syllable/syllable.js";
import { writeIpa } from "./ipa.js";

/**
 * Whether this package's transcription of every one of a row's examples
 * carries the symbol the key says it does.
 */
function hasSymbol(row: IpaKeyRow): boolean {
  return row.examples.every((pinyin) => {
    const syllable = readSyllable(pinyin);
    assertNonNullable(syllable, pinyin);
    return writeIpa(syllable)
      .normalize("NFC")
      .includes(row.ipa.normalize("NFC"));
  });
}

/**
 * The IPA table against the key, rather than against the syllabary again.
 *
 * The syllabary's IPA column and this key are two Wikipedia pages written for
 * two different purposes, and scoring against both is the only way to see where
 * they differ — which they do at twelve rows, ten of them this package
 * following the broader of the two transcriptions and two of them a tone it
 * does not write as a pitch. Each is named in the fixture.
 *
 * Checked by symbol rather than by whole transcription, since the key is a
 * table of symbols and their example words and says nothing about how a
 * syllable is assembled: the claim it makes about 江 jiāng is that there is a
 * [ŋ] in it.
 */
describe("the IPA table against Help:IPA/Mandarin", () => {
  it("covers all 50 rows of the key", () => {
    assertArrayLength(IPA_KEY, 50);
    assertArrayEquals(
      ["consonant", "vowel", "diphthong", "tone"].map(
        (table) => IPA_KEY.filter((row) => row.table === table).length,
      ),
      [25, 16, 4, 5],
    );
  });

  it("writes every symbol the key gives, in every word it gives it for", () => {
    for (const row of IPA_KEY) {
      if (row.differs !== undefined) {
        continue;
      }
      assertTrue(hasSymbol(row), `${row.ipa} ${row.examples.join(" ")}`);
    }
  });

  it("still differs from the key at exactly the twelve rows recorded", () => {
    const differing = IPA_KEY.filter((row) => row.differs !== undefined);
    assertArrayEquals(
      differing.map((row) => row.ipa),
      ["j", "w", "ɥ", "ɑ", "ɻ̩", "ɹ̩", "aɪ", "aʊ", "eɪ", "oʊ", "˧˩˧", "˧"],
    );
    for (const row of differing) {
      assertTrue(!hasSymbol(row), `${row.ipa} ${row.examples.join(" ")}`);
    }
  });
});
