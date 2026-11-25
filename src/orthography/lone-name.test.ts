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

describe("a surname the words around it mark as a name", () => {
  it("capitalises a surname before a kinship or address term", () => {
    // Given sayings and a sentence that call people by surname and a term of
    // address, with no sentence capital in front of the surname
    const texts = [
      "王奶奶和玉奶奶比武",
      "王妈妈卖了磨",
      "王小二做买卖",
      "王小二开饭店",
      "王麻子的剪刀",
      "马奶奶见了冯奶奶",
      "林冲棒打洪教头",
      "我见了马大爷。",
    ];

    // When each is converted
    // Then the surname takes a capital, flagged in the dictionary or not
    assertArrayEquals(convertAll(texts), [
      "Wáng nǎinai hé yù nǎinai bǐwǔ",
      "Wáng māma màile mó",
      "Wáng xiǎo èr zuòmǎimài",
      "Wáng xiǎo èr kāi fàndiàn",
      "Wáng mázi de jiǎndāo",
      "Mǎ nǎinai jiànle Féng nǎinai",
      "Lín Chōng bàng dǎ Hóng jiàotóu",
      "Wǒ jiànle Mǎ dàye.",
    ]);
  });

  it("leaves a counted character and a story's animal parent alone", () => {
    // Given 张 counting photos, and 熊妈妈 a mother bear
    const texts = ["我有两张老师的照片。", "我看见熊妈妈。"];

    // When each is converted
    // Then neither takes a surname's capital
    assertArrayEquals(convertAll(texts), [
      "Wǒ yǒu liǎng zhāng lǎoshī de zhàopiān.",
      "Wǒ kànjiàn xióng māma.",
    ]);
  });

  it("writes a listed personal name as a surname and a given name", () => {
    // Given 歇后语 about historical figures the dictionary does not list,
    // whose given names decode as ordinary words
    const texts = [
      "郑板桥嫁女",
      "蒋干盗书",
      "徐庶进曹营",
      "杨五郎削发",
      "严嵩做寿",
      "八擒孟获",
    ];

    // When each is converted
    // Then the surname and the given name each take a capital, and the given
    // name is one word
    assertArrayEquals(convertAll(texts), [
      "Zhèng Bǎnqiáo jiànǚ",
      "Jiǎng Gàn dào shū",
      "Xú Shù jìn Cáo yíng",
      "Yáng Wǔláng xuēfà",
      "Yán Sōng zuòshòu",
      "bā qín Mèng Huò",
    ]);
    // And the 繁體 writing reads the same
    assertIdentical(convert(full, "蔣幹盜書"), "Jiǎng Gàn dào shū");
  });

  it("writes the other listed names as the table gives them", () => {
    // Given a family, a camp, a temple, two states and foreign names, some
    // with a character the decode reads wrong for the name
    const texts = [
      "贾家的姑娘嫁贾家",
      "拜佛进了吕祖庙",
      "熟读王叔和",
      "楚虽三户，亡秦必楚",
      "尤巴有点夸张了。",
      "这就是为什么吉雄会感冒。",
      "这位是安田先生。",
      "我去年冬天去藏王滑雪。",
    ];

    // When each is converted
    // Then each name is capitalised, spaced and read as the table writes it
    assertArrayEquals(convertAll(texts), [
      "Jiǎ jiā de gūniang jià Jiǎ jiā",
      "bàifó jìnle Lǚzǔ Miào",
      "shúdú Wáng Shūhé",
      "Chǔ suī sānhù, wáng Qín bì Chǔ",
      "Yóubā yǒudiǎn kuāzhāngle.",
      "Zhè jiùshì wèishénme Jíxióng huì gǎnmào.",
      "Zhèwèi shì Āntián xiānsheng.",
      "Wǒ qùnián dōngtiān qù Zàngwáng huáxuě.",
    ]);
  });

  it("capitalises a dynasty before 本", () => {
    // Given a Song edition and a Ming one, and 周 as this week
    const texts = ["这两本都是宋本。", "这是明本。", "这周本来很忙。"];

    // When each is converted
    // Then the dynasties take a capital and the week does not
    assertArrayEquals(convertAll(texts), [
      "Zhè liǎng běn dōu shì Sòng běn.",
      "Zhè shì Míng běn.",
      "Zhè zhōu běnlái hěn máng.",
    ]);
  });

  it("still writes the bare nouns from before in lower case", () => {
    // Given 毛, 云, 熊, 王, 姜, 南, 东, 江 and 池 as ordinary words
    const texts = [
      "这只小猫的毛是雪白的。",
      "狮子是丛林之王。",
      "天上的云很白。",
      "我看到一只熊。",
      "我讨厌姜。",
      "我们往东走。",
      "大雁往南飞去。",
      "这条江很长。",
      "鱼在池里游。",
    ];

    // When each is converted
    // Then none takes a capital past the sentence's own
    assertArrayEquals(convertAll(texts), [
      "Zhè zhī xiǎomāo de máo shì xuěbái de.",
      "Shīzi shì cónglín zhī wáng.",
      "Tiānshàng de yún hěn bái.",
      "Wǒ kàndào yìzhī xióng.",
      "Wǒ tǎoyàn jiāng.",
      "Wǒmen wǎng dōng zǒu.",
      "Dàyàn wǎng nán fēi qù.",
      "Zhè tiáo jiāng hěn cháng.",
      "Yú zài chí lǐ yóu.",
    ]);
  });
});
