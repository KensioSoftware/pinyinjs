import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";
import { RESULTATIVE_ZHAO } from "./zhao-rule.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const core = await loadDictionary(fileSource(dataDirectory), "core");
const standard = await loadDictionary(fileSource(dataDirectory), "standard");

type Tier = typeof standard;

/** The syllables a run reads as, with every rule or with every rule but this. */
function read(dictionary: Tier, run: string, withRule = true): string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== RESULTATIVE_ZHAO);
  return decodeRun(dictionary, run, rules).flatMap((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)),
  );
}

describe("着 as the result of a potential complement", () => {
  it("reads 着 zháo after a verb and 不", () => {
    // Given a tier with no word 不着
    // When 睡不着 is decoded
    // Then 着 reads zháo
    assertArrayEquals(read(standard, "他着急得睡不着").slice(-3), [
      "shuì",
      "bù",
      "zháo",
    ]);
    // And without the rule it was the aspect particle
    assertArrayEquals(read(standard, "他着急得睡不着", false).slice(-1), [
      "zhe",
    ]);
    assertArrayEquals(read(core, "我找不著提姆").slice(1, 4), [
      "zhǎo",
      "bù",
      "zháo",
    ]);
  });

  it("reads 着 zháo after a verb and 得", () => {
    // Given 得 between the verb and 着
    // When the run is decoded
    // Then 着 reads zháo
    assertArrayEquals(read(standard, "用得着"), ["yòng", "de", "zháo"]);
    assertArrayEquals(read(standard, "这谁管得着").slice(-1), ["zháo"]);
  });

  it("takes the verbs jieba tags as something else", () => {
    // Given 用, 够 and 轮, which jieba does not tag as verbs
    // When each is followed by 不着
    // Then 着 still reads zháo
    for (const run of ["你用不着来", "我够不着", "轮不着你"]) {
      assertArrayEquals(
        read(standard, run).filter((syllable) => syllable.startsWith("zh")),
        ["zháo"],
      );
    }
  });

  it("leaves a 着 that belongs to a longer word", () => {
    // Given 着急 and the idiom 不着边际
    // When each follows 不 and a verb
    // Then neither moves
    assertArrayEquals(read(standard, "我不着急"), ["wǒ", "bù", "zháo", "jí"]);
    assertArrayEquals(read(standard, "说话不着边际").slice(2, 4), [
      "bù",
      "zhuó",
    ]);
  });

  it("leaves the aspect 着 after a verb ending in 得", () => {
    // Given 取得, a word whose 得 is not a complement marker
    // When 着 follows it, in a tier with words and in one without
    // Then 着 stays the aspect particle
    assertArrayEquals(read(standard, "取得着成功").slice(0, 3), [
      "qǔ",
      "dé",
      "zhe",
    ]);
    assertArrayEquals(read(core, "取得着成功").slice(2, 3), ["zhe"]);
  });

  it("leaves a 着 with no verb before the 不", () => {
    // Given a noun in front of 不着
    // When it is decoded
    // Then the rule has no verb to attach the result to
    assertArrayEquals(
      read(standard, "书不着").slice(-1),
      read(standard, "书不着", false).slice(-1),
    );
  });
});
