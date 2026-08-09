import {
  dictionaryOf,
  entry,
  SAMPLE_ENTRIES,
  sampleDictionary,
  sampleScriptTables,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { Dictionary } from "../dictionary/dictionary.js";
import type { DictionaryEntry } from "../dictionary/entry.js";
import { writeSyllableSpelling } from "../syllable/syllable.js";
import { candidates, homophonesOf } from "./candidates.js";
import { ReverseIndex } from "./reverse-index.js";

const dictionary = sampleDictionary();
const index = ReverseIndex.of(dictionary);
const tables = sampleScriptTables();

/**
 * An index over a dictionary written for one case.
 */
function indexOf(entries: readonly DictionaryEntry[]): ReverseIndex {
  return ReverseIndex.of(dictionaryOf(entries));
}

/**
 * A dictionary built by hand, so a line can say something the build never
 * writes.
 */
function handBuilt(key: string, reading: string): ReverseIndex {
  return ReverseIndex.of(
    Dictionary.from({
      keys: key,
      entries: reading,
      frequencies: new Uint8Array(1),
    }),
  );
}

/**
 * The ü fixture: 绿 and 路 share a folded key, and 绿色 is a whole word of it.
 */
const UMLAUT = indexOf([
  entry("绿", "lǜ"),
  entry("路", "lù"),
  entry("色", "sè"),
  entry("绿色", "lǜ sè", { hant: "綠色" }),
]);

/**
 * The ghost fixture, both kinds.
 *
 * 峯 folds to 峰 and reads the same, so 中峯 is a duplicate of a candidate
 * already in the list. 覈 folds to 核 and 校 is a polyphone, so 校覈 derives to
 * `xiào hé` while the 校核 that `Dictionary.lookup` folds it to reads `jiào hé`.
 */
const GHOSTS = indexOf([
  entry("中", "zhōng"),
  entry("峰", "fēng"),
  entry("峯", "fēng"),
  entry("中峰", "zhōng fēng", { frequency: 900 }),
  entry("中峯", "zhōng fēng"),
  entry("校", "xiào"),
  entry("核", "hé"),
  entry("覈", "hé"),
  entry("校核", "jiào hé"),
  entry("校覈", "xiào hé"),
]);

describe("answering a pinyin query with hanzi", () => {
  describe("what a query may leave out", () => {
    it("finds a word by its reading run together", () => {
      assertArrayEquals(candidates(index, "yinhang"), ["銀行", "银行"]);
    });

    it("takes the syllables written apart, or apostrophed, or hyphenated", () => {
      for (const query of ["yin hang", "yin'hang", "yin-hang"]) {
        assertArrayEquals(candidates(index, query), ["銀行", "银行"]);
      }
    });

    it("takes it in capitals", () => {
      assertArrayEquals(candidates(index, "YinHang"), ["銀行", "银行"]);
    });

    it("finds nothing for a reading nothing has", () => {
      assertArrayLength(candidates(index, "nanjing"), 0);
    });

    it("finds nothing for a query with no letters in it", () => {
      assertArrayLength(candidates(index, "  "), 0);
    });
  });

  describe("tones", () => {
    it("answers a toneless query with every tone", () => {
      assertTrue(candidates(index, "shi").includes("是"));
      assertTrue(candidates(index, "shi").includes("市"));
    });

    it("narrows on a tone written as a digit", () => {
      const found = indexOf([
        entry("是", "shì"),
        entry("十", "shí"),
        entry("使", "shǐ"),
      ]);
      assertArrayEquals(candidates(found, "shi4"), ["是"]);
      assertArrayEquals(candidates(found, "shi2"), ["十"]);
    });

    it("narrows on a tone written as a mark, which the matcher cannot", () => {
      // `match` drops a tone mark because a half-typed query does not say where
      // the syllable it sits inside ends. Here the candidate's own reading
      // says, so the mark has somewhere to land.
      const found = indexOf([entry("是", "shì"), entry("十", "shí")]);
      assertArrayEquals(candidates(found, "shì"), ["是"]);
    });

    it("takes a tone on one syllable and not the other", () => {
      assertArrayEquals(candidates(index, "yin2hang"), ["銀行", "银行"]);
      assertArrayLength(candidates(index, "yin3hang"), 0);
    });
  });

  describe("ü", () => {
    it("reaches ü from the u a keyboard has", () => {
      assertArrayEquals(candidates(UMLAUT, "lu"), ["绿", "路"]);
    });

    it("reaches it from v, and from the u: convention", () => {
      assertArrayEquals(candidates(UMLAUT, "lv"), ["绿"]);
      assertArrayEquals(candidates(UMLAUT, "lu:"), ["绿"]);
      assertArrayEquals(candidates(UMLAUT, "lü"), ["绿"]);
    });

    it("keeps a query that wrote ü off the words that do not have one", () => {
      assertFalse(candidates(UMLAUT, "lv").includes("路"));
    });

    it("reaches a whole word spelled with one", () => {
      assertArrayEquals(candidates(UMLAUT, "lvse"), ["綠色", "绿色"]);
      assertArrayEquals(candidates(UMLAUT, "luse"), ["綠色", "绿色"]);
    });
  });

  describe("儿化", () => {
    it("finds 玩儿 whether or not the r is typed", () => {
      assertArrayEquals(candidates(index, "wanr"), ["玩儿", "玩兒"]);
      assertTrue(candidates(index, "wan").includes("玩儿"));
    });

    it("still answers wan with the words that are only 玩", () => {
      assertTrue(candidates(index, "wan").includes("玩"));
    });

    it("does not let 儿 itself shed its r", () => {
      // 儿 is `er2`, not an 儿化 suffix, so `e` must not reach it even though
      // the search asks the `er` group as well as the `e` one.
      assertArrayLength(candidates(index, "e"), 0);
      assertTrue(candidates(index, "er").includes("儿"));
    });
  });

  describe("the keys the dictionary disowns", () => {
    it("leaves out a variant glyph form of a candidate already listed", () => {
      // 中峯 is a key, and `Dictionary.lookup` folds 峯 to 峰 before it searches,
      // so 中峯 can never be returned by it. Offering it here would put the same
      // word in the list twice.
      assertArrayEquals(candidates(GHOSTS, "zhongfeng"), ["中峰"]);
    });

    it("leaves out one that would be offered under the wrong reading", () => {
      // 校覈 derives to `xiào hé` from its own characters, where the 校核 it
      // folds to reads `jiào hé`. Checking a candidate against what the
      // dictionary says it reads is what drops it.
      assertArrayLength(candidates(GHOSTS, "xiaohe"), 0);
      assertArrayEquals(candidates(GHOSTS, "jiaohe"), ["校核"]);
    });
  });

  describe("ranking and limits", () => {
    it("puts the likeliest first", () => {
      const found = indexOf([
        entry("市", "shì", { frequency: 400 }),
        entry("是", "shì", { frequency: 900_000 }),
        entry("事", "shì", { frequency: 40_000 }),
      ]);
      assertArrayEquals(candidates(found, "shi"), ["是", "事", "市"]);
    });

    it("takes the likeliest few when a limit is given", () => {
      const found = indexOf([
        entry("市", "shì", { frequency: 400 }),
        entry("是", "shì", { frequency: 900_000 }),
        entry("事", "shì", { frequency: 40_000 }),
      ]);
      assertArrayEquals(candidates(found, "shi", { limit: 2 }), ["是", "事"]);
      assertArrayLength(candidates(found, "shi", { limit: 0 }), 0);
      assertArrayLength(candidates(found, "shi", { limit: -1 }), 0);
    });
  });

  describe("script", () => {
    it("offers both writings when no preference is given", () => {
      assertArrayEquals(candidates(index, "yinhang"), ["銀行", "银行"]);
    });

    it("keeps the 简体 writing when asked for it", () => {
      assertArrayEquals(
        candidates(index, "yinhang", { script: { prefer: "Hans", tables } }),
        ["银行"],
      );
    });

    it("keeps the 繁體 writing when asked for it", () => {
      assertArrayEquals(
        candidates(index, "yinhang", { script: { prefer: "Hant", tables } }),
        ["銀行"],
      );
    });

    it("leaves a word with only one writing alone either way", () => {
      for (const prefer of ["Hans", "Hant"] as const) {
        assertArrayEquals(
          candidates(index, "beijing", { script: { prefer, tables } }),
          ["北京"],
        );
      }
    });
  });

  describe("homophonesOf", () => {
    const HOMOPHONES = indexOf([
      entry("是", "shì", { frequency: 900_000 }),
      entry("事", "shì", { frequency: 40_000 }),
      entry("市", "shì", { frequency: 400 }),
      entry("十", "shí"),
      entry("使", "shǐ"),
    ]);

    it("gives the words read exactly the same, likeliest first", () => {
      assertArrayEquals(homophonesOf(HOMOPHONES, "是"), ["事", "市"]);
    });

    it("narrows to the tone, where a typed query would not", () => {
      assertFalse(homophonesOf(HOMOPHONES, "是").includes("十"));
      assertTrue(candidates(HOMOPHONES, "shi").includes("十"));
    });

    it("never lists the word itself", () => {
      assertFalse(homophonesOf(HOMOPHONES, "是").includes("是"));
    });

    it("gives nothing for a word the dictionary does not hold", () => {
      assertArrayLength(homophonesOf(HOMOPHONES, "没有"), 0);
    });

    it("finds the same list from either script's writing", () => {
      assertArrayEquals(
        homophonesOf(index, "银行", { script: { prefer: "Hans", tables } }),
        homophonesOf(index, "銀行", { script: { prefer: "Hans", tables } }),
      );
    });

    it("treats the other writing of the word as the word, not a homophone", () => {
      // 銀行 is not a homophone of 银行; it is the same word spelled for a
      // different reader. Saying so needs the tables, so without them it is
      // listed and with them it is not.
      assertArrayEquals(homophonesOf(index, "银行"), ["銀行"]);
      assertArrayLength(
        homophonesOf(index, "银行", { script: { prefer: "Hans", tables } }),
        0,
      );
    });

    it("takes a limit like a candidate list does", () => {
      assertArrayEquals(homophonesOf(HOMOPHONES, "是", { limit: 1 }), ["事"]);
    });

    it("leaves out a variant glyph form the dictionary disowns", () => {
      assertArrayLength(homophonesOf(GHOSTS, "中峰"), 0);
    });
  });

  describe("readings the shipped artifacts never hold", () => {
    it("lets a query write any tone where the reading wrote none", () => {
      // Every reading the artifacts store carries a tone digit, so this is a
      // case a hand-built dictionary reaches. A reading that wrote no tone
      // cannot contradict one, so none of these is refused.
      const untoned = handBuilt("西", "xi");
      for (const query of ["xi", "xi1", "xī"]) {
        assertArrayEquals(candidates(untoned, query), ["西"], query);
      }
    });

    it("answers nothing for a reading that is not pinyin at all", () => {
      const nonsense = handBuilt("囧", "zzz");
      assertArrayLength(candidates(nonsense, "zzz"), 0);
    });
  });

  it("answers over the whole sample dictionary without surprises", () => {
    // Every key in the dictionary should be reachable by the reading the
    // dictionary itself reports for it, which is the property the whole thing
    // rests on.
    for (const held of SAMPLE_ENTRIES) {
      const reading = dictionary.lookup(held.hans)?.reading ?? [];
      const query = reading
        .map((syllable) => writeSyllableSpelling(syllable))
        .join("");
      assertTrue(
        query === "" || candidates(index, query).includes(held.hans),
        `${held.hans} is not reachable by ${query}`,
      );
    }
  });
});
