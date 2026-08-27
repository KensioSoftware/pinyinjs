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

import {
  type CedictEntry,
  isStated,
  nameBoundariesOf,
  parseCedict,
} from "./cedict.js";

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
  "和 和 [he2] /(joining two nouns) and; together with; with (Taiwan pr. [han4])/(math.) sum/",
  "帆 帆 [fan1] /sail/Taiwan pr. [fan2], except 帆布[fan1 bu4] canvas/",
  "胺 胺 [an4] /(chemistry) amine/colloquial pr. [an1]; Taiwan pr. [an1]/",
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

  describe("whether a sense states a meaning", () => {
    const senses = parseCedict(
      [
        "長壽 长寿 [Chang2 shou4] /see 長壽區|长寿区[Chang2 shou4 Qu1]/",
        "長壽 长寿 [chang2 shou4] /longevity/long-lived/",
        "青龍 青龙 [Qing1 long2] /Azure Dragon/see 青龍滿族自治縣|青龙满族自治县[Qing1 long2 Man3 zu2 Zi4 zhi4 xian4]/",
        "斗六 斗六 [Dou4 liu4] /see also 斗六市[Dou4 liu4 Shi4]/",
        "里約 里约 [Li3 yue1] /Rio; abbr. for 里約熱內盧|里约热内卢[Li3 yue1 re4 nei4 lu2]/",
      ].join("\n"),
    );
    const sense = (reading: string): CedictEntry | undefined =>
      senses.find((entry) => entry.readings.join(" ") === reading);

    it("calls a bare cross-reference unstated", () => {
      const entry = sense("Chang2 shou4");
      assertNonNullable(entry);
      assertFalse(isStated(entry));
    });

    it("calls see also a cross-reference too", () => {
      const entry = sense("Dou4 liu4");
      assertNonNullable(entry);
      assertFalse(isStated(entry));
    });

    it("states a meaning where any definition gives one", () => {
      const dragon = sense("Qing1 long2");
      assertNonNullable(dragon);
      assertTrue(isStated(dragon));

      const longevity = sense("chang2 shou4");
      assertNonNullable(longevity);
      assertTrue(isStated(longevity));
    });

    it("leaves an abbreviation stated, which a place needs", () => {
      // 里约 is Rio, and abbreviating a longer name is a meaning of its own.
      const entry = sense("Li3 yue1");
      assertNonNullable(entry);
      assertTrue(isStated(entry));
    });
  });

  describe("where a proper name divides", () => {
    it("reads the boundary off the second capital", () => {
      assertArrayEquals(nameBoundariesOf(["Mao2", "Ze2", "dong1"]), [1]);
    });

    it("puts it after a compound surname without knowing what one is", () => {
      assertArrayEquals(nameBoundariesOf(["Si1", "ma3", "Qian1"]), [2]);
    });

    it("reads every capital, not only the second", () => {
      // 上海交通大学 is three elements, and one cut would leave
      // `Shànghǎi Jiāotōngdàxué`.
      assertArrayEquals(
        nameBoundariesOf(["Shang4", "hai3", "Jiao1", "tong1", "Da4", "xue2"]),
        [2, 4],
      );
    });

    it("finds none in a transliteration, which is what keeps Marx whole", () => {
      assertArrayEquals(nameBoundariesOf(["Ma3", "ke4", "si1"]), []);
    });

    it("finds none where the first syllable is not capitalised", () => {
      // A common noun says nothing about how a proper name divides, even if
      // some later syllable happens to be capitalised.
      assertArrayEquals(nameBoundariesOf(["yin2", "Hang2"]), []);
    });

    it("finds none in a single syllable", () => {
      assertArrayEquals(nameBoundariesOf(["Mao2"]), []);
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
      assertUndefined(entry.taiwanScope);
    });

    describe("scope", () => {
      it("covers the entry where the note is a definition of its own", () => {
        const entry = entryFor(parseCedict(SAMPLE), "髮");
        assertNonNullable(entry);
        assertIdentical(entry.taiwanScope, "entry");
      });

      it("covers the entry where the note carries an exception", () => {
        // 帆's note is written bare rather than parenthesised, so it qualifies
        // the headword's reading however much prose it carries.
        const entry = entryFor(parseCedict(SAMPLE), "帆");
        assertNonNullable(entry);
        assertIdentical(entry.taiwanScope, "entry");
      });

      it("covers the entry where another kind of note shares the definition", () => {
        const entry = entryFor(parseCedict(SAMPLE), "胺");
        assertNonNullable(entry);
        assertIdentical(entry.taiwanScope, "entry");
      });

      it("is the leading sense where the first definition carries the note", () => {
        const entry = entryFor(parseCedict(SAMPLE), "和");
        assertNonNullable(entry);
        assertIdentical(entry.taiwanScope, "leading");
      });

      it("is one sense where a later definition carries the note", () => {
        // 行's `xìng` is the behaviour sense alone, and 行 does not mean
        // behaviour on its own.
        const entry = entryFor(parseCedict(SAMPLE), "行", "xing2");
        assertNonNullable(entry);
        assertIdentical(entry.taiwanScope, "sense");
      });
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
      // Seventeen content lines, minus 々 and ㄅㄧㄤˋ for unknown readings.
      assertArrayLength(parseCedict(SAMPLE), 13);
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
