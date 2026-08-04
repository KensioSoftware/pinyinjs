import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertOneOf,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { SYLLABARY } from "#test/fixtures/syllabary.js";

import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import { readSyllable } from "../syllable/syllable.js";
import { writeBopomofo } from "./bopomofo.js";
import { writeIpaSymbols } from "./ipa.js";
import { writeWadeGilesSpelling } from "./wade-giles.js";
import { writeYaleSpelling } from "./yale.js";

/**
 * A cell with the source's own uncertainty mark taken off.
 *
 * 哦 o is the one row the source flags in the columns used here — its Yale is
 * written `o?` and its IPA `ɔ?`, under a note reading "To verify: all". The `?`
 * is stripped rather than the row being skipped, because what is uncertain is
 * the source's confidence rather than the value: both cells say what every
 * other row's do, and dropping the row would quietly shrink the check.
 */
function unsure(cell: string): string {
  return cell.replace(/\?$/u, "");
}

/**
 * Every claim these tables make, against a syllabary that is not ours.
 *
 * No source in this package's data pipeline carries any of these systems, so
 * without an outside table the correspondence would rest on nothing but the
 * author's confidence while typing it. `test/fixtures/syllabary.ts` records
 * where the table came from.
 *
 * It is scored in the writing direction only: reading is an index built out of
 * the writing, so a wrong entry here would show up as both a wrong spelling and
 * a wrong reading, and the round trip in each system's own test file is what
 * covers the other side.
 */
describe("the tables against an independent syllabary", () => {
  it("covers the whole of it", () => {
    assertArrayLength(SYLLABARY, 417);
  });

  it("writes every row's bopomofo exactly", () => {
    for (const row of SYLLABARY) {
      const syllable = readSyllable(row.pinyin);
      assertNonNullable(syllable, row.pinyin);
      assertIdentical(writeBopomofo(syllable), row.bopomofo, row.pinyin);
    }
  });

  it("writes every row as one of its Wade-Giles forms", () => {
    for (const row of SYLLABARY) {
      const syllable = readSyllable(row.pinyin);
      assertNonNullable(syllable, row.pinyin);
      // The source writes the aspiration mark as a turned comma and several
      // rows carry two accepted forms, so what is asserted is membership of
      // the set rather than one string.
      const forms = row.wadeGiles.map((form) =>
        form.replaceAll("ʻ", () => "'"),
      );
      assertOneOf(writeWadeGilesSpelling(syllable), forms, row.pinyin);
    }
  });

  it("writes every row's Yale exactly", () => {
    for (const row of SYLLABARY) {
      const syllable = readSyllable(row.pinyin);
      assertNonNullable(syllable, row.pinyin);
      assertIdentical(
        writeYaleSpelling(syllable),
        unsure(row.yale),
        row.pinyin,
      );
    }
  });

  it("transcribes every row's IPA exactly", () => {
    for (const row of SYLLABARY) {
      const syllable = readSyllable(row.pinyin);
      assertNonNullable(syllable, row.pinyin);
      assertIdentical(writeIpaSymbols(syllable), unsure(row.ipa), row.pinyin);
    }
  });

  it("differs from the inventory on exactly the syllables it should", () => {
    // Neither list is a subset of the other, and both differences are
    // marginal. The 12 the table leaves out are the interjections and the
    // syllabic nasals this package took from Unihan and CC-CEDICT; the 5 it
    // adds are dialectal or reconstructed, and are written correctly here even
    // so, since the rules are general.
    const table = new Set(SYLLABARY.map((row) => row.pinyin));
    assertArrayEquals(
      [...DICTIONARY_SYLLABLES].filter((pinyin) => !table.has(pinyin)),
      [
        "biang",
        "dia",
        "hm",
        "hng",
        "m",
        "n",
        "ng",
        "yo",
        "bong",
        "cei",
        "din",
        "rua",
      ],
    );
    assertArrayEquals(
      [...table].filter((pinyin) => !DICTIONARY_SYLLABLES.has(pinyin)),
      ["diang", "lüan", "lün", "nia", "shong"],
    );
  });
});
