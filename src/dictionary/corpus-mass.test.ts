import { assertIdentical, assertUndefined } from "@kensio/smartass";
import { describe, it } from "vitest";

import type { CedictEntry } from "../sources/cedict.js";
import type { JiebaEntry } from "../sources/jieba.js";
import type {
  ReadingField,
  UnihanReadings,
  UnihanVariants,
} from "../sources/unihan.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  countCorpusMass,
  type MassSources,
  rankByCorpusMass,
} from "./corpus-mass.js";
import { readAlignedReading } from "./reading.js";
import { pairScripts, TraditionalTable } from "./traditional.js";

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
 * A 轻声 syllable, which a source writes with no tone mark at all.
 */
function neutral(text: string): Syllable {
  return { ...syllable(text), tone: NEUTRAL_TONE };
}

/**
 * The fields of a character `kMandarin` names one reading for.
 */
function named(reading: string): ReadonlyMap<ReadingField, string[]> {
  return new Map([["kMandarin", [reading]]]);
}

/**
 * A ranking written out, for readable expectations.
 */
function order(readings: readonly Syllable[]): string {
  return readings.map((reading) => writeSyllable(reading)).join(" ");
}

/**
 * A Unihan entry naming a character's readings, likeliest first.
 */
function unihan(readings: readonly string[]): UnihanReadings {
  return { readings, fields: new Map([["kMandarin", readings]]) };
}

const UNIHAN_READINGS: ReadonlyMap<string, UnihanReadings> = new Map([
  ["发", unihan(["fā", "fà"])],
  ["發", unihan(["fā"])],
  ["髮", unihan(["fà"])],
  ["头", unihan(["tóu"])],
  ["頭", unihan(["tóu"])],
]);

const UNIHAN_VARIANTS: UnihanVariants = {
  simplified: new Map(),
  traditional: new Map([
    ["发", ["發", "髮"]],
    ["头", ["头", "頭"]],
  ]),
};

/**
 * A CC-CEDICT entry, with the fields this module reads.
 */
function cedict(
  simplified: string,
  traditional: string,
  readings: readonly string[],
): CedictEntry {
  return {
    simplified,
    traditional,
    readings,
    isProperNoun: false,
    definitions: [],
  };
}

/**
 * jieba's counts for the words a test uses.
 */
function jieba(
  counts: Record<string, number>,
): ReadonlyMap<string, JiebaEntry> {
  return new Map(
    Object.entries(counts).map(([word, frequency]) => [
      word,
      { frequency, partOfSpeech: "" },
    ]),
  );
}

/**
 * The 繁體 table, built from the same CC-CEDICT entries the mass is counted
 * over, exactly as the merge builds it.
 */
function traditionalTable(entries: readonly CedictEntry[]): TraditionalTable {
  return TraditionalTable.build(
    entries.flatMap((entry) =>
      pairScripts(
        entry.simplified,
        entry.traditional,
        readAlignedReading(entry.simplified, entry.readings),
      ),
    ),
    UNIHAN_VARIANTS,
    UNIHAN_READINGS,
  );
}

/**
 * Count the mass over one set of sources.
 */
function count(sources: Partial<MassSources>) {
  const entries = sources.cedict ?? [];
  return countCorpusMass(
    {
      phrase: sources.phrase ?? new Map(),
      cedict: entries,
      jieba: sources.jieba ?? new Map(),
    },
    traditionalTable(entries),
  );
}

