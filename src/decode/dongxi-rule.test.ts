import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { COMPASS_DONGXI } from "./dongxi-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** How the 西 of a run reads, with every rule or with every rule but this. */
function readingOfXi(run: string, withRule = true): string {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== COMPASS_DONGXI);
  const syllables = decodeRun(dictionary, run, rules).flatMap((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)),
  );
  return syllables[toCharacters(run).indexOf("西")] ?? "";
}

describe("东西 as east and west", () => {
  it("reads the directions before 走向, 方向, a side or 向的", () => {
    // Given 东西 in front of what orients it
    // When each run is decoded
    // Then 西 reads xī
    const runs = [
      "这条路是东西走向的",
      "大致为东西方向延伸",
      "太和殿東西兩側的中右门",
      "金刚墙东西两端有雁翅墙",
      "东西向的街道",
      "这条街是东西向",
    ];
    assertArrayEquals(
      runs.map((run) => readingOfXi(run)),
      runs.map(() => "xī"),
    );
    // And without the rule 东西 was the thing
    assertArrayEquals([readingOfXi("这条路是东西走向的", false)], ["xi"]);
  });

  it("keeps the thing where nothing orients it", () => {
    // Given 东西 before a price, a 向 with an object, and nothing at all
    // When each run is decoded
    // Then 西 keeps the neutral tone
    const runs = ["这东西两块钱", "这东西两", "把东西向他扔过去", "我去买东西"];
    assertArrayEquals(
      runs.map((run) => readingOfXi(run)),
      runs.map(() => "xi"),
    );
  });
});
