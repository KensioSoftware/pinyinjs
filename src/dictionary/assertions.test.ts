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
  entry("银行", "yín háng", { hant: "銀行" }),
  entry("行长", "háng zhǎng", { hant: "行長" }),
  entry("头发", "tóu fa", { hant: "頭髮" }),
  entry("还是", "hái shi", { hant: "還是" }),
  entry("北京", "běi jīng", { isProperNoun: true, partOfSpeech: "ns" }),
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
  });

  it("describes every assertion, so a failure names what regressed", () => {
    assertArrayNotEmpty(BUILD_ASSERTIONS);
    for (const assertion of BUILD_ASSERTIONS) {
      assertArrayMinLength(assertion.description.split(" "), 3);
    }
  });
});
