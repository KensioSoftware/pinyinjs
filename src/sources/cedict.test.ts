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

import { type CedictEntry, nameBoundaryOf, parseCedict } from "./cedict.js";

/**
 * Real lines from CC-CEDICT, kept verbatim so the parser is tested against the
 * format as it actually ships.
 */
const SAMPLE = [
  "# CC-CEDICT",
  "# Community maintained free Chinese-English dictionary.",
  "發 发 [fa1] /to send out/to show (one's feeling)/to issue/",
  "髮 发 [fa4] /hair/Taiwan pr. [fa3]/",
  "北京 北京 [Bei3 jing1] /Beijing municipality, capital of the PRC/",
  "玩兒 玩儿 [wan2 r5] /to play/to have fun/to hang out/",
  "一律 一律 [yi1 lu:4] /same; identical/uniformly; all; without exception/",
  "々 々 [xx5] /iteration mark indicating repetition/",
  "A圈兒 A圈儿 [A quan1 r5] /at symbol, @/",
  "行 行 [hang2] /(bound form) row; line/",
  "行 行 [xing2] /capable; competent/behavior; conduct (Taiwan pr. [xing4])/",
  "銀行 银行 [yin2 hang2] /bank/CL:家[jia1],個|个[ge4]/",
  // "Taiwan pr." here is prose about another word, not an annotation.
  "樂色 乐色 [le4 se4] /(slang) trash; garbage (pun on the Taiwan pr. of 垃圾[la1 ji1])/",
  // Every syllable unknown, not just the first.
  "ㄅㄧㄤˋ ㄅㄧㄤˋ [xx5 xx5 xx5 xx5] /(Tw) (coll.) cool/awesome/",
  "not an entry at all",
].join("\n");

/**
 * The single entry matching a traditional headword and reading.
 */
function entryFor(
  entries: readonly CedictEntry[],
  traditional: string,
  firstReading?: string,
): CedictEntry | undefined {
  return entries.find(
    (entry) =>
      entry.traditional === traditional &&
      (firstReading === undefined || entry.readings[0] === firstReading),
  );
}

