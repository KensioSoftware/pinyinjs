import { fileURLToPath } from "node:url";

import { assertArrayEquals, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { convert } from "../decode/convert.js";
import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const full = await loadDictionary(fileSource(dataDirectory), "full");
const standard = await loadDictionary(fileSource(dataDirectory), "standard");

/** How a list of texts converts in the full tier. */
function convertAll(texts: readonly string[], dictionary = full): string[] {
  return texts.map((text) => convert(dictionary, text));
}

describe("a lone character the dictionary flags as a name", () => {
  it("writes 毛 the hair in lower case mid-sentence", () => {
    // Given sentences where 毛 is hair, and one where it starts the sentence
    const texts = [
      "这只小猫的毛是雪白的。",
      "它的毛是白的。",
      "狗的毛很长。",
      "毛是白的。",
      "他的毛衣很好看。",
    ];

    // When each is converted
    // Then only the sentence capital is left
    assertArrayEquals(convertAll(texts), [
      "Zhè zhī xiǎomāo de máo shì xuěbái de.",
      "Tā de máo shì bái de.",
      "Gǒu de máo hěn cháng.",
      "Máo shì bái de.",
      "Tā de máoyī hěn hǎokàn.",
    ]);
    // And the standard tier, which spaces 小猫 apart, agrees on the capital
    assertIdentical(
      convert(standard, texts[0] ?? ""),
      "Zhè zhī xiǎo māo de máo shì xuěbái de.",
    );
  });

  it("writes the other flagged everyday words in lower case", () => {
    // Given 云, 东, 南, 江, 王, 熊, 沙, 姜 and 叶 used as ordinary words
    const texts = [
      "天上的云很白。",
      "我们往东走。",
      "秋天的时候，燕子会往南飞。",
      "这条江很长。",
      "狮子是百兽之王。",
      "我看到一只熊。",
      "地上有沙。",
      "我讨厌姜味。",
      "树上的叶很绿。",
    ];

    // When each is converted
    // Then none takes a capital it has no name to carry
    assertArrayEquals(convertAll(texts), [
      "Tiānshàng de yún hěn bái.",
      "Wǒmen wǎng dōng zǒu.",
      "Qiūtiān de shíhou, yànzi huì wǎng nán fēi.",
      "Zhè tiáo jiāng hěn cháng.",
      "Shīzi shì bǎishòu zhī wáng.",
      "Wǒ kàndào yìzhī xióng.",
      "Dìshang yǒu shā.",
      "Wǒ tǎoyàn jiāng wèi.",
      "Shù shàng de yè hěn lǜ.",
    ]);
  });

  it("keeps the capital where the words around it mark a name", () => {
    // Given a surname after 老, 小 or 姓, before a title, before a given name
    // and a title, and beside another name part
    const texts = [
      "老王来了。",
      "那是小李的书。",
      "他姓毛。",
      "王先生来了。",
      "请你告诉李民先生。",
      "她给李护士一本杂志。",
      "李华来了。",
      "他们叫他吉姆。",
      "她是李樱。",
    ];

    // When each is converted
    // Then the surname keeps its capital
    assertArrayEquals(convertAll(texts), [
      "Lǎo Wáng láile.",
      "Nà shì Xiǎo Lǐ de shū.",
      "Tā xìng Máo.",
      "Wáng xiānsheng láile.",
      "Qǐng nǐ gàosu Lǐ mín xiānsheng.",
      "Tā gěi Lǐ hùshi yìběn zázhì.",
      "Lǐ Huá láile.",
      "Tāmen jiào tā Jí mǔ.",
      "Tā shì Lǐ yīng.",
    ]);
  });

  it("keeps the capital on a run of the character alone", () => {
    assertIdentical(convert(full, "毛"), "Máo");
    assertIdentical(convert(full, "王"), "Wáng");
  });
});
