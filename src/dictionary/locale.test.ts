import { entry, reading } from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayMinLength,
  assertIdentical,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import {
  composeLocaleDeltas,
  LOCALE_COMPOSITION_EXCLUSIONS,
} from "./locale.js";

/**
 * An entry carrying a zh-TW delta of its own, as a source would have marked it.
 */
function marked(
  hans: string,
  cn: string,
  tw: string,
  extra: Partial<DictionaryEntry> = {},
): DictionaryEntry {
  return entry(hans, cn, {
    readings: { cn: reading(cn), tw: reading(tw) },
    ...extra,
  });
}

/**
 * The zh-TW reading composed for a word, written out, or undefined.
 */
function taiwan(
  entries: readonly DictionaryEntry[],
  word: string,
): string | undefined {
  const composed = composeLocaleDeltas(entries).entries.find(
    (found) => found.hans === word,
  );
  return composed?.readings.tw
    ?.map((syllable) => writeSyllable(syllable))
    .join(" ");
}

/**
 * The 垃圾 case this whole pass exists for, plus what it has to leave alone.
 */
const ENTRIES: readonly DictionaryEntry[] = [
  entry("垃", "lā"),
  entry("圾", "jī"),
  entry("分", "fēn"),
  entry("类", "lèi"),
  entry("太", "tài"),
  entry("空", "kōng"),
  marked("垃圾", "lā jī", "lè sè", { frequency: 1165 }),
  entry("分类", "fēn lèi", { frequency: 900 }),
  entry("垃圾分类", "lā jī fēn lèi", { frequency: 42 }),
  entry("太空", "tài kōng", { frequency: 700 }),
  entry("太空垃圾", "tài kōng lā jī", { frequency: 5 }),
];

