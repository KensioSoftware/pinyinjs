import {
  assertArrayLength,
  assertArrayMinLength,
  assertArrayNotEmpty,
  assertIdentical,
  assertNonNullable,
  assertSetSize,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { BUILD_ASSERTIONS, BuiltDictionary, checkBuild } from "./assertions.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * Read a reading the way a source dictionary is read, unmarked meaning neutral.
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
 * An entry, with the fields the assertions look at.
 */
function entry(
  hans: string,
  cn: string,
  extra: Partial<DictionaryEntry> = {},
): DictionaryEntry {
  return {
    hans,
    hant: hans,
    readings: { cn: reading(cn) },
    frequency: 0,
    partOfSpeech: "",
    isProperNoun: false,
    ...extra,
  };
}

/**
 * A dictionary satisfying every build assertion.
 */
const SOUND: readonly DictionaryEntry[] = [
  entry("玩儿", "wánr", { hant: "玩兒" }),
  entry("女儿", "nǚ ér", { hant: "女兒" }),
  entry("这儿", "zhèr", { hant: "這兒" }),
  entry("儿子", "ér zi", { hant: "兒子" }),
  entry("一丁不识", "yī dīng bù shí", { hant: "一丁不識" }),
  entry("一不小心", "yī bù xiǎo xīn"),
  entry("大夫", "dài fu"),
  // Every word on the 轻声 sense list, since the assertion covering that table
  // asks after all of them.
  entry("东西", "dōng xi", { hant: "東西" }),
  entry("告诉", "gào su", { hant: "告訴" }),
  entry("故事", "gù shi"),
  entry("妻子", "qī zi"),
  entry("说法", "shuō fa", { hant: "說法" }),
  entry("小子", "xiǎo zi"),
  entry("买卖", "mǎi mai", { hant: "買賣" }),
  entry("生意", "shēng yi"),
  entry("本事", "běn shi"),
  entry("大爷", "dà ye", { hant: "大爺" }),
  entry("大方", "dà fang"),
  entry("口音", "kǒu yin"),
  entry("结实", "jiē shi", { hant: "結實" }),
  entry("把手", "bǎ shou"),
  entry("金子", "jīn zi"),
  entry("出息", "chū xi"),
  entry("管子", "guǎn zi"),
  entry("支吾", "zhī wu"),
  entry("西", "xī"),
  entry("子", "zǐ"),
  entry("夫", "fū"),
  entry("吗", "ma", { hant: "嗎" }),
  entry("得", "de"),
  entry("东西方", "dōng xī fāng", { hant: "東西方" }),
  entry("银行", "yín háng", { hant: "銀行" }),
  entry("行长", "háng zhǎng", { hant: "行長" }),
  entry("头发", "tóu fa", { hant: "頭髮" }),
  entry("还是", "hái shi", { hant: "還是" }),
  entry("重复", "chóng fù", { hant: "重複", hantVariants: ["重覆"] }),
  entry("下面", "xià miàn", { hantVariants: ["下麵"] }),
  // The keys step 9 holds to the words inside them, and the one it must not.
  entry("做什么", "zuò shén me", { hant: "做什麼" }),
  entry("什么意思", "shén me yì si", { hant: "什麼意思" }),
  entry("分子结构", "fēn zǐ jié gòu", { hant: "分子結構" }),
  entry("特征", "tè zhēng", { hant: "特徵" }),
  entry("沉溺", "chén nì", { hant: "沈溺" }),
  entry("虱子", "shī zi", { hant: "蝨子" }),
  entry("北京", "běi jīng", { isProperNoun: true, partOfSpeech: "ns" }),
  entry("齐白石", "qí bái shí", {
    hant: "齊白石",
    isProperNoun: true,
    partOfSpeech: "nr",
  }),
  entry("国务院", "guó wù yuàn", {
    hant: "國務院",
    isProperNoun: true,
    partOfSpeech: "nt",
  }),
  entry("湖北", "hú běi", { isProperNoun: true, partOfSpeech: "ns" }),
  entry("沙发", "shā fā", { hant: "沙發", partOfSpeech: "nz" }),
  entry("城市", "chéng shì", { partOfSpeech: "ns" }),
  entry("阿姨", "ā yí", { partOfSpeech: "nr" }),
  entry("长大", "zhǎng dà", { hant: "長大", partOfSpeech: "ns" }),
  entry("李", "lǐ"),
  entry("们", "men"),
  entry("吧", "ba", { partOfSpeech: "y", alternates: [reading("bā")] }),
  entry("酒吧", "jiǔ bā"),
  entry("垃圾分类", "lā jī fēn lèi", {
    hant: "垃圾分類",
    readings: {
      cn: reading("lā jī fēn lèi"),
      tw: reading("lè sè fēn lèi"),
    },
  }),
];

describe("build assertions", () => {
  describe("BuiltDictionary", () => {
    it("finds an entry by its 简体 form", () => {
      assertNonNullable(new BuiltDictionary(SOUND).get("头发"));
    });

    it("finds an entry by its 繁體 form too", () => {
      assertNonNullable(new BuiltDictionary(SOUND).get("頭髮"));
    });

    it("writes a reading back as tone-marked pinyin", () => {
      assertIdentical(new BuiltDictionary(SOUND).reading("头发"), "tóu fa");
    });

    it("reports nothing for a word it does not hold", () => {
      assertUndefined(new BuiltDictionary(SOUND).reading("没有"));
    });

    it("finds an entry by a second 繁體 spelling as well", () => {
      assertNonNullable(new BuiltDictionary(SOUND).get("重覆"));
    });

    it("keeps an entry's own key when a 繁體 alias would collide", () => {
      const contested = [entry("发", "fā", { hant: "發" }), entry("發", "fā")];
      assertIdentical(new BuiltDictionary(contested).reading("發"), "fā");
    });

    it("collects the toneless syllables every reading uses", () => {
      const inventory = new BuiltDictionary([
        entry("银行", "yín háng"),
        entry("行", "xíng", { alternates: [reading("háng")] }),
        entry("垃圾", "lā jī", {
          readings: { cn: reading("lā jī"), tw: reading("lè sè") },
        }),
      ]).syllableInventory();
      // yin, hang, xing, la, ji, le, se — 儿化 and tone are stripped, and the
      // zh-TW reading and the polyphone priors count too.
      assertSetSize(inventory, 7);
      assertTrue(inventory.has("yin"));
      assertTrue(inventory.has("se"));
    });

    it("counts 儿化 as its base syllable", () => {
      const inventory = new BuiltDictionary([
        entry("玩儿", "wánr"),
      ]).syllableInventory();
      assertSetSize(inventory, 1);
      assertTrue(inventory.has("wan"));
    });

    it("names the readings written in a tone the inventory does not list", () => {
      // 咯 lo is only ever neutral, so a source that started reading it as ló
      // would put a syllable the romanisation readers refuse into the data.
      const unattested = new BuiltDictionary([
        entry("咯", "ló"),
        entry("罗", "luó"),
      ]).unattestedTones();
      assertSetSize(unattested, 1);
      assertTrue(unattested.has("ló"));
    });
  });

  describe("checkBuild", () => {
    it("passes a dictionary that repairs everything it should", () => {
      assertArrayLength(checkBuild(SOUND), 0);
    });

    it("reports a missing word rather than passing it over", () => {
      const failures = checkBuild(SOUND.filter((held) => held.hans !== "大夫"));
      assertArrayNotEmpty(failures);
      assertTrue(
        failures.some((failure) => failure.includes("大夫 is missing")),
      );
    });

    it("catches an unrepaired 儿化", () => {
      // 玩儿 arriving as two syllables means the r5 repair stopped working.
      const failures = checkBuild(
        SOUND.map((held) =>
          held.hans === "玩儿" ? entry("玩儿", "wán ér") : held,
        ),
      );
      assertTrue(failures.some((failure) => failure.includes("玩儿 reads")));
    });

    it("catches sandhi baked back into the data", () => {
      const failures = checkBuild(
        SOUND.map((held) =>
          held.hans === "一丁不识" ? entry("一丁不识", "yì dīng bù shí") : held,
        ),
      );
      assertTrue(failures.some((failure) => failure.includes("一丁不识")));
    });

    it("catches a lost proper noun tag", () => {
      const failures = checkBuild(
        SOUND.map((held) =>
          held.hans === "北京"
            ? entry("北京", "běi jīng", { isProperNoun: false })
            : held,
        ),
      );
      assertTrue(
        failures.some((failure) => failure.includes("not marked as a proper")),
      );
    });

    it("says so when the word whose 繁體 form is checked is missing", () => {
      const failures = checkBuild(SOUND.filter((held) => held.hans !== "头发"));
      assertTrue(
        failures.some((failure) => failure.includes("头发 derived nothing")),
      );
    });

    it("catches a 繁體 form derived from the wrong variant", () => {
      const failures = checkBuild(
        SOUND.map((held) =>
          held.hans === "头发"
            ? entry("头发", "tóu fa", { hant: "頭發" })
            : held,
        ),
      );
      assertTrue(failures.some((failure) => failure.includes("expected 頭髮")));
    });

    it("catches a syllable that is not in the inventory", () => {
      // The class of defect this is really for: a source refresh smuggling in
      // a token that is not a syllable at all.
      // shong is well-formed enough for the syllable parser to accept, and is
      // not a Mandarin syllable — which is exactly the shape of the phrase
      // corpus's `地藏xxx` defect.
      const failures = checkBuild([...SOUND, entry("怪", "shōng")]);
      assertTrue(
        failures.some((failure) => failure.includes("outside the inventory")),
      );
    });

    it("catches more syllables than the word has characters", () => {
      const failures = checkBuild([...SOUND, entry("山", "shān shān")]);
      assertTrue(
        failures.some((failure) =>
          failure.includes("syllables for 1 characters"),
        ),
      );
    });

    it("allows a reading shorter than the word, which punctuation causes", () => {
      assertArrayLength(checkBuild([...SOUND, entry("好，好", "hǎo hǎo")]), 0);
    });

    it("catches a 语气词 reading the full tone its words carry", () => {
      // The whole class: a particle ranked on the words it appears inside
      // rather than on the bare character it almost always is.
      const failures = checkBuild([
        ...SOUND,
        entry("呗", "bài", { partOfSpeech: "y", alternates: [reading("bei")] }),
      ]);
      assertTrue(failures.some((failure) => failure.includes("呗 bài")));
    });

    it("leaves a 语气词 whose full tone is what the sources rank", () => {
      // 呵 is `ā(392)` over `hē(64)` in kHanyuPinlu, which counted the bare
      // character. Only the words are barred from deciding, not the sources.
      const failures = checkBuild([
        ...SOUND,
        entry("呵", "ā", { partOfSpeech: "y", alternates: [reading("a")] }),
      ]);
      assertArrayLength(failures, 0);
    });

    it("leaves a 语气词 with no 轻声 reading to rank", () => {
      assertArrayLength(
        checkBuild([...SOUND, entry("哉", "zāi", { partOfSpeech: "y" })]),
        0,
      );
    });
  });

  it("describes every assertion, so a failure names what regressed", () => {
    assertArrayNotEmpty(BUILD_ASSERTIONS);
    for (const assertion of BUILD_ASSERTIONS) {
      assertArrayMinLength(assertion.description.split(" "), 3);
    }
  });
});
