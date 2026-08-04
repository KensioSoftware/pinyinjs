import {
  assertArrayLength,
  assertIdentical,
  assertObjectMatches,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { toCharacters } from "../script/characters.js";
import type { UnihanReadings, UnihanVariants } from "../sources/unihan.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import type { ReadCharacters } from "./reading.js";
import { readAlignedReading } from "./reading.js";
import {
  pairScripts,
  type ScriptPairing,
  TraditionalTable,
} from "./traditional.js";

/**
 * Unihan's reading lists for the characters these tests use.
 *
 * Real values: 髮 reads only `fà`, whereas 發 reads `fā` first and `fà` only as
 * a rarer variant, which is what lets the reading separate them.
 */
/**
 * A Unihan entry with the per-field detail the merge reads.
 */
function unihan(
  readings: readonly string[],
  extra: Partial<UnihanReadings> = {},
): UnihanReadings {
  return {
    readings,
    fields: new Map([["kTGHZ2013", readings]]),
    ...extra,
  };
}

const UNIHAN_READINGS: ReadonlyMap<string, UnihanReadings> = new Map([
  ["发", unihan(["fā", "fa", "fà"])],
  ["發", unihan(["fā", "fa", "fà"])],
  ["髮", unihan(["fà"], { taiwanReading: "fǎ" })],
  ["头", unihan(["tóu", "tou"])],
  ["頭", unihan(["tóu", "tou"])],
  ["万", unihan(["wàn", "mò"])],
  ["萬", unihan(["wàn"])],
]);

const UNIHAN_VARIANTS: UnihanVariants = {
  simplified: new Map(),
  traditional: new Map([
    ["发", ["發", "髮"]],
    ["头", ["头", "頭"]],
    ["万", ["万", "萬"]],
  ]),
};

/**
 * A syllable, for readable expectations.
 */
function syllable(text: string): Syllable {
  const parsed = readSyllable(text);
  if (parsed === undefined) {
    throw new Error(`not a syllable: ${text}`);
  }
  return parsed;
}

/**
 * An alignment of one character per syllable.
 */
function aligned(word: string, readings: readonly string[]): ReadCharacters[] {
  return toCharacters(word).map((character, at) => ({
    characters: character,
    syllable: syllable(readings[at] ?? ""),
  }));
}

/**
 * A table built from Unihan alone, with no observed pairings.
 */
function unihanOnly(): TraditionalTable {
  return TraditionalTable.build([], UNIHAN_VARIANTS, UNIHAN_READINGS);
}

describe("deriving 繁體 forms", () => {
  describe("from Unihan variants, ranked by reading", () => {
    it("picks 髮 for 发 read fà, not 發", () => {
      // The whole point: 髮 reads only fà, so fà ranks first there and third in
      // 發's list.
      assertIdentical(
        unihanOnly().convertCharacter("发", syllable("fà")),
        "髮",
      );
    });

    it("picks 發 for 发 read fā", () => {
      assertIdentical(
        unihanOnly().convertCharacter("发", syllable("fā")),
        "發",
      );
    });

    it("prefers the 繁體 form when the readings cannot separate them", () => {
      // 头 and 頭 both read tóu, so nothing distinguishes them but the fact
      // that we are building a table of traditional forms.
      assertIdentical(
        unihanOnly().convertCharacter("头", syllable("tóu")),
        "頭",
      );
    });

    it("keeps the character itself when the reading picks it", () => {
      // 万 read mò is 万; only 万 read wàn is 萬.
      assertIdentical(
        unihanOnly().convertCharacter("万", syllable("mò")),
        "万",
      );
      assertIdentical(
        unihanOnly().convertCharacter("万", syllable("wàn")),
        "萬",
      );
    });

    it("leaves a character with no known variant alone", () => {
      assertIdentical(
        unihanOnly().convertCharacter("山", syllable("shān")),
        "山",
      );
    });

    it("falls back to the 繁體 form when no reading is given", () => {
      assertIdentical(unihanOnly().convertCharacter("头", undefined), "頭");
    });

    it("prefers a candidate Unihan knows readings for when none is given", () => {
      const table = TraditionalTable.build(
        [],
        { simplified: new Map(), traditional: new Map([["发", ["發", "髮"]]]) },
        new Map([["髮", unihan(["fà"])]]),
      );
      // 發 has no reading list at all here, so 髮 is the only candidate that
      // Unihan can say anything about.
      assertIdentical(table.convertCharacter("发", undefined), "髮");
    });

    it("ignores a candidate reading that is not a syllable", () => {
      const table = TraditionalTable.build(
        [],
        { simplified: new Map(), traditional: new Map([["发", ["發", "髮"]]]) },
        new Map([
          ["發", unihan(["not-a-syllable", "fā"])],
          ["髮", unihan(["fà"])],
        ]),
      );
      assertIdentical(table.convertCharacter("发", syllable("fā")), "發");
    });

    it("matches on the syllable when no candidate matches the tone", () => {
      // fǎ is nobody's listed reading here, but 髮 at least reads that
      // syllable, which beats 發 not matching at all.
      const readings = new Map([
        ["發", unihan(["bō"])],
        ["髮", unihan(["fà"])],
      ]);
      const table = TraditionalTable.build(
        [],
        { simplified: new Map(), traditional: new Map([["发", ["發", "髮"]]]) },
        readings,
      );
      assertIdentical(table.convertCharacter("发", syllable("fǎ")), "髮");
    });
  });

  describe("from observed pairings, which outrank inference", () => {
    /**
     * 干 is the case the reading cannot settle: 干扰 and 干燥 are both `gān`,
     * and they take different traditional forms.
     */
    const observed: readonly ScriptPairing[] = [
      { hans: "干", hant: "干", syllable: syllable("gān") },
      { hans: "干", hant: "干", syllable: syllable("gān") },
      { hans: "干", hant: "幹", syllable: syllable("gàn") },
    ];

    it("takes the variant most often observed at that reading", () => {
      const table = TraditionalTable.build(
        observed,
        UNIHAN_VARIANTS,
        UNIHAN_READINGS,
      );
      const neutralGan = table.convertCharacter("干", syllable("gān"));
      const fallingGan = table.convertCharacter("干", syllable("gàn"));
      assertIdentical(neutralGan, "干");
      assertIdentical(fallingGan, "幹");
    });

    it("falls back to the commonest variant at any reading", () => {
      const table = TraditionalTable.build(
        observed,
        UNIHAN_VARIANTS,
        UNIHAN_READINGS,
      );
      // qián is a reading nothing was observed at.
      assertIdentical(table.convertCharacter("干", syllable("qián")), "干");
    });

    it("prefers the 繁體 form when two variants are equally attested", () => {
      // Observed evidence can tie too, and the same reasoning applies as in
      // the Unihan fallback: this is a table of traditional forms.
      const table = TraditionalTable.build(
        [
          { hans: "头", hant: "头", syllable: syllable("tóu") },
          { hans: "头", hant: "頭", syllable: syllable("tóu") },
        ],
        UNIHAN_VARIANTS,
        UNIHAN_READINGS,
      );
      assertIdentical(table.convertCharacter("头", syllable("tóu")), "頭");
    });

    it("beats the Unihan fallback, which would have said 萬", () => {
      const table = TraditionalTable.build(
        [{ hans: "万", hant: "万", syllable: syllable("wàn") }],
        UNIHAN_VARIANTS,
        UNIHAN_READINGS,
      );
      assertIdentical(table.convertCharacter("万", syllable("wàn")), "万");
    });
  });

  describe("converting a whole word", () => {
    it("derives 頭髮 from 头发 read tóu fà", () => {
      assertIdentical(
        unihanOnly().convert(aligned("头发", ["tóu", "fà"])),
        "頭髮",
      );
    });

    it("derives 頭發 from 头发 read tóu fā, following the reading", () => {
      assertIdentical(
        unihanOnly().convert(aligned("头发", ["tóu", "fā"])),
        "頭發",
      );
    });

    it("converts both characters of a 儿化 pair", () => {
      const table = TraditionalTable.build(
        [],
        {
          simplified: new Map(),
          traditional: new Map([
            ["儿", ["兒"]],
            ["玩", ["玩"]],
          ]),
        },
        new Map([["兒", unihan(["ér"])]]),
      );
      // 玩儿 is one syllable over two characters; the syllable describes the
      // first of them only.
      assertIdentical(
        table.convert([{ characters: "玩儿", syllable: syllable("wánr") }]),
        "玩兒",
      );
    });

    it("keeps punctuation, which has no syllable", () => {
      assertIdentical(
        unihanOnly().convert([
          { characters: "头", syllable: syllable("tóu") },
          { characters: "，", syllable: undefined },
        ]),
        "頭，",
      );
    });
  });

  describe("pairScripts", () => {
    it("pairs the two scripts character by character", () => {
      const pairs = pairScripts(
        "头发",
        "頭髮",
        readAlignedReading("头发", ["tou2", "fa4"]),
      );
      assertArrayLength(pairs, 2);
      assertObjectMatches(pairs[0], { hans: "头", hant: "頭" });
      assertObjectMatches(pairs[1], { hans: "发", hant: "髮" });
    });

    it("records the reading against each character", () => {
      const pairs = pairScripts(
        "头发",
        "頭髮",
        readAlignedReading("头发", ["tou2", "fa4"]),
      );
      assertIdentical(pairs[1]?.syllable?.final, "a");
    });

    it("gives no reading for a character sharing a syllable with another", () => {
      const pairs = pairScripts(
        "玩儿",
        "玩兒",
        readAlignedReading("玩儿", ["wan2", "r5"]),
      );
      assertArrayLength(pairs, 2);
      assertUndefined(pairs[0].syllable);
    });

    it("yields nothing when the scripts differ in length", () => {
      // Guessing an alignment here would poison the table with pairings that
      // were never observed.
      assertArrayLength(pairScripts("一个", "一個個", undefined), 0);
    });

    it("yields nothing for an empty word", () => {
      assertArrayLength(pairScripts("", "", undefined), 0);
    });

    it("yields nothing when the alignment runs past the word", () => {
      // An alignment belonging to a longer word would otherwise pair
      // characters that were never opposite each other.
      assertArrayLength(
        pairScripts(
          "头发",
          "頭髮",
          readAlignedReading("头发丝", ["tou2", "fa4", "si1"]),
        ),
        0,
      );
    });

    it("still pairs when the reading could not be read", () => {
      const pairs = pairScripts("头发", "頭髮", undefined);
      assertArrayLength(pairs, 2);
      assertObjectMatches(pairs[0], { hans: "头", hant: "頭" });
      assertUndefined(pairs[0].syllable);
    });
  });
});
