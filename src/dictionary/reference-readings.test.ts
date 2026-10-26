import { fileURLToPath } from "node:url";

import {
  assertArrayEquals,
  assertArrayIncludes,
  assertArrayIncludesAll,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import {
  characterSyllable,
  withReferenceReadings,
} from "./character-defaults.js";
import { fileSource } from "./node-source.js";
import { loadDictionary } from "./source.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** Every reading the dictionary gives a character, most likely first. */
function readingsOf(character: string): readonly string[] {
  return dictionary
    .readingsOf(character)
    .map((reading) =>
      reading.map((syllable) => writeSyllable(syllable)).join(" "),
    );
}

/** The reading the dictionary stores for a word. */
function readingOf(word: string): readonly string[] {
  return (dictionary.lookup(word)?.reading ?? []).map((syllable) =>
    writeSyllable(syllable),
  );
}

/** A character's readings, written out, after the reference ones are added. */
function extended(
  defaults: ReadonlyMap<string, readonly string[]>,
  references: ReadonlyMap<string, readonly string[]>,
  character: string,
): readonly string[] {
  const parsed = new Map(
    [...defaults].map(([key, readings]) => [
      key,
      readings
        .map((reading) => characterSyllable(key, reading))
        .filter((syllable) => syllable !== undefined),
    ]),
  );
  return (withReferenceReadings(parsed, references).get(character) ?? []).map(
    (syllable) => writeSyllable(syllable),
  );
}

describe("readings a reference dictionary gives", () => {
  it("adds a character's rare reading after the ones the sources give", () => {
    // Given characters whose reading in one word no source carries
    // When their readings are listed
    // Then the sources' default still leads and the rare reading follows
    assertArrayEquals(readingsOf("倡"), ["chàng", "chāng"]);
    assertArrayEquals(readingsOf("岗"), ["gǎng", "gāng", "gàng"]);
    assertArrayEquals(readingsOf("碌"), ["lù", "liù", "lū"]);
  });

  it("gives the 繁體 form the reading its 简体 form gets", () => {
    // Given a 繁體 character with a Unihan entry of its own
    // When its readings are listed
    // Then it has the reading its 简体 form was given
    assertArrayIncludes(readingsOf("崗"), "gàng");
    assertArrayIncludes(readingsOf("酇"), "cuán");
  });

  it("reads a character no source reads at all", () => {
    // Given characters missing from every source
    // When their readings are listed
    // Then the reference reading is their only one
    assertArrayEquals(readingsOf("𡷫"), ["chéng"]);
    assertArrayEquals(readingsOf("𭥙"), ["gǎng"]);
    assertArrayEquals(readingsOf("𫵼"), ["gēng"]);
  });

  it("lists every reading a character has, where it has several", () => {
    // Given place-name readings of 嵅 and the plain-vowel spellings of 欸
    // When their readings are listed
    // Then each one is there
    assertArrayIncludesAll(readingsOf("嵅"), ["dǎn", "dǎng"]);
    assertArrayIncludesAll(readingsOf("欸"), ["ē", "é", "ě", "è"]);
  });

  it("leaves out a dialect reading that would unsettle a common character", () => {
    // Given 不 and 泽, whose dialect readings only 不子 and 凌泽 use
    // When their readings are listed
    // Then each keeps its one reading, so it stays certain standing alone
    assertArrayEquals(readingsOf("不"), ["bù"]);
    assertArrayEquals(readingsOf("泽"), ["zé"]);
  });

  it("reads a word the corpus read from everyday readings as print does", () => {
    // Given words the phrase corpus reads from each character's default
    // When they are looked up
    // Then each reads as a reference dictionary prints it
    assertArrayEquals(readingOf("骨碌碌"), ["gū", "lū", "lū"]);
    assertArrayEquals(readingOf("疙疙瘩瘩"), ["gē", "ge", "dā", "dā"]);
    assertArrayEquals(readingOf("道碴"), ["dào", "zhǎ"]);
    assertArrayEquals(readingOf("不子"), ["dǔn", "zi"]);
    assertArrayEquals(readingOf("岗口儿甜"), ["gàng", "kǒur", "tián"]);
  });

  it("adds a word no source has", () => {
    // Given words missing from every source
    // When they are looked up
    // Then each has the printed reading
    assertArrayEquals(readingOf("粢饭"), ["cī", "fàn"]);
    assertArrayEquals(readingOf("螲𬠅"), ["dié", "dāng"]);
  });
});

describe("adding reference readings to the character defaults", () => {
  it("puts a reference reading after the sources' and skips a known one", () => {
    // Given a character the sources read two ways
    // When the reference gives one of those and one more
    // Then only the new reading is added, and it comes last
    assertArrayEquals(
      extended(
        new Map([["岗", ["gǎng", "gāng"]]]),
        new Map([["岗", ["gāng", "gàng"]]]),
        "岗",
      ),
      ["gǎng", "gāng", "gàng"],
    );
  });

  it("reads a character the sources do not have", () => {
    // Given a character absent from the defaults
    // When the reference reads it
    // Then the reference reading is its only one
    assertArrayEquals(extended(new Map(), new Map([["𫵼", ["gēng"]]]), "𫵼"), [
      "gēng",
    ]);
  });
});
