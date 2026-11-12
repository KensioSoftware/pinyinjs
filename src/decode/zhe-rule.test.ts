import { fileURLToPath } from "node:url";

import { assertArrayEquals, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";
import { DURATIVE_ZHE } from "./zhe-rule.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes to, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== DURATIVE_ZHE);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

/** The reading a run decodes to, a word to a space. */
function readingOf(run: string): string {
  return decodeRun(dictionary, run)
    .map((word) => word.reading.map((syllable) => writeSyllable(syllable)))
    .map((syllables) => syllables.join(""))
    .join(" ");
}

describe("a verb and its durative 着", () => {
  it("cuts the verb from 着", () => {
    // Given 看着, 想着 and 穿着 with the verb's object after them
    // When each run is decoded
    // Then the verb and 着 are words of their own
    assertArrayEquals(wordsOf("它看着我"), ["它", "看", "着", "我"]);
    assertArrayEquals(wordsOf("她只想着回家的事").slice(0, 4), [
      "她",
      "只",
      "想",
      "着",
    ]);
    assertArrayEquals(wordsOf("他穿着新衣服去上班").slice(0, 3), [
      "他",
      "穿",
      "着",
    ]);
    assertArrayEquals(wordsOf("他穿著新衣服").slice(0, 3), ["他", "穿", "著"]);
    // And without the rule, each pair was one word
    assertArrayEquals(wordsOf("它看着我", false), ["它", "看着", "我"]);
  });

  it("reads the particle neutral", () => {
    // Given a cut 看着
    // When the run is read
    // Then 着 is zhe
    assertIdentical(readingOf("它看着我"), "tā kàn zhe wǒ");
    assertIdentical(readingOf("他穿着红衣服"), "tā chuān zhe hóng yīfu");
  });

  it("keeps the pairs that mean more than the verb", () => {
    // Given verbs with 着 that CC-CEDICT gives a sense of their own
    // When each run is decoded
    // Then the pair stays one word
    for (const [run, word] of [
      ["他还活着", "活着"],
      ["我们有着共同的目标", "有着"],
      ["他跟着我走", "跟着"],
      ["学校挨着公园", "挨着"],
      ["她背着我说话", "背着"],
    ] as const) {
      assertArrayEquals(
        wordsOf(run).filter((found) => found === word),
        [word],
      );
    }
  });

  it("keeps 着 that is not the particle", () => {
    // Given 睡着 read zháo
    // When the run is decoded
    // Then it stays one word
    assertArrayEquals(wordsOf("他睡着了"), ["他", "睡着", "了"]);
  });

  it("keeps 穿着 where it is the noun", () => {
    // Given 穿着 meaning attire, after 的 or 以 or before a locative 上
    // When each run is decoded
    // Then it stays one word
    for (const run of [
      "她的穿着很时髦",
      "不要以穿着来判断",
      "他穿着上很不讲究",
    ]) {
      assertArrayEquals(
        wordsOf(run).filter((word) => word === "穿着"),
        ["穿着"],
      );
    }
    // And 穿着上衣 is the verb with 上衣 after it
    assertArrayEquals(wordsOf("他穿着上衣"), ["他", "穿", "着", "上衣"]);
  });

  it("lets a word ending at the verb take it", () => {
    // Given 照看着, where 照看 is a word
    // When the run is decoded
    // Then 照看 and 着 are the words
    assertArrayEquals(wordsOf("照看着孩子"), ["照看", "着", "孩子"]);
  });

  it("leaves a 着 that a longer word claims", () => {
    // Given 看着手机, where 着手 starts at the 着
    // When the run is decoded
    // Then 看着 stays, rather than handing 着 to 着手
    assertArrayEquals(wordsOf("看着手机"), ["看着", "手机"]);
    // And 注意地看著, where the untagged 注意地看 ends at the 看
    assertArrayEquals(wordsOf("注意地看著他"), wordsOf("注意地看著他", false));
  });
});