describe("composing a zh-TW delta from a compound's constituents", () => {
  it("gives 垃圾分类 the 垃圾 reading its own entry never carried", () => {
    assertIdentical(taiwan(ENTRIES, "垃圾分类"), "lè sè fēn lèi");
  });

  it("composes wherever the constituent falls, not only at the front", () => {
    assertIdentical(taiwan(ENTRIES, "太空垃圾"), "tài kōng lè sè");
  });

  it("leaves the zh-CN reading untouched", () => {
    const composed = composeLocaleDeltas(ENTRIES).entries.find(
      (found) => found.hans === "垃圾分类",
    );
    assertNonNullable(composed);
    assertArrayEquals(
      composed.readings.cn.map((syllable) => writeSyllable(syllable)),
      ["lā", "jī", "fēn", "lèi"],
    );
  });

  it("counts what it composed", () => {
    assertIdentical(composeLocaleDeltas(ENTRIES).composed, 2);
  });

  it("never overwrites a delta a source stated", () => {
    // 垃圾桶 is marked `lè sè tǒng` outright; the pass must not recompute it.
    const entries = [
      ...ENTRIES,
      entry("桶", "tǒng"),
      marked("垃圾桶", "lā jī tǒng", "lè sè tǒng", { frequency: 300 }),
    ];
    assertIdentical(taiwan(entries, "垃圾桶"), "lè sè tǒng");
  });

  it("leaves a compound whose constituents carry no delta alone", () => {
    assertUndefined(taiwan(ENTRIES, "太空"));
  });

  describe("what it refuses to compose", () => {
    it("refuses a constituent the segmentation does not actually cut out", () => {
      // 运行状况 contains 行状, which is marked, but cuts as 运行 + 状况. The
      // real dictionary carries exactly this case.
      const entries = [
        entry("运", "yùn"),
        entry("行", "xíng"),
        entry("状", "zhuàng"),
        entry("况", "kuàng"),
        entry("运行", "yùn xíng", { frequency: 2000 }),
        entry("状况", "zhuàng kuàng", { frequency: 2000 }),
        marked("行状", "xíng zhuàng", "xìng zhuàng", { frequency: 3 }),
        entry("运行状况", "yùn xíng zhuàng kuàng", { frequency: 10 }),
      ];
      assertUndefined(taiwan(entries, "运行状况"));
    });

    it("refuses a constituent the compound reads differently", () => {
      // The compound says these characters are `jiě shù` and the marked entry
      // says the word is `xiè shù`, so they are not the same word.
      const entries = [
        entry("浑", "hún"),
        entry("身", "shēn"),
        entry("解", "jiě"),
        entry("数", "shù"),
        entry("浑身", "hún shēn", { frequency: 500 }),
        marked("解数", "xiè shù", "jiě shù", { frequency: 50 }),
        entry("浑身解数", "hún shēn jiě shù", { frequency: 20 }),
      ];
      assertUndefined(taiwan(entries, "浑身解数"));
    });

    it("refuses a single character's delta, which is a sense and not a locale", () => {
      // 地 is `dì` as a noun and `de` as the adverbial particle. Propagating the
      // character would rewrite 一个个地 as `yī gè gè dì`.
      const entries = [
        entry("一", "yī"),
        entry("个", "gè"),
        marked("地", "de", "dì"),
        entry("一个个", "yī gè gè", { frequency: 40 }),
        entry("一个个地", "yī gè gè de", { frequency: 10 }),
      ];
      assertUndefined(taiwan(entries, "一个个地"));
    });

    it("still composes from a word when a character beside it is marked", () => {
      // 从容地 takes 从容's reading and leaves the particle 地 as `de`.
      const entries = [
        entry("从", "cóng"),
        entry("容", "róng"),
        marked("地", "de", "dì"),
        marked("从容", "cóng róng", "cōng róng", { frequency: 800 }),
        entry("从容地", "cóng róng de", { frequency: 30 }),
      ];
      assertIdentical(taiwan(entries, "从容地"), "cōng róng de");
    });

    it("refuses a word whose reading does not line up with its characters", () => {
      // 儿化 folds two characters into one syllable, so no character span can
      // be cut out of the reading and replaced.
      const entries = [
        entry("没", "méi"),
        entry("法", "fǎ"),
        entry("儿", "ér"),
        marked("法儿", "fǎr", "fár", { frequency: 20 }),
        entry("没法儿", "méi fǎr", { frequency: 10 }),
      ];
      assertUndefined(taiwan(entries, "没法儿"));
    });

    it("refuses a compound no run of known words covers", () => {
      // 囧 is in no entry, so nothing spans it and the compound cannot be cut
      // into words at all — the common case, since most compounds contain a
      // character no shorter word claims.
      const entries = [
        entry("垃", "lā"),
        entry("圾", "jī"),
        marked("垃圾", "lā jī", "lè sè", { frequency: 1165 }),
        entry("垃圾囧", "lā jī jiǒng", { frequency: 1 }),
      ];
      assertUndefined(taiwan(entries, "垃圾囧"));
    });

    it("refuses an excluded compound", () => {
      const entries = [
        entry("相", "xiāng"),
        entry("亲", "qīn"),
        entry("爱", "ài"),
        marked("相亲", "xiāng qīn", "xiàng qīn", { frequency: 200 }),
        entry("相爱", "xiāng ài", { frequency: 200 }),
        entry("相亲相爱", "xiāng qīn xiāng ài", { frequency: 50 }),
      ];
      assertUndefined(taiwan(entries, "相亲相爱"));
    });
  });

  it("feeds its own output back in, so a compound of a compound inherits", () => {
    // 中看不中用 is 中看 + 不中用, and 不中用 has no delta until this pass gives
    // it one. Only then can the phrase containing it inherit.
    const entries = [
      entry("不", "bù"),
      entry("中", "zhōng"),
      entry("看", "kàn"),
      entry("用", "yòng"),
      marked("中看", "zhōng kàn", "zhòng kàn", { frequency: 100 }),
      marked("中用", "zhōng yòng", "zhòng yòng", { frequency: 100 }),
      entry("不中用", "bù zhōng yòng", { frequency: 50 }),
      entry("中看不中用", "zhōng kàn bù zhōng yòng", { frequency: 10 }),
    ];
    assertIdentical(taiwan(entries, "不中用"), "bù zhòng yòng");
    assertIdentical(taiwan(entries, "中看不中用"), "zhòng kàn bù zhòng yòng");
  });

  it("composes under either script, since both are keys", () => {
    const entries = [
      entry("垃", "lā"),
      entry("圾", "jī"),
      entry("分", "fēn"),
      entry("類", "lèi"),
      marked("垃圾", "lā jī", "lè sè", { frequency: 1165 }),
      entry("分類", "fēn lèi", { frequency: 900 }),
      entry("垃圾分類", "lā jī fēn lèi", { frequency: 42 }),
    ];
    assertIdentical(taiwan(entries, "垃圾分類"), "lè sè fēn lèi");
  });

  it("composes nothing from an empty dictionary", () => {
    assertIdentical(composeLocaleDeltas([]).composed, 0);
  });

  describe("the exclusion table", () => {
    it("gives every exclusion a reason, so it can be reviewed", () => {
      for (const exclusion of LOCALE_COMPOSITION_EXCLUSIONS) {
        assertArrayMinLength(exclusion.reason.split(" "), 6);
      }
    });

    it("stays small, or the alignment check has stopped carrying its weight", () => {
      assertTrue(
        LOCALE_COMPOSITION_EXCLUSIONS.length <= 10,
        "the exclusion table must stay small",
      );
    });
  });
});