describe("CC-CEDICT source", () => {
  describe("parseCedict", () => {
    it("reads the traditional and simplified forms and the reading", () => {
      const entry = entryFor(parseCedict(SAMPLE), "銀行");
      assertNonNullable(entry);
      assertIdentical(entry.simplified, "银行");
      assertArrayEquals(entry.readings, ["yin2", "hang2"]);
    });

    it("keeps an entry whose two scripts are identical", () => {
      const entry = entryFor(parseCedict(SAMPLE), "北京");
      assertNonNullable(entry);
      assertIdentical(entry.simplified, "北京");
    });

    it("keeps every sense of a word that has several readings", () => {
      // 行 is hang2 and xing2, and losing either would lose 银行 or 行动.
      const senses = parseCedict(SAMPLE).filter(
        (entry) => entry.traditional === "行",
      );
      assertArrayLength(senses, 2);
      assertArrayEquals(
        senses.map((sense) => sense.readings[0] ?? ""),
        ["hang2", "xing2"],
      );
    });

    it("distinguishes the two traditional characters that merged into 发", () => {
      // This is the ambiguity that makes traditional text easier to convert.
      const send = entryFor(parseCedict(SAMPLE), "發");
      const hair = entryFor(parseCedict(SAMPLE), "髮");
      assertNonNullable(send);
      assertNonNullable(hair);
      assertIdentical(send.simplified, "发");
      assertIdentical(hair.simplified, "发");
      assertArrayEquals(send.readings, ["fa1"]);
      assertArrayEquals(hair.readings, ["fa4"]);
    });
  });

  describe("proper nouns", () => {
    it("marks a capitalised reading as a proper noun", () => {
      const entry = entryFor(parseCedict(SAMPLE), "北京");
      assertNonNullable(entry);
      assertTrue(entry.isProperNoun);
    });

    it("leaves a common noun unmarked", () => {
      const entry = entryFor(parseCedict(SAMPLE), "銀行");
      assertNonNullable(entry);
      assertFalse(entry.isProperNoun);
    });

    it("is fooled by a headword that starts with a Latin letter", () => {
      // A圈儿 is the at sign, not a proper noun. Documented as corroboration
      // only; jieba's POS tags are the signal that decides.
      const entry = entryFor(parseCedict(SAMPLE), "A圈兒");
      assertNonNullable(entry);
      assertTrue(entry.isProperNoun);
    });
  });

  describe("where the 姓 ends", () => {
    it("reads the boundary off the second capital", () => {
      assertIdentical(nameBoundaryOf(["Mao2", "Ze2", "dong1"]), 1);
    });

    it("puts it after a compound surname without knowing what one is", () => {
      assertIdentical(nameBoundaryOf(["Si1", "ma3", "Qian1"]), 2);
    });

    it("finds none in a transliteration, which is what keeps Marx whole", () => {
      assertUndefined(nameBoundaryOf(["Ma3", "ke4", "si1"]));
    });

    it("finds none where the first syllable is not capitalised", () => {
      // A common noun says nothing about 姓 and 名, even if some later
      // syllable happens to be capitalised: 阿Q正传 is not a person.
      assertUndefined(nameBoundaryOf(["yin2", "Hang2"]));
    });

    it("finds none in a single syllable", () => {
      assertUndefined(nameBoundaryOf(["Mao2"]));
    });
  });

  describe("Taiwan readings", () => {
    it("reads a standalone Taiwan pronunciation note", () => {
      const entry = entryFor(parseCedict(SAMPLE), "髮");
      assertNonNullable(entry);
      assertArrayEquals(entry.taiwanReadings ?? [], ["fa3"]);
    });

    it("reads one buried inside a definition", () => {
      const entry = entryFor(parseCedict(SAMPLE), "行", "xing2");
      assertNonNullable(entry);
      assertArrayEquals(entry.taiwanReadings ?? [], ["xing4"]);
    });

    it("ignores a mention of Taiwan pronunciation in prose", () => {
      // 樂色 glosses itself as a pun on the Taiwan reading of 垃圾. Matching on
      // the phrase alone would wrongly assign it la1 ji1; the annotation form
      // is what counts.
      const entry = entryFor(parseCedict(SAMPLE), "樂色");
      assertNonNullable(entry);
      assertUndefined(entry.taiwanReadings);
    });

    it("leaves it unset where the annotation is empty", () => {
      const entries = parseCedict("測 测 [ce4] /to test/Taiwan pr. [ ]/");
      const entry = entryFor(entries, "測");
      assertNonNullable(entry);
      assertUndefined(entry.taiwanReadings);
    });

    it("leaves it unset where the entry notes none", () => {
      const entry = entryFor(parseCedict(SAMPLE), "銀行");
      assertNonNullable(entry);
      assertUndefined(entry.taiwanReadings);
    });
  });

  describe("conventions left for the merge step", () => {
    it("keeps the r5 erhua marker as written", () => {
      const entry = entryFor(parseCedict(SAMPLE), "玩兒");
      assertNonNullable(entry);
      assertArrayEquals(entry.readings, ["wan2", "r5"]);
    });

    it("keeps the u: spelling of ü as written", () => {
      const entry = entryFor(parseCedict(SAMPLE), "一律");
      assertNonNullable(entry);
      assertArrayEquals(entry.readings, ["yi1", "lu:4"]);
    });
  });

  describe("what it drops", () => {
    it("drops an entry whose pronunciation is unknown", () => {
      assertUndefined(entryFor(parseCedict(SAMPLE), "々"));
    });

    it("drops an entry whose syllables are all unknown", () => {
      assertUndefined(entryFor(parseCedict(SAMPLE), "ㄅㄧㄤˋ"));
    });

    it("drops comments and unparseable lines", () => {
      // Fourteen content lines, minus 々 and ㄅㄧㄤˋ for unknown readings.
      assertArrayLength(parseCedict(SAMPLE), 10);
    });

    it("returns nothing for an empty file", () => {
      assertArrayLength(parseCedict(""), 0);
    });
  });

  describe("definitions", () => {
    it("splits them on the slash separator", () => {
      const entry = entryFor(parseCedict(SAMPLE), "發");
      assertNonNullable(entry);
      assertArrayLength(entry.definitions, 3);
      assertIdentical(entry.definitions[0], "to send out");
    });

    it("is not confused by a bracketed cross-reference in a definition", () => {
      // CL:家[jia1] must not be mistaken for the entry's own reading.
      const entry = entryFor(parseCedict(SAMPLE), "銀行");
      assertNonNullable(entry);
      assertArrayEquals(entry.readings, ["yin2", "hang2"]);
    });
  });
});
