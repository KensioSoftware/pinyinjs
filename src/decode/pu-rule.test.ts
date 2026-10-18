import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { LOCATIVE_SHANG_PU, SPREADING_PU } from "./pu-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== LOCATIVE_SHANG_PU);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

describe("上铺 where 铺 is the verb", () => {
  it("splits 上铺 before 着 or 满", () => {
    // Given a 铺 spreading something over a place
    // When the run is decoded
    // Then the 上 ends the place and 铺 is a word of its own
    assertArrayEquals(wordsOf("地板上铺着地毯").slice(0, 3), [
      "地板",
      "上",
      "铺",
    ]);
    // And without the rule, they were the bunk
    assertArrayEquals(wordsOf("地板上铺着地毯", false).slice(0, 2), [
      "地板",
      "上铺",
    ]);
    assertArrayEquals(
      wordsOf("桌子上鋪滿了書").filter((word) => word === "上鋪"),
      [],
    );
  });

  it("splits 上铺 before 了 after a noun of place", () => {
    assertArrayEquals(
      wordsOf("她在她的床上铺了床单").filter((word) => word === "上铺"),
      [],
    );
  });

  it("keeps the bunk", () => {
    // Given 上铺 the bunk
    // When each run is decoded
    // Then 上铺 stays one word
    for (const run of ["我在宿舍的床位是上铺", "我睡上铺", "他睡上铺了"]) {
      assertArrayEquals(
        wordsOf(run).filter((word) => word === "上铺"),
        ["上铺"],
      );
    }
  });
});

/** How the 铺 of a run reads, with every rule or with every rule but this. */
function readingOfPu(run: string, withRule = true): string {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== SPREADING_PU);
  const syllables = decodeRun(dictionary, run, rules).flatMap((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)),
  );
  const at = toCharacters(run).findIndex((c) => c === "铺" || c === "鋪");
  return syllables[at] ?? "";
}

describe("铺 before an aspect particle", () => {
  it("reads the verb before 着 or 过", () => {
    // Given 铺 spreading something, with an aspect particle after it
    // When each run is decoded
    // Then 铺 reads pū
    const runs = [
      "地板上铺着地毯",
      "桌子上铺着桌布",
      "他在床上铺着被子",
      "地上鋪著地毯",
      "这条路铺过沥青",
      "我鋪過床",
    ];
    assertArrayEquals(
      runs.map((run) => readingOfPu(run)),
      runs.map(() => "pū"),
    );
    // And without the rule the word 铺着 read the shop
    assertArrayEquals(
      ["地板上铺着地毯", "地上鋪著地毯"].map((run) => readingOfPu(run, false)),
      ["pù", "pù"],
    );
  });

  it("keeps the shop and the bed where the particle follows the word", () => {
    // Given 店铺 and 床铺, nouns, before a 着 or a 过
    // When each run is decoded
    // Then 铺 keeps pù
    const runs = ["这家店铺着火了", "我在店铺过夜", "床铺着火了"];
    assertArrayEquals(
      runs.map((run) => readingOfPu(run)),
      runs.map(() => "pù"),
    );
  });
});
