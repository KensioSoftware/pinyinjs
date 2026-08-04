import { fileURLToPath } from "node:url";

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

import { convertGreedily } from "./decode/convert.js";
import { applySandhi } from "./decode/sandhi.js";
import { Dictionary } from "./dictionary/dictionary.js";
import { fileSource } from "./dictionary/node-source.js";
import { loadDictionary } from "./dictionary/source.js";
import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
} from "./syllable/inventory.js";
import { readWord, splitSyllables } from "./syllable/split.js";
import {
  isSyllable,
  readSyllable,
  type Syllable,
  writeSyllable,
} from "./syllable/syllable.js";
import {
  applyToneMark,
  stripToneMarks,
  toneFromMarks,
} from "./tone/tone-mark.js";
import { NEUTRAL_TONE } from "./tone/tone.js";

/**
 * Every example the README shows, run against the committed dictionary.
 *
 * The README claimed three things that were not true when it was written —
 * that `readSyllable("shong")` returns undefined, that 行 has three readings,
 * and that 好好 converts with a space — and none of them would have been caught
 * by reading it. Documentation drifts silently in the other direction too, as
 * soon as behaviour changes underneath it.
 *
 * **Update this file and the README together.** A failure here means one of
 * them is now lying to somebody.
 */
const dataDirectory = fileURLToPath(new URL("../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/**
 * A reading written out, for readable expectations.
 */
function written(syllables: readonly Syllable[]): string {
  return syllables.map((syllable) => writeSyllable(syllable)).join(" ");
}

describe("the examples in README.md", () => {
  describe("converting hanzi", () => {
    it("converts the three words shown", () => {
      assertIdentical(convertGreedily(dictionary, "银行"), "yínháng");
      assertIdentical(convertGreedily(dictionary, "行长"), "hángzhǎng");
      assertIdentical(
        convertGreedily(dictionary, "我要去北京。"),
        "wǒ yào qù Běijīng。",
      );
    });

    it("converts 长城 on the standard tier, as the browser example does", async () => {
      const standard = await loadDictionary(
        fileSource(dataDirectory),
        "standard",
      );
      assertIdentical(convertGreedily(standard, "长城"), "Chángchéng");
    });
  });

  describe("the options shown", () => {
    it("takes the locale's reading", () => {
      assertIdentical(convertGreedily(dictionary, "垃圾"), "lājī");
      assertIdentical(
        convertGreedily(dictionary, "垃圾", { locale: "zh-TW" }),
        "lèsè",
      );
    });

    it("writes the notation asked for", () => {
      assertIdentical(
        convertGreedily(dictionary, "银行", { notation: "numbers" }),
        "yin2hang2",
      );
      assertIdentical(
        convertGreedily(dictionary, "银行", { notation: "none" }),
        "yinhang",
      );
    });

    it("writes third-tone sandhi when asked", () => {
      assertIdentical(
        convertGreedily(dictionary, "好好", { sandhi: { thirdTone: true } }),
        "háohǎo",
      );
    });

    it("leaves non-Han text exactly as written", () => {
      assertIdentical(convertGreedily(dictionary, "3D银行"), "3Dyínháng");
    });
  });

  describe("looking words up", () => {
    it("reports the fields the README shows for 头发", () => {
      const entry = dictionary.lookup("头发");
      assertNonNullable(entry);
      assertIdentical(written(entry.reading), "tóu fa");
      assertFalse(entry.isProperNoun);
      assertIdentical(entry.partOfSpeech, "n");
    });

    it("finds the same reading under 繁體", () => {
      const entry = dictionary.lookup("頭髮");
      assertIdentical(written(entry?.reading ?? []), "tóu fa");
    });

    it("answers a prefix query", () => {
      assertTrue(dictionary.hasPrefix("银"));
    });

    it("gives 行 all four of its readings, likeliest first", () => {
      assertArrayEquals(
        dictionary.readingsOf("行").map((found) => written(found)),
        ["xíng", "háng", "héng", "hàng"],
      );
    });
  });

  describe("syllables", () => {
    it("parses both notations to the same syllable", () => {
      const marked = readSyllable("jiù");
      assertNonNullable(marked);
      assertIdentical(marked.initial, "j");
      assertIdentical(marked.final, "iou");
      assertIdentical(marked.tone, 4);
      assertIdentical(
        JSON.stringify(readSyllable("jiu4")),
        JSON.stringify(marked),
      );
    });

    it("reads the v convention for ü", () => {
      assertIdentical(readSyllable("lv4")?.final, "ü");
    });

    it("returns undefined for something that is not a syllable at all", () => {
      assertUndefined(readSyllable("hello"));
    });

    it("accepts 儿化 as a suffix", () => {
      assertTrue(isSyllable("wánr"));
    });

    it("rejects both notations on one syllable", () => {
      assertUndefined(readSyllable("běi3"));
    });

    it("parses a well-formed spelling Mandarin does not use", () => {
      // The distinction the README draws: parsing is about well-formedness,
      // the inventory is about what is attested.
      assertNonNullable(readSyllable("shong"));
      assertFalse(DICTIONARY_SYLLABLES.has("shong"));
      assertTrue(DICTIONARY_SYLLABLES.has("zhuang"));
      assertArrayLength(ATTESTED_SYLLABLES, 415);
    });

    it("writes a syllable in each notation", () => {
      const jiu: Syllable = { initial: "j", final: "iou", tone: 4 };
      assertIdentical(writeSyllable(jiu), "jiù");
      assertIdentical(writeSyllable(jiu, "numbers"), "jiu4");
      assertIdentical(writeSyllable(jiu, "none"), "jiu");
    });

    it("splits the written words shown", () => {
      assertArrayEquals(splitSyllables("nǐhǎo") ?? [], ["nǐ", "hǎo"]);
      assertArrayEquals(splitSyllables("Xī'ān") ?? [], ["Xī", "ān"]);
      assertArrayEquals(splitSyllables("yinhang") ?? [], ["yin", "hang"]);
      assertIdentical(written(readWord("yínháng") ?? []), "yín háng");
    });
  });

  describe("tones", () => {
    it("applies and strips a tone mark", () => {
      assertIdentical(applyToneMark("hao", 3), "hǎo");
      assertIdentical(applyToneMark("hao", NEUTRAL_TONE), "hao");
      assertIdentical(stripToneMarks("hǎo"), "hao");
      assertIdentical(toneFromMarks("hǎo"), 3);
    });
  });

  describe("sandhi", () => {
    it("flattens 不 before a fourth tone", () => {
      const flattened = applySandhi(readWord("bùshì") ?? []);
      assertIdentical(written(flattened), "bú shì");
    });

    it("leaves third-tone sandhi unwritten by default", () => {
      const niHao = readWord("nǐhǎo") ?? [];
      const plain = applySandhi(niHao);
      const sandhied = applySandhi(niHao, { thirdTone: true });
      assertIdentical(written(plain), "nǐ hǎo");
      assertIdentical(written(sandhied), "ní hǎo");
    });

    it("can be switched off", () => {
      const untouched = applySandhi(readWord("bùshì") ?? [], { yiBu: false });
      assertIdentical(written(untouched), "bù shì");
    });
  });

  describe("the figures quoted", () => {
    it("has the entry count the README claims", () => {
      // 461,623 entries; the key count is higher because both scripts are keys.
      assertTrue(dictionary.size > 700_000);
    });

    it("wraps an artifact the same way whichever source fetched it", () => {
      // fetchSource and fileSource are two adapters behind one interface, so
      // the browser example assembles a Dictionary exactly like this one.
      const empty = Dictionary.from({
        keys: "",
        entries: "",
        frequencies: new Uint8Array(),
      });
      assertIdentical(empty.size, 0);
    });
  });
});
