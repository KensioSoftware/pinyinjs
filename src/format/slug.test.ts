import {
  dictionaryOf,
  entry,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertIdentical,
  assertSetSize,
  assertStringLength,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  DEFAULT_HASH_LENGTH,
  hashOf,
  LONGEST_HASH,
  slug,
  type SlugOptions,
} from "./slug.js";

const dictionary = sampleDictionary();

/**
 * Slug a text with the shared test dictionary.
 */
function slugged(text: string, options?: SlugOptions): string {
  return slug(dictionary, text, options);
}

/**
 * A dictionary of one word, for the readings the shared fixture has no use for.
 */
function wordOf(hanzi: string, reading: string): (text: string) => string {
  const held = dictionaryOf([entry(hanzi, reading)]);
  return (text) => slug(held, text);
}

describe("slugging a text", () => {
  it("reads a word rather than its characters one at a time", () => {
    // The case a slugifier working on a finished string cannot get right: 行
    // alone is xíng, and only the word around it makes it háng.
    assertIdentical(slugged("银行"), "yin2hang2");
  });

  it("puts the separator between words and not between syllables", () => {
    assertIdentical(slugged("北京市银行"), "bei3jing1-shi4-yin2hang2");
  });

  it("writes the tones as numbers by default", () => {
    assertIdentical(slugged("北京"), "bei3jing1");
  });

  it("leaves the tones off where they are not wanted", () => {
    assertIdentical(slugged("银行", { tones: "none" }), "yinhang");
  });

  it("keeps a neutral tone as the fifth", () => {
    assertIdentical(wordOf("头发", "tóu fa")("头发"), "tou2fa5");
  });

  it("writes 儿化 as the r it is", () => {
    assertIdentical(slugged("玩儿"), "wanr2");
  });
});

describe("the syllable boundary in a slug", () => {
  it("breaks where a toneless slug would otherwise read as another word", () => {
    // xi'an is 西安; xian is 先, or 县, or 咸. The 隔音符号 is the only thing
    // keeping them apart once the tones have gone.
    assertIdentical(slugged("西安", { tones: "none" }), "xi-an");
    assertIdentical(slugged("海鸥", { tones: "none" }), "hai-ou");
  });

  it("needs no break where a tone number already ends the syllable", () => {
    assertIdentical(slugged("西安"), "xi1an1");
  });

  it("cuts every syllable apart where asked", () => {
    assertIdentical(slugged("北京", { syllables: "separate" }), "bei3-jing1");
    assertIdentical(
      slugged("北京", { syllables: "separate", tones: "none" }),
      "bei-jing",
    );
  });
});

describe("the alphabet a slug is written in", () => {
  it("writes ü as v, keeping 绿 apart from 路", () => {
    assertIdentical(wordOf("绿", "lǜ")("绿"), "lv4");
  });

  it("writes ü as u where a caller prefers the collision", () => {
    const held = dictionaryOf([entry("绿", "lǜ")]);
    assertIdentical(slug(held, "绿", { umlaut: "u" }), "lu4");
  });

  it("keeps the Latin in a text, folded to the letters a URL carries", () => {
    assertIdentical(slugged("iPhone 15 银行"), "iphone-15-yin2hang2");
    assertIdentical(slugged("café 银行", { tones: "none" }), "cafe-yinhang");
  });

  it("turns punctuation of either script into a boundary", () => {
    assertIdentical(slugged("《银行》，银行！"), "yin2hang2-yin2hang2");
  });

  it("collapses the boundaries and takes them off both ends", () => {
    assertIdentical(slugged("  银行   ——  银行  "), "yin2hang2-yin2hang2");
  });

  it("writes nothing but its own letters, digits and separator", () => {
    assertTrue(/^[a-z0-9-]*$/u.test(slugged("《我的 iPhone 15》，北京市！")));
  });
});

describe("the digits in a slug", () => {
  it("keeps them, because that is how anyone looks the text up", () => {
    assertIdentical(slugged("3个银行"), "3-ge4-yin2hang2");
  });

  it("says them where a caller wants the text spoken", () => {
    assertIdentical(
      slugged("3个银行", { numbers: "read" }),
      "san1-ge4-yin2hang2",
    );
  });
});

describe("the separator", () => {
  it("is written as given, whatever it is", () => {
    assertIdentical(
      slugged("北京市银行", { separator: "_" }),
      "bei3jing1_shi4_yin2hang2",
    );
    assertIdentical(
      slugged("北京市银行", { separator: "" }),
      "bei3jing1shi4yin2hang2",
    );
  });

  it("takes the syllable boundary with it", () => {
    // A search key wants 西安 to match what someone types, which is xian.
    assertIdentical(slugged("西安", { separator: "", tones: "none" }), "xian");
  });
});

