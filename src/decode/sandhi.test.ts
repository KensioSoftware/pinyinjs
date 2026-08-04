import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { applySandhi, type SandhiOptions } from "./sandhi.js";

/**
 * Read a reading the way the dictionary stores one: fully toned.
 */
function reading(text: string): readonly Syllable[] {
  return text.split(" ").map((token) => {
    const syllable = readSyllable(token);
    if (syllable === undefined) {
      throw new Error(`not a syllable: ${token}`);
    }
    return { ...syllable, tone: syllable.tone ?? NEUTRAL_TONE };
  });
}

/**
 * Apply sandhi and write the result back out.
 */
function sandhied(text: string, options?: SandhiOptions): readonly string[] {
  return applySandhi(reading(text), options).map((syllable) =>
    writeSyllable(syllable),
  );
}

describe("tone sandhi", () => {
  describe("一", () => {
    it("flattens to second tone before a fourth", () => {
      assertArrayEquals(sandhied("yī gè"), ["yí", "gè"]);
      assertArrayEquals(sandhied("yī yàng"), ["yí", "yàng"]);
    });

    it("raises to fourth tone before first, second and third", () => {
      assertArrayEquals(sandhied("yī tiān"), ["yì", "tiān"]);
      assertArrayEquals(sandhied("yī nián"), ["yì", "nián"]);
      assertArrayEquals(sandhied("yī qǐ"), ["yì", "qǐ"]);
    });

    it("keeps its citation tone with nothing to assimilate to", () => {
      // 第一 is dìyī: nothing follows, so nothing changes it.
      assertArrayEquals(sandhied("dì yī"), ["dì", "yī"]);
    });

    it("keeps its citation tone before a neutral syllable", () => {
      assertArrayEquals(sandhied("yī ge"), ["yī", "ge"]);
    });

    it("leaves a 一 that is not first tone alone", () => {
      // Anything already retoned came from a source that baked sandhi in, and
      // the dictionary is supposed to have normalised that out.
      assertArrayEquals(sandhied("yì tiān"), ["yì", "tiān"]);
    });

    it("does not touch another syllable spelled yi", () => {
      assertArrayEquals(sandhied("yí dòng"), ["yí", "dòng"]);
    });
  });

  describe("不", () => {
    it("flattens to second tone before a fourth", () => {
      assertArrayEquals(sandhied("bù shì"), ["bú", "shì"]);
      assertArrayEquals(sandhied("bù duì"), ["bú", "duì"]);
    });

    it("stays fourth tone before anything else", () => {
      assertArrayEquals(sandhied("bù hǎo"), ["bù", "hǎo"]);
      assertArrayEquals(sandhied("bù duō"), ["bù", "duō"]);
    });

    it("stays fourth tone at the end", () => {
      assertArrayEquals(sandhied("hǎo bù"), ["hǎo", "bù"]);
    });

    it("assimilates across a word boundary", () => {
      // The whole reason sandhi is a pass over the syllable array rather than
      // something baked into an entry: 不 and 客气 are separate words, and the
      // 客 that retones the 不 is in the second of them.
      assertArrayEquals(sandhied("bù kè qi"), ["bú", "kè", "qi"]);
      assertArrayEquals(sandhied("bù shì wǒ"), ["bú", "shì", "wǒ"]);
    });
  });

  describe("third tone", () => {
    it("is not written by default, since orthography writes underlying tones", () => {
      assertArrayEquals(sandhied("nǐ hǎo"), ["nǐ", "hǎo"]);
    });

    it("is written when the caller asks for it", () => {
      assertArrayEquals(sandhied("nǐ hǎo", { thirdTone: true }), ["ní", "hǎo"]);
    });

    it("reads left to right off the underlying tones", () => {
      // Not `ní ní hǎo`: the middle syllable is judged against the third tone
      // that follows it, not against what it was just rewritten to.
      assertArrayEquals(sandhied("wǒ hěn hǎo", { thirdTone: true }), [
        "wó",
        "hén",
        "hǎo",
      ]);
    });
  });

  describe("switching it off", () => {
    it("leaves 一 and 不 alone", () => {
      assertArrayEquals(sandhied("yī gè", { yiBu: false }), ["yī", "gè"]);
      assertArrayEquals(sandhied("bù shì", { yiBu: false }), ["bù", "shì"]);
    });
  });

  it("does not modify the reading it was given", () => {
    const original = reading("yī gè");
    applySandhi(original);
    assertArrayEquals(
      original.map((syllable) => writeSyllable(syllable)),
      ["yī", "gè"],
    );
  });

  it("passes an empty reading through", () => {
    assertArrayEquals(applySandhi([]), []);
  });
});
