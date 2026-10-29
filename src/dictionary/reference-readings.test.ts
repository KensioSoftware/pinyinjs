import { fileURLToPath } from "node:url";

import {
  assertArrayEquals,
  assertArrayIncludes,
  assertArrayIncludesAll,
  assertIdentical,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { convert } from "../decode/convert.js";
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
    assertArrayEquals(readingsOf("乐"), ["lè", "yuè", "lào"]);
    assertArrayEquals(readingsOf("澄"), ["chéng", "dèng", "dēng"]);
    assertArrayEquals(readingsOf("亢"), ["kàng", "háng"]);
    assertArrayEquals(readingsOf("癞"), ["lài", "là"]);
    assertArrayEquals(readingsOf("掹"), ["meng", "měng"]);
    assertArrayEquals(readingsOf("䏚"), ["chǎo", "miǎo"]);
    assertArrayEquals(readingsOf("玟"), ["wén", "mín"]);
    assertArrayEquals(readingsOf("貉"), ["hé", "háo", "mò"]);
    assertArrayEquals(readingsOf("媆"), ["ruǎn", "nèn"]);
    assertArrayEquals(readingsOf("伮"), ["nǔ", "nú"]);
    assertArrayEquals(readingsOf("箄"), ["bǐ", "bēi", "pái"]);
    assertArrayEquals(readingsOf("蒡"), ["bàng", "páng"]);
    assertArrayEquals(readingsOf("㾦"), ["pèi", "pēi"]);
    assertArrayEquals(readingsOf("𫔇"), ["bī", "pī"]);
    assertArrayEquals(readingsOf("芘"), ["bǐ", "pí"]);
    assertArrayEquals(readingsOf("呇"), ["mèn", "qǐ"]);
    assertArrayEquals(readingsOf("跂"), ["qí", "qì", "qǐ"]);
    assertArrayEquals(readingsOf("愒"), ["kài", "hè", "qì"]);
  });

  it("keeps a common character's everyday reading in words and sentences", () => {
    // Given common characters with a rare or regional reading added
    // When text using them in their everyday senses is converted
    // Then each still reads as it did, in a word and standing alone
    assertIdentical(
      convert(dictionary, "我很快乐。音乐会很好听。他姓乐。"),
      "Wǒ hěn kuàilè. Yīnyuèhuì hěn hǎotīng. Tā xìng lè.",
    );
    assertIdentical(
      convert(dictionary, "湖水很澄清。把水澄一澄。"),
      "Hú shuǐ hěn chéngqīng. Bǎ shuǐ chéng yì chéng.",
    );
    assertIdentical(
      convert(dictionary, "他的声音高亢激昂。亢姓的人不多。"),
      "Tā de shēngyīn gāokàng jī'áng. Kàng xìng de rén bù duō.",
    );
    assertIdentical(
      convert(dictionary, "这只癞蛤蟆很大。他头上长了癞。"),
      "Zhè zhī làiháma hěn dà. Tā tóushàng zhǎngle lài.",
    );
    assertIdentical(
      convert(dictionary, "一丘之貉。貉子的皮很暖。金玟来了。"),
      "Yìqiūzhīhé. Háozi de pí hěn nuǎn. Jīn wén láile.",
    );
    assertIdentical(
      convert(dictionary, "牛蒡很好吃。他扑过来了。"),
      "Niúbàng hěn hǎochī. Tā pū guòlái le.",
    );
  });

  it("gives the 繁體 form the reading its 简体 form gets", () => {
    // Given a 繁體 character with a Unihan entry of its own
    // When its readings are listed
    // Then it has the reading its 简体 form was given
    assertArrayIncludes(readingsOf("崗"), "gàng");
    assertArrayIncludes(readingsOf("酇"), "cuán");
    assertArrayIncludes(readingsOf("鱯"), "huò");
    assertArrayIncludes(readingsOf("癩"), "là");
    assertArrayIncludes(readingsOf("樂"), "lào");
  });

  it("reads a character no source reads at all", () => {
    // Given characters missing from every source
    // When their readings are listed
    // Then the reference reading is their only one
    assertArrayEquals(readingsOf("𡷫"), ["chéng"]);
    assertArrayEquals(readingsOf("𭥙"), ["gǎng"]);
    assertArrayEquals(readingsOf("𫵼"), ["gēng"]);
    assertArrayEquals(readingsOf("𣪘"), ["guǐ"]);
    assertArrayEquals(readingsOf("𥉳"), ["liū"]);
    assertArrayEquals(readingsOf("𡏋"), ["pǔ"]);
  });

  it("lists every reading a character has, where it has several", () => {
    // Given place-name readings of 嵅 and the plain-vowel spellings of 欸
    // When their readings are listed
    // Then each one is there
    assertArrayIncludesAll(readingsOf("嵅"), ["dǎn", "dǎng"]);
    assertArrayIncludesAll(readingsOf("欸"), ["ē", "é", "ě", "è"]);
    assertArrayEquals(readingsOf("𫪘"), ["ōu", "óu", "ǒu", "òu"]);
  });

  it("leaves out a rare reading that would unsettle a common character", () => {
    // Given 不, 泽, 姆, 能 and 扑, each with a reading few words use
    // When their readings are listed
    // Then each keeps its one reading, so it stays certain standing alone
    assertArrayEquals(readingsOf("不"), ["bù"]);
    assertArrayEquals(readingsOf("泽"), ["zé"]);
    assertArrayEquals(readingsOf("姆"), ["mǔ"]);
    assertArrayEquals(readingsOf("能"), ["néng"]);
    assertArrayEquals(readingsOf("扑"), ["pū"]);
  });

  it("reads 能 as néng in every tier", async () => {
    // Given 能, whose old reading nài is left out
    // When text using it in words and standing alone is converted on each tier
    // Then néng is its only reading and every 能 reads néng
    const expected = {
      core: "Wǒ néng qù. Néng bù néng? Tā hěn néng gàn. Néng.",
      standard: "Wǒ néng qù. Néng bùnéng? Tā hěn nénggàn. Néng.",
      full: "Wǒ néng qù. Néng bùnéng? Tā hěn nénggàn. Néng.",
    } as const;
    const tiers = await Promise.all(
      Object.entries(expected).map(async ([tier, reading]) => ({
        dictionary: await loadDictionary(
          fileSource(dataDirectory),
          tier as keyof typeof expected,
        ),
        reading,
      })),
    );
    for (const { dictionary: tierDictionary, reading } of tiers) {
      assertArrayEquals(
        tierDictionary
          .readingsOf("能")
          .map((syllables) =>
            syllables.map((syllable) => writeSyllable(syllable)),
          ),
        [["néng"]],
      );
      assertIdentical(
        convert(tierDictionary, "我能去。能不能？他很能干。能。"),
        reading,
      );
    }
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