describe("a text that slugs to nothing", () => {
  it("comes back empty by default", () => {
    assertIdentical(slugged(""), "");
    assertIdentical(slugged("！《》"), "");
  });

  it("comes back as the fallback where one was given", () => {
    assertIdentical(slugged("！《》", { fallback: "untitled" }), "untitled");
  });

  it("does not use the fallback where a hash was written", () => {
    assertIdentical(
      slugged("！《》", { fallback: "untitled", hash: true }),
      hashOf("！《》", DEFAULT_HASH_LENGTH),
    );
  });
});

describe("the locale and the sandhi a slug is read with", () => {
  it("reads a Taiwan reading where one is asked for", () => {
    assertIdentical(slugged("垃圾"), "la1ji1");
    assertIdentical(slugged("垃圾", { locale: "zh-TW" }), "le4se4");
  });

  it("writes 一 and 不 sandhi, as a conversion does", () => {
    assertIdentical(slugged("不是"), "bu2-shi4");
  });

  it("leaves it off where a caller wants the underlying tones", () => {
    assertIdentical(slugged("不是", { sandhi: { yiBu: false } }), "bu4-shi4");
  });
});

describe("the hash on the end of a slug", () => {
  it("is written in the slug's own alphabet", () => {
    assertTrue(
      /^yin2hang2-[a-z0-9]{4}$/u.test(slugged("银行", { hash: true })),
    );
  });

  it("is the same for the same text every time", () => {
    assertIdentical(
      slugged("银行", { hash: true }),
      slugged("银行", { hash: true }),
    );
  });

  it("tells apart two texts one slug ran together", () => {
    // 是 and 市 are both shi4, which is the whole reason to reach for a hash.
    assertIdentical(slugged("是"), slugged("市"));
    assertTrue(slugged("是", { hash: true }) !== slugged("市", { hash: true }));
  });

  it("is taken from the hanzi rather than from the pinyin", () => {
    assertIdentical(slugged("是", { hash: true }), `shi4-${hashOf("是", 4)}`);
  });

  it("hashes a text the same however it was normalised", () => {
    // The same word typed two ways: é as one character, and as e followed
    // by a combining acute. Nothing else here would tell them apart.
    assertIdentical(hashOf("café", 4), hashOf("café", 4));
  });

  it("does not fold 简体 and 繁體 together", () => {
    assertTrue(hashOf("头发", 4) !== hashOf("頭髮", 4));
  });

  it("writes the length asked for", () => {
    for (let length = 1; length <= LONGEST_HASH; length += 1) {
      assertStringLength(hashOf("银行", length), length);
    }
  });

  it("writes no more than there are bits to fill", () => {
    assertStringLength(hashOf("银行", 99), LONGEST_HASH);
    assertStringLength(hashOf("银行", 0), 1);
  });

  it("spreads two texts that differ by one character apart", () => {
    // FNV-1a leaves its lowest bits barely mixed, and those are the ones a
    // short hash is cut from, so a suffix without the finalizer would collide
    // across neighbours like these far more often than it should.
    const seen = new Set(
      ["银行", "银行1", "银行2", "银行3", "行银", "北京", "北京市"].map(
        (text) => hashOf(text, 2),
      ),
    );
    assertSetSize(seen, 7);
  });
});

describe("the length of a slug", () => {
  it("is cut at a word boundary rather than through a word", () => {
    assertIdentical(slugged("北京市银行", { maxLength: 14 }), "bei3jing1-shi4");
    assertIdentical(slugged("北京市银行", { maxLength: 13 }), "bei3jing1");
  });

  it("cuts a single over-long word where the limit falls", () => {
    assertIdentical(slugged("北京", { maxLength: 3 }), "bei");
  });

  it("counts the separator the caller chose", () => {
    const written = slugged("北京市银行", { maxLength: 20, separator: "__" });
    assertIdentical(written, "bei3jing1__shi4");
    assertTrue(written.length <= 20);
  });

  it("drops words rather than the hash", () => {
    const written = slugged("北京市银行", { maxLength: 16, hash: true });
    assertIdentical(written, `bei3jing1-${hashOf("北京市银行", 4)}`);
    assertTrue(written.length <= 16);
  });

  it("has nothing to cut where the text slugged to nothing", () => {
    assertIdentical(slugged("！《》", { maxLength: 8 }), "");
    assertIdentical(
      slugged("！《》", { maxLength: 8, fallback: "untitled" }),
      "untitled",
    );
  });

  it("keeps the hash even where no word fits beside it", () => {
    assertIdentical(
      slugged("北京市银行", { maxLength: 4, hash: true }),
      hashOf("北京市银行", 4),
    );
  });
});
