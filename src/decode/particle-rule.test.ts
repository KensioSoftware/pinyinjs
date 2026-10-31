import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { ADVERBIAL_DI, ASPECTUAL_PARTICLE } from "./particle-rule.js";
import { READING_RULES } from "./reading-rules.js";
import type { EdgeRule } from "./rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/**
 * How the first of some characters reads in a run, with every rule or with
 * every rule but one.
 */
function readingOf(
  run: string,
  characters: string,
  without?: EdgeRule,
): string {
  const rules = READING_RULES.filter((rule) => rule !== without);
  // A syllable per character, so that the 儿 of 一点儿, folded into the
  // syllable before it, still counts as a position.
  const syllables = decodeRun(dictionary, run, rules).flatMap((word) => {
    const written = word.reading.map((syllable) => writeSyllable(syllable));
    const folded = toCharacters(word.text).length - written.length;
    return [...written, ...Array.from({ length: folded }, () => "")];
  });
  const at = toCharacters(run).findIndex((character) =>
    characters.includes(character),
  );
  return syllables[at] ?? "";
}

describe("着 and 了 after a verb", () => {
  it("reads the aspect particle where an untagged key starts there", () => {
    // Given 拿着花, 逆着风 and 追著風, held as untagged keys 着花, 着风 and 著風
    const runs = ["她手里拿着花", "逆着风骑车", "我覺得這就像是追著風跑"];
    // When each is decoded
    // Then the 着 is the particle
    assertArrayEquals(
      runs.map((run) => readingOf(run, "着著")),
      ["zhe", "zhe", "zhe"],
    );
    // And without the rule the key read it zháo
    assertArrayEquals(
      [readingOf("她手里拿着花", "着著", ASPECTUAL_PARTICLE)],
      ["zháo"],
    );
  });

  it("reads 了 as le before a debt or a bill", () => {
    // Given 了债 and 了賬, which are untagged keys reading liǎo
    const runs = ["终于还清了债", "湯姆拿出錢包付了賬"];
    // When each is decoded
    // Then the 了 is the aspect particle
    assertArrayEquals(
      runs.map((run) => readingOf(run, "了")),
      ["le", "le"],
    );
    // And without the rule 了债 took it
    assertArrayEquals(
      [readingOf("终于还清了债", "了", ASPECTUAL_PARTICLE)],
      ["liǎo"],
    );
  });

  it("keeps zháo where the word ends at the 着", () => {
    // Given 猜着 and 睡着, which are words ending at the 着
    // When each is decoded
    // Then the 着 keeps zháo
    assertArrayEquals(
      [readingOf("我猜着了", "着"), readingOf("他睡着了", "着")],
      ["zháo", "zháo"],
    );
  });

  it("keeps a tagged word starting at the particle", () => {
    // Given 着急 after an adverb and 了解 after a verb
    // When each is decoded
    // Then each keeps its own reading
    assertArrayEquals(
      [readingOf("他很着急", "着"), readingOf("我想了解", "了")],
      ["zháo", "liǎo"],
    );
  });
});

describe("地 after an adjective or an adverb", () => {
  it("reads the adverbial particle where an untagged key starts there", () => {
    // Given 惆怅地望 and 悠哉地坐, where 地望 and 地坐 are untagged keys
    const runs = ["她惆怅地望着窗外", "正悠哉地坐在長椅上"];
    // When each is decoded
    // Then the 地 is de
    assertArrayEquals(
      runs.map((run) => readingOf(run, "地")),
      ["de", "de"],
    );
    // And without the rule 地望 took it
    assertArrayEquals(
      [readingOf("她惆怅地望着窗外", "地", ADVERBIAL_DI)],
      ["dì"],
    );
  });

  it("reads the particle after a reduplication, tagged key or not", () => {
    // Given 一点儿一点儿地学, 慢慢地学 and 斷斷續續地下, where 地学 and 地下
    // are tagged words
    const runs = [
      "跟着丈夫一点儿一点儿地学",
      "他慢慢地学",
      "雨斷斷續續地下了一整天",
    ];
    // When each is decoded
    // Then the 地 is de
    assertArrayEquals(
      runs.map((run) => readingOf(run, "地")),
      ["de", "de", "de"],
    );
    // And without the rule 地学 took it
    assertArrayEquals(
      [readingOf("跟着丈夫一点儿一点儿地学", "地", ADVERBIAL_DI)],
      ["dì"],
    );
  });

  it("keeps the ground after repeated characters that are no adverb", () => {
    // Given a frequency adverb before 地震, a verb before 地道 and a 学学 that
    // ends 大学
    const runs = ["这里常常地震", "想嚐嚐地道的四川菜", "我哥哥在大学学地质"];
    // When each is decoded
    // Then the 地 keeps dì
    assertArrayEquals(
      runs.map((run) => readingOf(run, "地")),
      ["dì", "dì", "dì"],
    );
  });

  it("keeps the ground after a verb", () => {
    // Given 发射到地球轨道, where 地球轨道 is an untagged key after a verb
    // When it is decoded
    // Then the 地 keeps dì
    assertArrayEquals([readingOf("发射到地球轨道", "地")], ["dì"]);
  });
});
