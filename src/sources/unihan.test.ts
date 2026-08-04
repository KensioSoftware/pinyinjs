import {
  assertArrayEquals,
  assertIdentical,
  assertMapSize,
  assertNonNullable,
  assertSetSize,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { parseUnihanReadings, parseUnihanVariants } from "./unihan.js";

/**
 * Real lines from `Unihan_Readings.txt`, kept verbatim so the parser is tested
 * against the format as it actually ships.
 */
const READINGS_SAMPLE = [
  "# Unihan_Readings.txt",
  "# Date: 2025-07-24",
  "",
  "U+5F97\tkCantonese\tdak1",
  "U+5F97\tkDefinition\tobtain, get, gain, acquire",
  "U+5F97\tkHanyuPinlu\tde(5096) dé(1496) děi(637)",
  "U+5F97\tkMandarin\tdé",
  "U+5F97\tkTGHZ2013\t069.040:dé 069.090:de 069.110:děi",
  "U+5F97\tkXHC1983\t0223.030:dé 0225.010:de 0225.040:děi",
  "U+884C\tkHanyuPinlu\txíng(2943) háng(218)",
  "U+884C\tkMandarin\txíng",
  "U+884C\tkTGHZ2013\t131.140:háng 136.100:héng 408.120:xíng",
  "U+4E07\tkMandarin\twàn mò",
  "U+4E00\tkHanyuPinlu\tyī(32747)",
].join("\n");

describe("Unihan sources", () => {
  describe("parseUnihanReadings", () => {
    it("orders readings by how often each is actually used", () => {
      // kHanyuPinlu is the only source that ranks a polyphone's readings, and
      // 得 is read de far more often than dé or děi.
      const parsed = parseUnihanReadings(READINGS_SAMPLE);
      const character = parsed.get("得");
      assertNonNullable(character);
      assertArrayEquals(character.readings, ["de", "dé", "děi"]);
    });

    it("prefers the frequency ranking over the dictionary ordering", () => {
      // kTGHZ2013 lists 行 as háng, héng, xíng; kHanyuPinlu says xíng leads.
      const parsed = parseUnihanReadings(READINGS_SAMPLE);
      const character = parsed.get("行");
      assertNonNullable(character);
      assertIdentical(character.readings[0], "xíng");
    });

    it("keeps readings only the lower-priority fields know about", () => {
      // héng appears in kTGHZ2013 but not in kHanyuPinlu, and must survive.
      const parsed = parseUnihanReadings(READINGS_SAMPLE);
      const character = parsed.get("行");
      assertNonNullable(character);
      assertArrayEquals(character.readings, ["xíng", "háng", "héng"]);
    });

    it("does not repeat a reading that several fields agree on", () => {
      const parsed = parseUnihanReadings(READINGS_SAMPLE);
      const character = parsed.get("得");
      assertNonNullable(character);
      assertSetSize(new Set(character.readings), 3);
    });

    it("reads the second kMandarin value as the Taiwan reading", () => {
      // 万 is wàn on the mainland and mò in Taiwan.
      const parsed = parseUnihanReadings(READINGS_SAMPLE);
      const character = parsed.get("万");
      assertNonNullable(character);
      assertArrayEquals(character.readings, ["wàn"]);
      assertIdentical(character.taiwanReading, "mò");
    });

    it("leaves the Taiwan reading unset where the locales agree", () => {
      const parsed = parseUnihanReadings(READINGS_SAMPLE);
      const character = parsed.get("行");
      assertNonNullable(character);
      assertUndefined(character.taiwanReading);
    });

    it("handles a character with a single reading and no ranking", () => {
      const parsed = parseUnihanReadings(READINGS_SAMPLE);
      const character = parsed.get("一");
      assertNonNullable(character);
      assertArrayEquals(character.readings, ["yī"]);
    });

    it("ignores comments, blank lines and fields it does not want", () => {
      const parsed = parseUnihanReadings(READINGS_SAMPLE);
      // 4 characters appear, and none of the Cantonese or definition lines
      // introduced a fifth.
      assertMapSize(parsed, 4);
    });

    it("skips a field whose value carries no readable reading", () => {
      // A kHanyuPinlu value with no counts parses to nothing, and must not
      // register the character with an empty reading list.
      assertMapSize(parseUnihanReadings("U+5F97\tkHanyuPinlu\tmalformed"), 0);
    });

    it("returns nothing for an empty file", () => {
      assertMapSize(parseUnihanReadings(""), 0);
    });
  });

  describe("parseUnihanVariants", () => {
    const VARIANTS_SAMPLE = [
      "# Unihan_Variants.txt",
      "U+767C\tkSimplifiedVariant\tU+53D1",
      "U+9AEE\tkSimplifiedVariant\tU+53D1",
      "U+53D1\tkTraditionalVariant\tU+767C U+9AEE",
      "U+4E07\tkTraditionalVariant\tU+842C",
      "U+5EFA\tkTotalStrokes\t9",
    ].join("\n");

    it("maps a simplified character to every traditional form of it", () => {
      // 发 is the merge of 發 (fā, to send) and 髮 (fà, hair).
      const { traditional } = parseUnihanVariants(VARIANTS_SAMPLE);
      assertArrayEquals(traditional.get("发") ?? [], ["發", "髮"]);
    });

    it("maps each traditional character to its simplified form", () => {
      const { simplified } = parseUnihanVariants(VARIANTS_SAMPLE);
      assertArrayEquals(simplified.get("發") ?? [], ["发"]);
      assertArrayEquals(simplified.get("髮") ?? [], ["发"]);
    });

    it("handles a one-to-one mapping", () => {
      const { traditional } = parseUnihanVariants(VARIANTS_SAMPLE);
      assertArrayEquals(traditional.get("万") ?? [], ["萬"]);
    });

    it("ignores fields that are not variants", () => {
      const { simplified, traditional } = parseUnihanVariants(VARIANTS_SAMPLE);
      assertUndefined(simplified.get("建"));
      assertUndefined(traditional.get("建"));
    });

    it("skips a variant field naming no code point", () => {
      const { traditional } = parseUnihanVariants(
        "U+53D1\tkTraditionalVariant\tnot-a-code-point",
      );
      assertMapSize(traditional, 0);
    });

    it("returns nothing for an empty file", () => {
      const { simplified, traditional } = parseUnihanVariants("");
      assertMapSize(simplified, 0);
      assertMapSize(traditional, 0);
    });
  });
});
