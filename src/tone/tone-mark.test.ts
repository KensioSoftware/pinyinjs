import { assertIdentical, assertUndefined } from "@kensio/smartass";
import { describe, it } from "vitest";

import { applyToneMark, stripToneMarks, toneFromMarks } from "./tone-mark.js";
import { NEUTRAL_TONE, type Tone } from "./tone.js";

describe("tone marks", () => {
  describe("applyToneMark", () => {
    it("marks the a of a syllable containing one", () => {
      assertIdentical(applyToneMark("hao", 3), "hǎo");
      assertIdentical(applyToneMark("guang", 1), "guāng");
      assertIdentical(applyToneMark("jiao", 4), "jiào");
    });

    it("marks o or e when there is no a", () => {
      assertIdentical(applyToneMark("zhuo", 1), "zhuō");
      assertIdentical(applyToneMark("xiong", 2), "xióng");
      assertIdentical(applyToneMark("er", 3), "ěr");
      assertIdentical(applyToneMark("feng", 1), "fēng");
    });

    it("marks the last vowel of iu and ui, per the standard", () => {
      assertIdentical(applyToneMark("jiu", 4), "jiù");
      assertIdentical(applyToneMark("gui", 4), "guì");
      assertIdentical(applyToneMark("liu", 2), "liú");
      assertIdentical(applyToneMark("hui", 3), "huǐ");
    });

    it("marks i or u when they are the only vowel", () => {
      assertIdentical(applyToneMark("yin", 1), "yīn");
      assertIdentical(applyToneMark("shi", 4), "shì");
      assertIdentical(applyToneMark("wu", 3), "wǔ");
      assertIdentical(applyToneMark("jun", 1), "jūn");
    });

    it("composes ü with its tone into a single character", () => {
      assertIdentical(applyToneMark("lü", 3), "lǚ");
      assertIdentical(applyToneMark("nü", 3), "nǚ");
      assertIdentical(applyToneMark("lüe", 4), "lüè");
    });

    it("marks the syllabic consonant of a vowelless interjection", () => {
      assertIdentical(applyToneMark("m", 2), "ḿ");
      assertIdentical(applyToneMark("ng", 3), "ňg");
      assertIdentical(applyToneMark("hm", 4), "hm̀");
    });

    it("marks ê, which is a vowel in its own right", () => {
      assertIdentical(applyToneMark("ê", 1), "ê̄");
      assertIdentical(applyToneMark("ê", 2), "ế");
    });

    it("adds no mark for the neutral tone", () => {
      assertIdentical(applyToneMark("le", NEUTRAL_TONE), "le");
      assertIdentical(applyToneMark("zi", NEUTRAL_TONE), "zi");
    });

    it("replaces any tone already marked", () => {
      assertIdentical(applyToneMark("hǎo", 4), "hào");
      assertIdentical(applyToneMark("lǚ", 2), "lǘ");
      assertIdentical(applyToneMark("hào", NEUTRAL_TONE), "hao");
    });

    it("preserves capitalisation", () => {
      assertIdentical(applyToneMark("Bei", 3), "Běi");
      assertIdentical(applyToneMark("An", 1), "Ān");
    });

    it("returns text with nothing to mark unchanged", () => {
      assertIdentical(applyToneMark("", 2), "");
      assertIdentical(applyToneMark("zh", 2), "zh");
    });
  });

  describe("stripToneMarks", () => {
    it("removes tone diacritics", () => {
      assertIdentical(stripToneMarks("hǎo"), "hao");
      assertIdentical(stripToneMarks("Běijīng"), "Beijing");
      assertIdentical(stripToneMarks("ế"), "ê");
    });

    it("keeps the diaeresis of ü, which is not a tone mark", () => {
      assertIdentical(stripToneMarks("lǚ"), "lü");
      assertIdentical(stripToneMarks("nǜ"), "nü");
      assertIdentical(stripToneMarks("ü"), "ü");
    });

    it("leaves toneless text alone", () => {
      assertIdentical(stripToneMarks("hao"), "hao");
      assertIdentical(stripToneMarks(""), "");
    });
  });

  describe("toneFromMarks", () => {
    it("reads the tone from each diacritic", () => {
      assertIdentical(toneFromMarks("mā"), 1);
      assertIdentical(toneFromMarks("má"), 2);
      assertIdentical(toneFromMarks("mǎ"), 3);
      assertIdentical(toneFromMarks("mà"), 4);
    });

    it("reports no tone for unmarked text, which is not the neutral tone", () => {
      // Reading `ma` as neutral would be a guess: it is equally the `ma` of
      // 吗 (neutral) and the `ma` someone typed for 妈 without marking it.
      assertUndefined(toneFromMarks("ma"));
      assertUndefined(toneFromMarks(""));
    });

    it("is not fooled by the diaeresis of ü", () => {
      assertUndefined(toneFromMarks("lü"));
      assertIdentical(toneFromMarks("lǚ"), 3);
    });

    it("reads tones off composed and decomposed input alike", () => {
      assertIdentical(toneFromMarks("hǎo".normalize("NFC")), 3);
      assertIdentical(toneFromMarks("hǎo".normalize("NFD")), 3);
    });
  });

  describe("round trip", () => {
    const SYLLABLES = [
      "hao",
      "jiu",
      "gui",
      "lü",
      "er",
      "yin",
      "ê",
      "m",
      "ng",
      "zhuo",
    ];

    it("recovers every contour tone applied to a representative syllable set", () => {
      for (const syllable of SYLLABLES) {
        for (const tone of [1, 2, 3, 4] satisfies readonly Tone[]) {
          const marked = applyToneMark(syllable, tone);
          assertIdentical(toneFromMarks(marked), tone);
          assertIdentical(stripToneMarks(marked), syllable);
        }
      }
    });

    it("writes a neutral tone and an unwritten tone alike, as no mark at all", () => {
      // The two are indistinguishable once written, which is exactly why they
      // have to stay distinct in the parsed form.
      for (const syllable of SYLLABLES) {
        assertIdentical(applyToneMark(syllable, NEUTRAL_TONE), syllable);
        assertIdentical(applyToneMark(syllable, undefined), syllable);
        assertUndefined(toneFromMarks(syllable));
      }
    });
  });
});
