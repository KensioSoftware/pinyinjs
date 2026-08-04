import { ATTESTED_SYLLABLES } from "#test/fixtures/attested-syllables.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { NEUTRAL_TONE, TONES } from "../tone/tone.js";
import {
  isSyllable,
  normaliseUmlaut,
  readSyllable,
  writeSyllable,
  writeSyllableSpelling,
} from "./syllable.js";

describe("syllable", () => {
  describe("readSyllable", () => {
    it("splits a plain syllable into initial and final", () => {
      const syllable = readSyllable("hao");
      assertNonNullable(syllable);
      assertIdentical(syllable.initial, "h");
      assertIdentical(syllable.final, "ao");
      // No tone was written, which is not the same as the neutral tone.
      assertUndefined(syllable.tone);
    });

    it("distinguishes an unwritten tone from the neutral tone", () => {
      assertUndefined(readSyllable("de")?.tone);
      assertIdentical(readSyllable("de5")?.tone, NEUTRAL_TONE);
      assertIdentical(readSyllable("de0")?.tone, NEUTRAL_TONE);
    });

    it("leaves an unwritten tone unwritten rather than inventing tone 5", () => {
      const syllable = readSyllable("bei");
      assertNonNullable(syllable);
      assertIdentical(writeSyllable(syllable, "numbers"), "bei");
      assertIdentical(writeSyllable(syllable, "marks"), "bei");
    });

    it("prefers the two-letter retroflex initials over their first letter", () => {
      assertIdentical(readSyllable("zhong")?.initial, "zh");
      assertIdentical(readSyllable("chi")?.initial, "ch");
      assertIdentical(readSyllable("shui")?.initial, "sh");
      assertIdentical(readSyllable("zi")?.initial, "z");
    });

    it("recovers the vowel that abbreviated finals drop", () => {
      assertIdentical(readSyllable("jiu")?.final, "iou");
      assertIdentical(readSyllable("gui")?.final, "uei");
      assertIdentical(readSyllable("gun")?.final, "uen");
    });

    it("reads u as ü after a palatal initial", () => {
      assertIdentical(readSyllable("ju")?.final, "ü");
      assertIdentical(readSyllable("xue")?.final, "üe");
      assertIdentical(readSyllable("quan")?.final, "üan");
      assertIdentical(readSyllable("jun")?.final, "ün");
    });

    it("keeps u as u after a non-palatal initial", () => {
      assertIdentical(readSyllable("gu")?.final, "u");
      assertIdentical(readSyllable("guan")?.final, "uan");
      assertIdentical(readSyllable("duo")?.final, "uo");
    });

    it("distinguishes the two finals written un", () => {
      assertIdentical(readSyllable("jun")?.final, "ün");
      assertIdentical(readSyllable("gun")?.final, "uen");
    });

    it("keeps ü after n and l, where it is written out", () => {
      assertIdentical(readSyllable("lü")?.final, "ü");
      assertIdentical(readSyllable("nüe")?.final, "üe");
    });

    it("strips the y and w onsets of a syllable with no initial", () => {
      for (const [text, final] of [
        ["yi", "i"],
        ["you", "iou"],
        ["yan", "ian"],
        ["wu", "u"],
        ["wei", "uei"],
        ["wen", "uen"],
        ["yu", "ü"],
        ["yuan", "üan"],
        ["yun", "ün"],
      ] as const) {
        const syllable = readSyllable(text);
        assertNonNullable(syllable);
        assertIdentical(syllable.initial, "");
        assertIdentical(syllable.final, final);
      }
    });

    it("reads the syllabic nasals rather than mistaking them for an initial", () => {
      assertIdentical(readSyllable("n")?.final, "n");
      assertIdentical(readSyllable("ng")?.final, "ng");
      assertIdentical(readSyllable("m")?.final, "m");
      assertIdentical(readSyllable("hm")?.initial, "h");
      assertIdentical(readSyllable("hng")?.final, "ng");
    });

    it("reads the r suffix of 儿化 as a suffix, not a syllable", () => {
      for (const [text, final] of [
        ["wánr", "uan"],
        ["diǎnr", "ian"],
        ["huār", "ua"],
        ["wèir", "uei"],
        ["zhèr", "e"],
      ] as const) {
        const syllable = readSyllable(text);
        assertNonNullable(syllable);
        assertIdentical(syllable.final, final);
        assertTrue(syllable.erhua);
      }
    });

    it("reads gēr as gē with a suffix, since er never follows an initial", () => {
      const syllable = readSyllable("gēr");
      assertNonNullable(syllable);
      assertIdentical(syllable.initial, "g");
      assertIdentical(syllable.final, "e");
      assertTrue(syllable.erhua);
    });

    it("keeps ér and èr as themselves rather than e with a suffix", () => {
      for (const text of ["ér", "èr", "er"]) {
        const syllable = readSyllable(text);
        assertNonNullable(syllable);
        assertIdentical(syllable.final, "er");
        assertUndefined(syllable.erhua);
      }
    });

    it("reads tones from diacritics", () => {
      assertIdentical(readSyllable("hǎo")?.tone, 3);
      assertIdentical(readSyllable("jiù")?.tone, 4);
      assertIdentical(readSyllable("lǚ")?.tone, 3);
    });

    it("reads tones from trailing numbers", () => {
      assertIdentical(readSyllable("hao3")?.tone, 3);
      assertIdentical(readSyllable("jiu4")?.tone, 4);
      assertIdentical(readSyllable("le5")?.tone, NEUTRAL_TONE);
      assertIdentical(readSyllable("le0")?.tone, NEUTRAL_TONE);
    });

    it("accepts the v and u: conventions for ü", () => {
      assertIdentical(readSyllable("lv3")?.final, "ü");
      assertIdentical(readSyllable("nu:3")?.final, "ü");
      assertIdentical(readSyllable("lve4")?.final, "üe");
    });

    it("is case insensitive", () => {
      assertIdentical(readSyllable("Hǎo")?.final, "ao");
      assertIdentical(readSyllable("BEI")?.initial, "b");
    });

    it("rejects strings that are not syllables", () => {
      for (const text of ["", "  ", "xyz", "q", "shr", "iou", "ping2ping"]) {
        assertUndefined(readSyllable(text));
      }
    });

    it("rejects tone notation given twice", () => {
      assertUndefined(readSyllable("jiù4"));
      assertUndefined(readSyllable("hǎo3"));
    });

    it("rejects underlying forms that a spelling rule requires be abbreviated", () => {
      // These are how the finals are pronounced, not how they are written.
      assertUndefined(readSyllable("jiou"));
      assertUndefined(readSyllable("guei"));
      assertUndefined(readSyllable("guen"));
    });

    it("rejects ü written out after a palatal initial", () => {
      // ju, xue and quan are the only correct spellings of these.
      assertUndefined(readSyllable("jü"));
      assertUndefined(readSyllable("xüe"));
      assertUndefined(readSyllable("qüan"));
    });

    it("rejects finals that cannot stand alone without an initial", () => {
      assertUndefined(readSyllable("ong"));
      assertUndefined(readSyllable("uei"));
      assertUndefined(readSyllable("io"));
    });
  });

  describe("writeSyllable", () => {
    it("restores the vowel that abbreviated finals drop", () => {
      assertIdentical(
        writeSyllableSpelling({ initial: "j", final: "iou", tone: 4 }),
        "jiu",
      );
      assertIdentical(
        writeSyllableSpelling({ initial: "g", final: "uei", tone: 4 }),
        "gui",
      );
      assertIdentical(
        writeSyllableSpelling({ initial: "g", final: "uen", tone: 3 }),
        "gun",
      );
    });

    it("drops the diaeresis after a palatal initial but keeps it after n and l", () => {
      assertIdentical(
        writeSyllableSpelling({ initial: "j", final: "ü", tone: 1 }),
        "ju",
      );
      assertIdentical(
        writeSyllableSpelling({ initial: "x", final: "üe", tone: 2 }),
        "xue",
      );
      assertIdentical(
        writeSyllableSpelling({ initial: "l", final: "ü", tone: 3 }),
        "lü",
      );
      assertIdentical(
        writeSyllableSpelling({ initial: "n", final: "üe", tone: 4 }),
        "nüe",
      );
    });

    it("adds the y and w onsets when there is no initial", () => {
      assertIdentical(
        writeSyllableSpelling({ initial: "", final: "i", tone: 1 }),
        "yi",
      );
      assertIdentical(
        writeSyllableSpelling({ initial: "", final: "iou", tone: 3 }),
        "you",
      );
      assertIdentical(
        writeSyllableSpelling({ initial: "", final: "ü", tone: 2 }),
        "yu",
      );
    });

    it("writes tones in each notation", () => {
      const syllable = { initial: "h", final: "ao", tone: 3 } as const;
      assertIdentical(writeSyllable(syllable, "marks"), "hǎo");
      assertIdentical(writeSyllable(syllable, "numbers"), "hao3");
      assertIdentical(writeSyllable(syllable, "superscript"), "hao³");
      assertIdentical(writeSyllable(syllable, "none"), "hao");
    });

    it("raises the tone number in the superscript notation", () => {
      assertArrayEquals(
        TONES.map((tone) =>
          writeSyllable({ initial: "m", final: "a", tone }, "superscript"),
        ),
        ["ma¹", "ma²", "ma³", "ma⁴", "ma⁵"],
      );
    });

    it("leaves an unwritten tone unwritten when raising it", () => {
      assertIdentical(
        writeSyllable(
          { initial: "b", final: "ei", tone: undefined },
          "superscript",
        ),
        "bei",
      );
    });

    it("reads back a raised tone number, so the notation round-trips", () => {
      assertIdentical(readSyllable("hao³")?.tone, 3);
      assertIdentical(readSyllable("ma⁵")?.tone, NEUTRAL_TONE);
      assertIdentical(readSyllable("ma⁰")?.tone, NEUTRAL_TONE);
      // Mixed notation is a mistake raised or not.
      assertUndefined(readSyllable("hǎo³"));
    });

    it("writes the r suffix of 儿化 after the tone-marked syllable", () => {
      assertIdentical(
        writeSyllable({ initial: "", final: "uan", tone: 2, erhua: true }),
        "wánr",
      );
      assertIdentical(
        writeSyllable({ initial: "d", final: "ian", tone: 3, erhua: true }),
        "diǎnr",
      );
      assertIdentical(
        writeSyllable({ initial: "g", final: "e", tone: 1, erhua: true }),
        "gēr",
      );
    });

    it("writes tone marks by default", () => {
      assertIdentical(
        writeSyllable({ initial: "j", final: "iou", tone: 4 }),
        "jiù",
      );
    });
  });

  describe("normaliseUmlaut", () => {
    it("converts both input conventions", () => {
      assertIdentical(normaliseUmlaut("lv"), "lü");
      assertIdentical(normaliseUmlaut("nu:"), "nü");
      assertIdentical(normaliseUmlaut("LV"), "LÜ");
    });
  });

  describe("isSyllable", () => {
    it("distinguishes syllables from non-syllables", () => {
      assertTrue(isSyllable("hǎo"));
      assertFalse(isSyllable("xyz"));
    });
  });

  describe("the attested inventory", () => {
    it("has syllables to check", () => {
      assertArrayLength(ATTESTED_SYLLABLES, 415);
    });

    it("parses and rewrites every syllable attested in the corpus", () => {
      const failures: string[] = [];
      for (const attested of ATTESTED_SYLLABLES) {
        const syllable = readSyllable(attested);
        if (syllable === undefined) {
          failures.push(`${attested}: did not parse`);
          continue;
        }
        const rewritten = writeSyllableSpelling(syllable);
        if (rewritten !== attested) {
          failures.push(`${attested}: rewrote as ${rewritten}`);
        }
      }
      assertArrayLength(failures, 0);
    });
  });
});
