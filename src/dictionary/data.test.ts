import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assertArrayIncludes,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertNumberBetween,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { decodeReading } from "./artifact.js";
import { toCharacters } from "../script/characters.js";
import { KeyIndex } from "./key-index.js";
import { TIERS } from "./tiers.js";

/**
 * A tier as it is committed to `data/`.
 *
 * Read straight off disk rather than rebuilt, because the point of committing
 * artifacts at all is that CI tests the file that will be published. Building
 * them in CI instead would test one artifact while `npm publish` shipped
 * another, since CC-CEDICT is a rolling file with no version — see
 * DATA-PIPELINE.md.
 */
class Tier {
  readonly #lines: readonly string[];

  readonly index: KeyIndex;

  /**
   * Read one tier's artifact files.
   */
  constructor(tier: string) {
    const read = (suffix: string): string =>
      readFileSync(
        fileURLToPath(new URL(`../../data/${tier}.${suffix}`, import.meta.url)),
        "utf8",
      );
    this.index = KeyIndex.from(read("keys"));
    this.#lines = read("entries").split("\n");
  }

  /**
   * The columns recorded for a key, or undefined when it is not a key.
   */
  columns(word: string): readonly string[] | undefined {
    const found = this.index.lookup(word);
    if (!found.isKey) {
      return undefined;
    }
    return (this.#lines[found.index] ?? "").split("\t");
  }

  /**
   * A word's reading, in tone-marked notation.
   *
   * Rebuilds a derivable reading from its characters' defaults, which is how
   * 87.8% of multi-character entries are stored: as nothing at all.
   */
  reading(word: string): string | undefined {
    const columns = this.columns(word);
    if (columns === undefined) {
      return undefined;
    }
    const stored = columns[0] ?? "";
    const encoded =
      stored === ""
        ? toCharacters(word)
            .map((character) => this.columns(character)?.[0] ?? "")
            .join(" ")
        : stored;
    return decodeReading(encoded)
      ?.map((syllable) => writeSyllable(syllable))
      .join(" ");
  }
}

const full = new Tier("full");
const core = new Tier("core");
const standard = new Tier("standard");

describe("the committed dictionary", () => {
  describe("the golden cases, read back off disk", () => {
    it("repairs 儿化 from CC-CEDICT's r5", () => {
      assertIdentical(full.reading("玩儿"), "wánr");
      assertIdentical(full.reading("这儿"), "zhèr");
    });

    it("leaves 儿 its own syllable where it is the word", () => {
      assertIdentical(full.reading("女儿"), "nǚ ér");
      assertIdentical(full.reading("儿子"), "ér zi");
    });

    it("stores underlying tones, with 一 and 不 sandhi normalised out", () => {
      // The runtime sandhi pass turns this into `yì dīng bù shí`; the stored
      // form is deliberately the other one. See MERGE.md.
      assertIdentical(full.reading("一丁不识"), "yī dīng bù shí");
      assertIdentical(full.reading("一不小心"), "yī bù xiǎo xīn");
    });

    it("applies the override table", () => {
      assertIdentical(full.reading("大夫"), "dài fu");
    });

    it("keeps the polyphone collocations apart", () => {
      assertIdentical(full.reading("银行"), "yín háng");
      assertIdentical(full.reading("行长"), "háng zhǎng");
      assertIdentical(full.reading("重复"), "chóng fù");
      assertIdentical(full.reading("会计"), "kuài jì");
    });

    it("takes CC-CEDICT's neutral tones", () => {
      assertIdentical(full.reading("头发"), "tóu fa");
      assertIdentical(full.reading("还是"), "hái shi");
    });

    it("keys 繁體 directly, derived using the reading", () => {
      assertIdentical(full.reading("頭髮"), "tóu fa");
      assertIdentical(full.reading("銀行"), "yín háng");
    });

    it("keys every 繁體 spelling a source writes, not just the first", () => {
      // 台湾 is written both ways and both are current; so is 下面, where the
      // second spelling is the noodles rather than the surface.
      assertIdentical(full.reading("臺灣"), "tái wān");
      assertIdentical(full.reading("台灣"), "tái wān");
      assertIdentical(full.reading("下麵"), "xià miàn");
      assertIdentical(full.reading("下面"), "xià miàn");
    });

    it("marks a proper noun from jieba's tag", () => {
      const columns = full.columns("北京");
      assertNonNullable(columns);
      assertIdentical(columns[2], "ns");
      assertIdentical(columns[3], "p");
    });

    it("carries a zh-TW reading where the locales differ", () => {
      const columns = full.columns("垃圾");
      assertNonNullable(columns);
      assertIdentical(
        decodeReading(columns[1] ?? "")
          ?.map((syllable) => writeSyllable(syllable))
          .join(" "),
        "lè sè",
      );
    });

    it("carries polyphone priors on a character", () => {
      const columns = full.columns("行");
      assertNonNullable(columns);
      assertIdentical(columns[0], "xing2");
      assertNonNullable(columns[4]);
      assertArrayIncludes(columns[4].split(","), "hang2");
    });
  });

  describe("the index", () => {
    it("holds both scripts as keys", () => {
      assertTrue(full.index.has("头发"));
      assertTrue(full.index.has("頭髮"));
    });

    it("answers prefix queries, which is what the lattice needs", () => {
      assertTrue(full.index.hasPrefix("银"));
      assertFalse(full.index.hasPrefix("银行行行行"));
    });

    it("holds the whole merge", () => {
      // Both scripts of 461,623 entries, minus the ones whose scripts agree.
      assertNumberBetween(full.index.size, 700_000, 750_000);
    });
  });

  describe("the tiers", () => {
    it("nests, so a browser can load them in order", () => {
      for (let at = 0; at < core.index.size; at += 97) {
        const key = core.index.keyAt(at);
        assertTrue(standard.index.has(key));
        assertTrue(full.index.has(key));
      }
    });

    it("gives every tier the characters words are written with", () => {
      for (const tier of [core, standard, full]) {
        assertIdentical(tier.reading("银"), "yín");
        assertIdentical(tier.reading("行"), "xíng");
      }
    });

    it("keeps the phrase tail out of the smaller tiers", () => {
      assertFalse(core.index.has("银行"));
      assertTrue(standard.index.has("银行"));
    });

    it("names every tier in the artifact set", () => {
      assertArrayLength(TIERS, 3);
    });
  });
});
