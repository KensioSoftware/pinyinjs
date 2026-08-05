import {
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  WIKTIONARY_WORDS,
  type WiktionaryRow,
} from "#test/fixtures/wiktionary.js";

import { readWord } from "../syllable/split.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { writeBopomofo } from "./bopomofo.js";
import { writeGwoyeuWord } from "./gwoyeu.js";
import { writeWadeGiles } from "./wade-giles.js";
import { writeYale } from "./yale.js";

/**
 * The syllables of a row, as the source's pinyin gives them.
 *
 * Three things happen here and all three are the source's convention rather
 * than this package's. A syllable with no tone mark is neutral, since the
 * source marks every other tone. The apostrophe of 西安 `Xī'ān` is a syllable
 * boundary, so it splits rather than being read. And where the row carries the
 * unreduced form, each neutral syllable takes its tone from the syllable
 * standing in the same place there.
 */
function syllablesOf(row: WiktionaryRow): readonly Syllable[] {
  const read = (text: string): readonly Syllable[] =>
    text
      .toLowerCase()
      .split(/['’]/u)
      .flatMap((part) => {
        const split = readWord(part);
        assertNonNullable(split, `${row.hanzi} ${text}`);
        return split;
      });

  const full = row.full === undefined ? [] : read(row.full);
  return read(row.pinyin).map((syllable, at) => {
    const originalTone = full[at]?.tone;
    return syllable.tone === undefined
      ? {
          ...syllable,
          tone: NEUTRAL_TONE,
          ...(originalTone !== undefined && { originalTone }),
        }
      : syllable;
  });
}

/**
 * How this package writes a row, one system at a time.
 *
 * Joined per syllable rather than with each system's own word writer, because
 * what is being checked is the syllables and the source's join is its own
 * choice: it hyphenates Yale where this package writes it solid, both of which
 * are attested. Gwoyeu Romatzyh is the exception and goes through its word
 * writer, since the source writes it solid too.
 */
function written(row: WiktionaryRow): Record<string, string> {
  const syllables = syllablesOf(row);
  return {
    zhuyin: syllables.map((one) => writeBopomofo(one)).join(" "),
    wadeGiles: syllables.map((one) => writeWadeGiles(one)).join("-"),
    yale: syllables.map((one) => writeYale(one)).join("-"),
    gwoyeu: writeGwoyeuWord(syllables),
  };
}

/**
 * A source cell, normalised to what this package would write.
 *
 * The aspiration mark is a turned comma there and an ASCII apostrophe here, and
 * proper nouns are capitalised there and left to the caller here. Neither is a
 * disagreement about the transcription.
 */
function normalise(cell: string): string {
  return cell
    .normalize("NFC")
    .replaceAll("ʻ", () => "'")
    .replaceAll("ʼ", () => "'")
    .toLowerCase();
}

/**
 * What this package writes, normalised the same way.
 */
function ours(cell: string): string {
  return cell.normalize("NFC").toLowerCase();
}

const SYSTEMS = ["zhuyin", "wadeGiles", "yale", "gwoyeu"] as const;

/**
 * Whole words against a source that is not the syllabary.
 *
 * `test/fixtures/syllabary.ts` scores the tables and can score nothing else,
 * being toneless: this scores the tone marks, the neutral tone, 儿化 and the
 * join, over 148 words of running vocabulary. See the fixture for where it
 * came from.
 */
describe("whole words against Wiktionary", () => {
  it("covers 148 words in four systems", () => {
    assertArrayLength(WIKTIONARY_WORDS, 148);
    const cells = WIKTIONARY_WORDS.flatMap((row) =>
      SYSTEMS.map((system) => row[system]),
    );
    assertArrayLength(cells, 592);
  });

  for (const system of SYSTEMS) {
    it(`writes every row's ${system}`, () => {
      for (const row of WIKTIONARY_WORDS) {
        if (row.except?.includes(system) === true) {
          continue;
        }
        assertIdentical(
          ours(written(row)[system] ?? ""),
          normalise(row[system]),
          `${row.hanzi} ${row.pinyin}`,
        );
      }
    });
  }

  it("still disagrees with the three cells the source has wrong", () => {
    const excepted = WIKTIONARY_WORDS.flatMap((row) =>
      (row.except ?? []).map((system) => [row, system] as const),
    );
    assertArrayLength(excepted, 3);
    for (const [row, system] of excepted) {
      assertFalse(
        ours(written(row)[system] ?? "") === normalise(row[system]),
        `${row.hanzi} ${system}`,
      );
    }
  });

  it("covers the tones, the neutral tone and 儿化", () => {
    // What the fixture is for, asserted so that a regenerated one that lost
    // its awkward rows fails rather than passing quietly.
    const syllables = WIKTIONARY_WORDS.flatMap((row) => syllablesOf(row));
    const withTone = (tone: number): number =>
      syllables.filter((one) => one.tone === tone).length;
    assertArrayLength(syllables, 278);
    assertIdentical(withTone(1), 63);
    assertIdentical(withTone(2), 60);
    assertIdentical(withTone(3), 46);
    assertIdentical(withTone(4), 70);
    assertIdentical(withTone(NEUTRAL_TONE), 39);
    // Of the 39 neutral syllables, 23 are a reduction of a syllable the source
    // also writes unreduced, which is where GR's dotted spelling comes from.
    assertArrayLength(
      syllables.filter((one) => one.originalTone !== undefined),
      23,
    );
    assertArrayLength(
      syllables.filter((one) => one.erhua === true),
      16,
    );
  });
});
