import { fileURLToPath } from "node:url";

import { assertIdentical, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import { convert } from "../decode/convert.js";
import {
  GIVEN_NAME_COUNT,
  GIVEN_NAMES,
  withGivenNames,
} from "./given-names.js";
import { fileSource } from "./node-source.js";
import { loadDictionary } from "./source.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

describe("given names the sources lack", () => {
  it("reads each as one given name rather than a surname and a name", () => {
    // Given a sentence opening with a listed given name
    // When it is converted
    // Then the name is one word with one capital
    assertIdentical(
      convert(dictionary, "文东今天来了。"),
      "Wéndōng jīntiān láile.",
    );
    assertIdentical(
      convert(dictionary, "文東今天來了。", { locale: "zh-TW" }),
      "Wéndōng jīntiān láile.",
    );
  });

  it("keeps the name whole against a word that would take its last character", () => {
    // Given 小美 before 的, where 美的 is the company Midea
    // When it is converted
    // Then 小美 is the name and 的 the particle
    assertIdentical(
      convert(dictionary, "小美的妈妈生病了。"),
      "Xiǎoměi de māma shēngbìng le.",
    );
  });

  it("reads a name the same way wherever it stands", () => {
    // Given 国兴 opening a sentence, inside one and before 家
    // When each is converted
    // Then every one reads Guóxīng with its capital
    assertIdentical(
      convert(dictionary, "国兴今天来了。"),
      "Guóxīng jīntiān láile.",
    );
    assertIdentical(
      convert(dictionary, "玩的时候国兴家的狗想回家。"),
      "Wán de shíhou Guóxīng jiā de gǒu xiǎng huíjiā.",
    );
    assertIdentical(
      convert(dictionary, "国兴的星期天", { capitals: "proper" }),
      "Guóxīng de xīngqītiān",
    );
  });

  it("writes a transliterated name with the apostrophe it needs", () => {
    assertIdentical(convert(dictionary, "拉胡尔来了。"), "Lāhú'ěr láile.");
  });

  it("capitalises the speech a name introduces", () => {
    // Given quoted speech after a colon, ending inside the quotation
    // When it is converted
    // Then the speech opens with a capital and the closing mark follows on
    assertIdentical(
      convert(dictionary, "拉胡尔说：“你好。”"),
      "Lāhú'ěr shuō: “Nǐ hǎo.”",
    );
    assertIdentical(
      convert(dictionary, "他说：“国兴，你好。”"),
      "Tā shuō: “Guóxīng, nǐ hǎo.”",
    );
  });

  it("leaves ordinary words that hold a name's characters alone", () => {
    // Given text where a listed name's characters belong to other words
    // When it is converted
    // Then neither is read as the name
    assertIdentical(
      convert(dictionary, "一九六零年代，美国兴起民权运动。"),
      "Yì jiǔliù líng niándài, Měiguó xīngqǐ mínquán yùndòng.",
    );
    assertIdentical(
      convert(dictionary, "他儿子明年就成年。"),
      "Tā érzi míngnián jiù chéngnián.",
    );
    assertIdentical(convert(dictionary, "她很美。"), "Tā hěn měi.");
  });

  it("enters a name jieba already lists as a person, at the larger count", () => {
    // Given jieba's entry for 国兴, a distinguishing word counted ten times
    const jieba = new Map([
      ["国兴", { frequency: 10, partOfSpeech: "b" }],
      ["书", { frequency: 9000, partOfSpeech: "n" }],
    ]);

    // When the given names are entered
    const entered = withGivenNames(jieba, GIVEN_NAMES);

    // Then it is a person at the given-name count, and nothing else moves
    assertIdentical(entered.get("国兴")?.partOfSpeech, "nr");
    assertIdentical(entered.get("国兴")?.frequency, GIVEN_NAME_COUNT);
    assertIdentical(entered.get("书"), jieba.get("书"));
    assertTrue(entered.has("小美"));
  });

  it("leaves jieba as it was when no names are given", () => {
    const jieba = new Map([["书", { frequency: 9000, partOfSpeech: "n" }]]);
    assertIdentical(withGivenNames(jieba, new Map()), jieba);
  });
});
