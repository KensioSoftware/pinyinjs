import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";
import { HOUSEHOLD_RENJIA } from "./renjia-rule.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const full = await loadDictionary(fileSource(dataDirectory), "full");
const standard = await loadDictionary(fileSource(dataDirectory), "standard");

/** How a run reads, syllable by syllable. */
function syllablesOf(
  run: string,
  withRule = true,
  dictionary = full,
): string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== HOUSEHOLD_RENJIA);
  return decodeRun(dictionary, run, rules).flatMap((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)),
  );
}

/** The reading of the 家 of the first 人家 in a run. */
function jiaOf(run: string, withRule = true, dictionary = full): string {
  return (
    syllablesOf(run, withRule, dictionary)[
      toCharacters(run).join("").indexOf("人家") + 1
    ] ?? ""
  );
}

/** The words a run decodes to. */
function wordsOf(run: string): string[] {
  return decodeRun(full, run, READING_RULES).map((word) => word.text);
}

describe("人家 as somebody else", () => {
  it("reads the reviewer's sentence with chòng and a neutral 家", () => {
    // Given the sentence Chinese Boost's reviewer flagged
    // When it is decoded
    // Then 冲着 is chòngzhe and 人家 is rénjia
    assertArrayEquals(syllablesOf("他便冲着人家大喊"), [
      "tā",
      "biàn",
      "chòng",
      "zhe",
      "rén",
      "jia",
      "dà",
      "hǎn",
    ]);
  });

  it("reads the pronoun 人家 with a neutral 家 in both tiers", () => {
    for (const run of [
      "别把人家当傻瓜",
      "人家不要啦",
      "你为什么要骂人家",
      "人家叫我汤姆",
    ]) {
      assertArrayEquals([jiaOf(run)], ["jia"]);
      assertArrayEquals([jiaOf(run, true, standard)], ["jia"]);
    }
  });
});

describe("人家 as a household", () => {
  it("reads jiā after 户", () => {
    // Given 人家 counted by 户
    // When each run is decoded
    // Then it is a household, jiā
    for (const run of ["这户人家很穷", "村里有二十户人家", "该地的一户人家"]) {
      assertArrayEquals([jiaOf(run)], ["jiā"]);
    }
    // And without the rule it was the pronoun
    assertArrayEquals([jiaOf("这户人家很穷", false)], ["jia"]);
  });

  it("reads jiā after how many or how well off, and after 的", () => {
    for (const run of [
      "他是有錢人家的兒子",
      "他出生在穷人家",
      "她嫁到了普通人家",
      "村里很多人家都想把女儿嫁过来",
      "有的人家办酒宴场面很大",
      "家境殷实的人家",
    ]) {
      assertArrayEquals([jiaOf(run)], ["jiā"]);
    }
  });

  it("keeps the 人 with the 家 rather than with 有钱 or 穷", () => {
    assertArrayEquals(wordsOf("他是有錢人家的兒子").slice(2, 5), [
      "有錢",
      "人",
      "家",
    ]);
  });

  it("leaves the longer words to their own reading", () => {
    assertArrayEquals(wordsOf("他是大户人家的孩子").slice(2, 3), ["大户人家"]);
    assertArrayEquals([jiaOf("他是大户人家的孩子")], ["jiā"]);
  });
});
