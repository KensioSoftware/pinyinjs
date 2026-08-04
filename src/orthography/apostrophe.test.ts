import { assertArrayEquals, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { joinWord, markWord } from "./apostrophe.js";

describe("joining a word's syllables", () => {
  it("writes the 隔音符号 before a syllable beginning with a, o or e", () => {
    assertIdentical(joinWord(["Xī", "ān"]), "Xī'ān");
    assertIdentical(joinWord(["Tiān", "ān", "mén"]), "Tiān'ānmén");
    assertIdentical(joinWord(["kě", "ài"]), "kě'ài");
    assertIdentical(joinWord(["hǎi", "ōu"]), "hǎi'ōu");
    assertIdentical(joinWord(["nǚ", "ér"]), "nǚ'ér");
  });

  it("writes nothing before the first syllable, wherever it starts", () => {
    assertIdentical(joinWord(["ān", "quán"]), "ānquán");
    assertIdentical(joinWord(["é", "luó", "sī"]), "éluósī");
  });

  it("leaves i, u and ü alone, since they cannot begin a syllable", () => {
    // They surface as y and w, so there is no boundary to lose.
    assertIdentical(joinWord(["Běi", "jīng"]), "Běijīng");
    assertIdentical(joinWord(["yín", "háng"]), "yínháng");
    assertIdentical(joinWord(["Zhōng", "guó"]), "Zhōngguó");
  });

  it("writes one where the reading really would change", () => {
    // Xīān reads as the single syllable xian, so `standard` writes it too.
    assertIdentical(joinWord(["Xī", "ān"], "standard"), "Xī'ān");
  });

  it("leaves an unambiguous run alone under the standard's own condition", () => {
    // hǎiōu cannot be read as anything but two syllables, so the standard does
    // not strictly require the mark — which is the case `always` overrides.
    assertIdentical(joinWord(["hǎi", "ōu"], "standard"), "hǎiōu");
    assertIdentical(joinWord(["kě", "ài"], "standard"), "kěài");
  });

  it("writes none at all when asked", () => {
    assertIdentical(joinWord(["Xī", "ān"], "never"), "Xīān");
  });

  it("joins a single syllable and nothing at all", () => {
    assertIdentical(joinWord(["ān"]), "ān");
    assertIdentical(joinWord([]), "");
  });

  it("handles a syllable it cannot read back, rather than throwing", () => {
    // `standard` asks the splitter to read the join back; a word it cannot
    // parse falls through to writing the mark.
    assertIdentical(joinWord(["zzz", "ān"], "standard"), "zzz'ān");
  });
});

describe("marking a word's syllables one by one", () => {
  it("keeps the mark on the syllable it belongs to", () => {
    assertArrayEquals(markWord(["Xī", "ān"]), ["Xī", "'ān"]);
    assertArrayEquals(markWord(["Tiān", "ān", "mén"]), ["Tiān", "'ān", "mén"]);
  });

  it("leaves a word that needs no mark exactly as it was", () => {
    assertArrayEquals(markWord(["yín", "háng"]), ["yín", "háng"]);
  });

  it("honours the style it is given", () => {
    assertArrayEquals(markWord(["Xī", "ān"], "never"), ["Xī", "ān"]);
    assertArrayEquals(markWord(["hǎi", "ōu"], "standard"), ["hǎi", "ōu"]);
    assertArrayEquals(markWord(["Xī", "ān"], "standard"), ["Xī", "'ān"]);
  });

  it("joins to exactly what joinWord writes", () => {
    for (const style of ["always", "standard", "never"] as const) {
      assertIdentical(
        markWord(["Xī", "ān"], style).join(""),
        joinWord(["Xī", "ān"], style),
      );
    }
  });
});