describe("corpus mass", () => {
  describe("counting", () => {
    it("weights each reading by how often jieba saw the word", () => {
      const mass = count({
        phrase: new Map([
          ["发送", ["fā", "sòng"]],
          ["头发", ["tóu", "fà"]],
        ]),
        jieba: jieba({ 发送: 300, 头发: 40 }),
      });
      const cast = mass.get("发");
      assertIdentical(cast?.get("f|a|1"), 300);
      assertIdentical(cast.get("f|a|4"), 40);
    });

    it("gives a character no votes of its own", () => {
      // A one-character entry's reading is the default being ranked, so
      // counting it would have the ranking confirm itself.
      const mass = count({
        phrase: new Map([["发", ["fà"]]]),
        jieba: jieba({ 发: 5000 }),
      });
      assertUndefined(mass.get("发"));
    });

    it("takes the phrase corpus's reading over CC-CEDICT's", () => {
      // The merge's own precedence. Counting both would let a word vote twice,
      // and vote for a reading the dictionary does not give it.
      const mass = count({
        phrase: new Map([["头发", ["tóu", "fà"]]]),
        cedict: [cedict("头发", "頭髮", ["tou2", "fa1"])],
        jieba: jieba({ 头发: 40 }),
      });
      const cast = mass.get("发");
      assertIdentical(cast?.get("f|a|4"), 40);
      assertUndefined(cast.get("f|a|1"));
    });

    it("counts a word only CC-CEDICT has", () => {
      const mass = count({
        cedict: [cedict("发送", "發送", ["fa1", "song4"])],
        jieba: jieba({ 发送: 300 }),
      });
      assertIdentical(mass.get("发")?.get("f|a|1"), 300);
    });

    it("lets a word with several CC-CEDICT senses vote once", () => {
      const mass = count({
        cedict: [
          cedict("发送", "發送", ["fa1", "song4"]),
          cedict("发送", "發送", ["fa4", "song4"]),
        ],
        jieba: jieba({ 发送: 300 }),
      });
      const cast = mass.get("发");
      assertIdentical(cast?.get("f|a|1"), 300);
      assertUndefined(cast.get("f|a|4"));
    });

    it("ignores a word jieba's corpus never saw", () => {
      const mass = count({
        phrase: new Map([["发送", ["fā", "sòng"]]]),
        jieba: jieba({}),
      });
      assertUndefined(mass.get("发"));
    });

    it("ignores a word whose reading does not align", () => {
      const mass = count({
        phrase: new Map([["发送", ["fā"]]]),
        jieba: jieba({ 发送: 300 }),
      });
      assertUndefined(mass.get("发"));
    });

    it("casts the same vote for the 繁體 form the reading picks", () => {
      // jieba's corpus is 简体, so 髮 appears in none of the words counted and
      // would rank on nothing at all without this.
      const mass = count({
        phrase: new Map([
          ["发送", ["fā", "sòng"]],
          ["头发", ["tóu", "fà"]],
        ]),
        cedict: [
          cedict("发送", "發送", ["fa1", "song4"]),
          cedict("头发", "頭髮", ["tou2", "fa4"]),
        ],
        jieba: jieba({ 发送: 300, 头发: 40 }),
      });
      assertIdentical(mass.get("髮")?.get("f|a|4"), 40);
      assertIdentical(mass.get("發")?.get("f|a|1"), 300);
      assertUndefined(mass.get("髮")?.get("f|a|1"));
    });

    it("casts one vote where the two scripts write the same character", () => {
      const mass = count({
        phrase: new Map([["发送", ["fā", "sòng"]]]),
        cedict: [cedict("发送", "發送", ["fa1", "song4"])],
        jieba: jieba({ 发送: 300 }),
      });
      assertIdentical(mass.get("送")?.get("s|ong|4"), 300);
    });

    it("reads a 儿化 syllable as the first of its two characters", () => {
      // 玩儿 is one syllable, wánr. It attests 玩 as `wán` and says nothing at
      // all about what 儿 took.
      const mass = count({
        cedict: [cedict("玩儿", "玩兒", ["wan2", "r5"])],
        jieba: jieba({ 玩儿: 90 }),
      });
      assertIdentical(mass.get("玩")?.get("|uan|2"), 90);
      assertUndefined(mass.get("儿"));
    });

    it("casts no vote for a character written but unread", () => {
      // CC-CEDICT records the comma of a two-clause proverb as a reading of its
      // own, accounting for the character and contributing no syllable.
      const mass = count({
        cedict: [cedict("头，发", "頭，髮", ["tou2", ",", "fa4"])],
        jieba: jieba({ "头，发": 7 }),
      });
      assertIdentical(mass.get("头")?.get("t|ou|2"), 7);
      assertUndefined(mass.get("，"));
    });
  });

  describe("ranking", () => {
    const READINGS = [syllable("fā"), syllable("fà")];

    /** A character `kHanyuPinlu` says nothing about. */
    const UNRANKED = new Map([["kMandarin" as const, ["fā"]]]);

    it("puts the reading carrying the most corpus first", () => {
      const mass = new Map([["发", new Map([["f|a|4", 40]])]]);
      assertIdentical(
        rankByCorpusMass("发", READINGS, UNRANKED, mass)[0]?.tone,
        4,
      );
    });

    it("leaves a character the corpus never saw in Unihan's order", () => {
      assertIdentical(
        rankByCorpusMass("发", READINGS, UNRANKED, new Map())[0]?.tone,
        1,
      );
    });

    it("keeps Unihan's order where the corpus cannot separate two readings", () => {
      // The sort is stable, so equal mass — including no mass at all — leaves
      // the order the fields ranked.
      const mass = new Map([
        [
          "发",
          new Map([
            ["f|a|1", 40],
            ["f|a|4", 40],
          ]),
        ],
      ]);
      assertIdentical(
        rankByCorpusMass("发", READINGS, UNRANKED, mass)[0]?.tone,
        1,
      );
    });

    it("sinks a reading no word attests below one some word does", () => {
      const mass = new Map([["发", new Map([["f|a|4", 1]])]]);
      const ranked = rankByCorpusMass("发", READINGS, UNRANKED, mass);
      assertIdentical(ranked[0]?.tone, 4);
      assertIdentical(ranked[1]?.tone, 1);
    });

    it("stands aside where kHanyuPinlu already ranked the readings", () => {
      // That field counts occurrences rather than words, so it has seen the
      // bare-character uses this mass is blind to.
      const mass = new Map([["发", new Map([["f|a|4", 40]])]]);
      const ranked = new Map([["kHanyuPinlu" as const, ["fā", "fà"]]]);
      assertIdentical(
        rankByCorpusMass("发", READINGS, ranked, mass)[0]?.tone,
        1,
      );
    });

    describe("轻声", () => {
      it("keeps a 轻声 above a full tone the words carry more of", () => {
        // Every 吧 a word can vote for is 酒吧, 网吧 or 吧台, so the corpus
        // holds all of the noun and only the scraps of the particle. The
        // reading it cannot see is the one the bare character usually has.
        const readings = [neutral("ba"), syllable("bā")];
        const mass = new Map([
          [
            "吧",
            new Map([
              ["b|a|1", 1027],
              ["b|a|5", 225],
            ]),
          ],
        ]);
        const ranked = rankByCorpusMass("吧", readings, named("ba"), mass);
        assertIdentical(order(ranked), "ba bā");
      });

      it("keeps a 轻声 above a full tone no word attests at all", () => {
        // 呗 is 梵呗 `bài` in the dictionary and a sentence-final `bei`
        // everywhere else, so the 轻声 carries no mass whatsoever.
        const readings = [neutral("bei"), syllable("bài")];
        const mass = new Map([["呗", new Map([["b|ai|4", 8]])]]);
        const ranked = rankByCorpusMass("呗", readings, named("bei"), mass);
        assertIdentical(order(ranked), "bei bài");
      });

      it("still promotes a 轻声 the words do attest", () => {
        // Only a 轻声 the fields lead with is held. 蔔 takes 萝卜's `bo` over
        // the `bó` they rank first, which is a reading words do vote for.
        const readings = [syllable("bó"), neutral("bo")];
        const mass = new Map([["蔔", new Map([["b|o|5", 30]])]]);
        const ranked = rankByCorpusMass("蔔", readings, named("bó"), mass);
        assertIdentical(order(ranked), "bo bó");
      });

      it("ranks freely where the fields lead with a full tone", () => {
        // 哩 is `lī` in kMandarin and a 轻声 only further down, so the corpus
        // decides between them: 哩程 and 平方哩 carry `lǐ`.
        const readings = [syllable("lī"), neutral("li"), syllable("lǐ")];
        const mass = new Map([
          [
            "哩",
            new Map([
              ["l|i|1", 9],
              ["l|i|5", 26],
              ["l|i|3", 106],
            ]),
          ],
        ]);
        const ranked = rankByCorpusMass("哩", readings, named("lī"), mass);
        assertIdentical(order(ranked), "lǐ li lī");
      });

      it("holds a second 轻声 behind the one that leads", () => {
        // 么 keeps `me` whatever happens, and what sits behind it are the
        // lattice's fallback edges: `ma` is 轻声 too and no more visible to the
        // words than `me` is, so it does not sink below 幺's `yāo` either.
        const readings = [neutral("me"), neutral("ma"), syllable("yāo")];
        const mass = new Map([
          [
            "么",
            new Map([
              ["m|e|5", 158_167],
              ["|iao|1", 30],
            ]),
          ],
        ]);
        const ranked = rankByCorpusMass("么", readings, named("me"), mass);
        assertIdentical(order(ranked), "me ma yāo");
      });
    });
  });
});
