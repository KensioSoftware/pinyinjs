import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { writeGwoyeu } from "../transcription/gwoyeu-spelling.js";
import { convert, convertPieces } from "./convert.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const core = await loadDictionary(fileSource(dataDirectory), "core");
const standard = await loadDictionary(fileSource(dataDirectory), "standard");
const full = await loadDictionary(fileSource(dataDirectory), "full");

/** Each text converted in the standard and the full tier, side by side. */
function inBothTiers(texts: readonly string[]): string[] {
  return texts.flatMap((text) => [
    convert(standard, text),
    convert(full, text),
  ]);
}

/** Each expected reading twice, once for each tier. */
function twice(readings: readonly string[]): string[] {
  return readings.flatMap((reading) => [reading, reading]);
}

describe("toneless 不", () => {
  it("reads the 不 of a word grown out of a potential complement as bu", () => {
    // Given words the dictionary holds whose 不 is between a verb and its
    // result, and two that are lexicalised beyond one
    const texts = ["对不起", "差不多了。", "他真了不起。", "来不及", "忍不住"];

    // When each is converted
    // Then the 不 has no tone, in both tiers
    assertArrayEquals(
      inBothTiers(texts),
      twice([
        "duìbuqǐ",
        "Chàbuduō le.",
        "Tā zhēn liǎobuqǐ.",
        "láibují",
        "rěnbuzhù",
      ]),
    );
  });

  it("reads the 不 between a verb and its result across words as bu", () => {
    // Given potential complements the decode reads as separate words
    const texts = [
      "他着急得睡不着。",
      "吃不了",
      "他说不出来",
      "我做不到",
      "他走不动了",
    ];

    // When each is converted
    // Then the 不 has no tone, in both tiers
    assertArrayEquals(
      inBothTiers(texts),
      twice([
        "Tā zháojí de shuì bu zháo.",
        "chī bu liǎo",
        "tā shuō bu chūlái",
        "wǒ zuò budào",
        "tā zǒu bu dòngle",
      ]),
    );
  });

  it("keeps the tone of 不 as negation, sandhi and all", () => {
    // Given 不 negating a word, an A-not-A question, a clause after a verb
    // that takes one, a 成语, 不到 before a count and a 不 closing a question
    const texts = [
      "不对",
      "不是",
      "是不是",
      "对不对",
      "我想不去",
      "我决定不去了",
      "迫不及待",
      "出国不到一个月",
      "我们有不到五分钟",
      "只不过",
      "很不错",
      "你去不？",
    ];

    // When each is converted
    // Then 不 keeps bù, or bú before a fourth tone
    assertArrayEquals(
      inBothTiers(texts),
      twice([
        "bú duì",
        "bú shì",
        "shìbúshì",
        "duì bú duì",
        "wǒ xiǎng bú qù",
        "wǒ juédìng bú qùle",
        "pòbùjídài",
        "chūguó búdào yí gè yuè",
        "wǒmen yǒu búdào wǔ fēnzhōng",
        "zhǐbúguò",
        "hěn búcuò",
        "Nǐ qù bù?",
      ]),
    );
  });

  it("takes only the results a rule has read in the core tier", () => {
    // Given the core tier, which holds no words, so that 固定不动 and 走不动
    // look alike
    const texts = ["我睡不着。", "行星围着固定不动的恒星转。"];

    // When each is converted
    // Then only the 不 before a 着 read zháo loses its tone
    assertArrayEquals(
      texts.map((text) => convert(core, text)),
      [
        "Wǒ shuì bu zháo.",
        "Xíng xīng wéizhe gù dìng bú dòng de Héng xīng zhuàn.",
      ],
    );
  });

  it("keeps the tone in 國語 and where 一 and 不 sandhi is off", () => {
    // Given the 臺灣 standard, which writes 對不起 duìbùqǐ, and a caller that
    // turned 一 and 不 sandhi off
    // When each is converted
    // Then 不 is bù
    assertArrayEquals(
      [
        convert(full, "對不起", { locale: "zh-TW" }),
        convert(full, "睡不著", { locale: "zh-TW" }),
        convert(full, "对不起", { sandhi: { yiBu: false } }),
      ],
      ["duìbùqǐ", "shuì bù zháo", "duìbùqǐ"],
    );
  });

  it("keeps the tone a toneless 不 had, for Gwoyeu Romatzyh to spell", () => {
    // Given a 不 that loses its fourth tone in 对不起
    // When it is converted and written in Gwoyeu Romatzyh
    const written = convertPieces(full, "对不起").flatMap((piece) =>
      piece.syllable === undefined ? [] : [writeGwoyeu(piece.syllable)],
    );

    // Then the dot comes before the fourth-tone spelling `buh`
    assertArrayEquals(written, ["duey", ".buh", "chii"]);
  });
});
