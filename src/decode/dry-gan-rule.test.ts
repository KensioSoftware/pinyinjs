import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { DRY_GAN } from "./dry-gan-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const full = await loadDictionary(fileSource(dataDirectory), "full");
const standard = await loadDictionary(fileSource(dataDirectory), "standard");

/** The reading of every 干 in a run, with every rule or every rule but this. */
function ganOf(run: string, withRule = true, dictionary = full): string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== DRY_GAN);
  const readings: string[] = [];
  for (const word of decodeRun(dictionary, run, rules)) {
    toCharacters(word.text).forEach((character, at) => {
      const syllable = word.reading[at];
      if (character === "干" && syllable !== undefined) {
        readings.push(writeSyllable(syllable));
      }
    });
  }
  return readings;
}

describe("干 where it means dry", () => {
  it("reads 干 between two 又 as gān", () => {
    // Given 干 as the first of two qualities
    // When the run is decoded
    // Then it is gān
    assertArrayEquals(ganOf("西北的冬天又干又冷"), ["gān"]);
    // And without the rule it was the verb
    assertArrayEquals(ganOf("西北的冬天又干又冷", false), ["gàn"]);
    assertArrayEquals(ganOf("我的喉咙又干又红、又痛又痒"), ["gān"]);
    assertArrayEquals(ganOf("冬天又冷又干"), ["gān"]);
    assertArrayEquals(ganOf("喉咙又红、又干"), ["gān"]);
  });

  it("reads 干 after a degree word as gān", () => {
    for (const run of ["我喉咙很干", "夏天太干了", "房间太干", "嘴巴有点干"]) {
      assertArrayEquals(ganOf(run), ["gān"]);
    }
  });

  it("reads 干 after a drying verb as gān", () => {
    for (const run of [
      "把湿毛巾拧干再擦桌子",
      "她用力把湿衣服扭干",
      "衣服一直晾不干",
      "蒸锅里的水快烧干了",
    ]) {
      assertArrayEquals(ganOf(run), ["gān"]);
    }
  });

  it("reads 干 between a measure word and a noun as gān", () => {
    assertArrayEquals(ganOf("给我一条干毛巾"), ["gān"]);
  });

  it("reads 干 after a wet thing as gān", () => {
    for (const run of [
      "我的衬衫还没干",
      "我的袜子已经干了吗",
      "高温天气让很多河都干了",
      "混凝土干了以后才能踩",
      "衣服总干不了",
      "面部皮肤容易干",
      "大河没水小河干",
    ]) {
      assertArrayEquals(ganOf(run), ["gān"]);
    }
  });

  it("settles the standard tier the same way", () => {
    assertArrayEquals(ganOf("华北的冬天又干又冷", true, standard), ["gān"]);
    assertArrayEquals(ganOf("衣服难干", true, standard), ["gān"]);
  });

  it("keeps the verb", () => {
    // Given 干 as to do, in frames close to the dry ones
    // When each run is decoded
    // Then it stays gàn
    for (const run of [
      "我不干了",
      "他又干了一天",
      "你那么干会被人踢出酒吧的",
      "事没干完不要走",
      "别留着一半工作没干",
      "活快干完了",
      "你干得很好",
      "她一口干完了整杯",
      "认真地干",
    ]) {
      assertArrayEquals(ganOf(run), ["gàn"]);
    }
  });

  it("keeps a tagged word starting at the 干", () => {
    assertArrayEquals(ganOf("新经理看起来很干练"), ["gàn"]);
    assertArrayEquals(ganOf("一条干渠"), ["gàn"]);
  });

  it("leaves 干 meaning to concern to its own rule", () => {
    assertArrayEquals(ganOf("这不干你的事"), ["gān"]);
  });
});
