import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { REGIONAL_DIFANG, TUNNEL_DIDAO } from "./difang-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const full = await loadDictionary(fileSource(dataDirectory), "full");
const standard = await loadDictionary(fileSource(dataDirectory), "standard");

/**
 * How the character after the first 地 of a run reads, in both tiers, with
 * every rule or with every rule but the two here.
 */
function readingsAfterDi(run: string, withRules = true): string[] {
  const rules = withRules
    ? READING_RULES
    : READING_RULES.filter(
        (rule) => rule !== REGIONAL_DIFANG && rule !== TUNNEL_DIDAO,
      );
  const at = toCharacters(run).indexOf("地");
  return [standard, full].map((dictionary) => {
    const syllables = decodeRun(dictionary, run, rules).flatMap((word) =>
      word.reading.map((syllable) => writeSyllable(syllable)),
    );
    return `${syllables[at] ?? ""} ${syllables[at + 1] ?? ""}`;
  });
}

describe("地方 and 地道 in context", () => {
  it("reads 地方 the place and 地道 the real thing with a neutral tone", () => {
    // Given 地方 and 地道 in their everyday senses
    const runs = ["这个地方很好", "他们去过很多地方", "这是地道的川菜"];

    // When each is decoded
    // Then the second syllable has no tone
    assertArrayEquals(
      runs.flatMap((run) => readingsAfterDi(run)),
      ["dì fang", "dì fang", "dì fang", "dì fang", "dì dao", "dì dao"],
    );
  });

  it("reads 地方 as the regions before government and beside the centre", () => {
    // Given 地方 before a word for local government, its press or its accent,
    // and set against 中央 or the army
    const runs = [
      "地方政府",
      "州及地方官員",
      "他说话有地方口音",
      "中央和地方",
      "地方与中央的关系",
      "在部队和地方参与文教",
      "民族自治地方",
    ];

    // When each is decoded
    // Then 地方 is dì fāng, with 地 kept from the particle de
    assertArrayEquals(
      runs.flatMap((run) => readingsAfterDi(run)),
      runs.flatMap(() => ["dì fāng", "dì fāng"]),
    );
    // And without the rule 政府 made no difference
    assertArrayEquals(readingsAfterDi("地方政府", false), [
      "dì fang",
      "dì fang",
    ]);
  });

  it("reads 地道 as a tunnel where it is dug, entered or counted", () => {
    // Given 地道 after a verb of digging or entering, a measure word, or
    // before 里 standing alone or the locative 里面
    const runs = [
      "挖地道",
      "他们钻进地道里",
      "他们进入地道",
      "一条地道",
      "地道里很黑",
      "他躲在地道里面",
    ];

    // When each is decoded
    // Then 地道 is dì dào
    assertArrayEquals(
      runs.flatMap((run) => readingsAfterDi(run)),
      runs.flatMap(() => ["dì dào", "dì dào"]),
    );
  });

  it("keeps the real thing where nothing names a tunnel", () => {
    // Given 地道 before 口味 and 口音, which are words of their own, after the
    // 进 of 引进, and closing a clause, where the real thing is far commoner
    // than the tunnel and 发现了地道 is left to it
    const runs = [
      "地道口味",
      "一口地道口音",
      "引进地道的川菜",
      "这个菜很地道",
      "敌军发现了地道",
    ];

    // When each is decoded
    // Then 地道 keeps its neutral tone
    assertArrayEquals(
      runs.flatMap((run) => readingsAfterDi(run)),
      runs.flatMap(() => ["dì dao", "dì dao"]),
    );
  });
});
