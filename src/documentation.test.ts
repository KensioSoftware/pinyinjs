import { fileURLToPath } from "node:url";

import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertObjectEquals,
  assertSetSize,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { runCli } from "./cli/run.js";
import type { CliEnvironment } from "./cli/run.js";
import { isUncertain } from "./decode/confidence.js";
import {
  convert,
  convertGreedily,
  convertPieces,
  joinPieces,
} from "./decode/convert.js";
import { applySandhi } from "./decode/sandhi.js";
import {
  fractionHanzi,
  numeralHanzi,
  type NumeralOptions,
  percentHanzi,
  readNumeral,
} from "./numerals/numerals.js";
import { fileSource } from "./dictionary/node-source.js";
import { loadDictionary } from "./dictionary/source.js";
import { convertToHtml, toHtml } from "./format/html.js";
import { readBopomofo, writeBopomofo } from "./romanization/bopomofo.js";
import { readIpa, writeIpa, writeIpaSymbols } from "./romanization/ipa.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  writeWadeGiles,
  writeWadeGilesSpelling,
  writeWadeGilesWord,
} from "./romanization/wade-giles.js";
import { readYale, writeYale, writeYaleSpelling } from "./romanization/yale.js";
import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
  RARE_SYLLABLES,
} from "./syllable/inventory.js";
import { FINALS, INITIALS } from "./syllable/phonology.js";
import { readWord, splitSyllables } from "./syllable/split.js";
import {
  isSyllable,
  normaliseUmlaut,
  readSyllable,
  type Syllable,
  writeSyllable,
  writeSyllableSpelling,
} from "./syllable/syllable.js";
import {
  applyToneMark,
  stripToneMarks,
  toneFromMarks,
} from "./tone/tone-mark.js";
import { NEUTRAL_TONE, TONES } from "./tone/tone.js";

/**
 * Every example the pages under `docs/` show, run against the committed
 * dictionary.
 *
 * The same contract [README.md](../README.md) has with
 * [readme.test.ts](./readme.test.ts), for the same reason: a documented output
 * that no longer happens is a page lying to somebody, and nothing about reading
 * it would catch that.
 *
 * **Update a page and this file together.** Where a page repeats an example the
 * README already shows, the assertion lives in `readme.test.ts` and is not
 * duplicated here — what is here is what the docs pages say beyond it.
 */
const dataDirectory = fileURLToPath(new URL("../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/**
 * A reading written out, for readable expectations.
 */
function written(syllables: readonly Syllable[]): string {
  return syllables.map((syllable) => writeSyllable(syllable)).join(" ");
}

/**
 * The alternatives a piece reports, written out.
 */
function alternatives(text: string, index: number): readonly string[] {
  const piece = convertPieces(dictionary, text)[index];
  assertNonNullable(piece);
  assertNonNullable(piece.confidence);
  return piece.confidence.alternatives.map((found) =>
    found.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

/**
 * How many distinct spellings a system gives the whole inventory.
 */
function distinct(spell: (pinyin: string) => string): number {
  return new Set([...DICTIONARY_SYLLABLES].map((pinyin) => spell(pinyin))).size;
}

/**
 * A syllable of the romanisation page's examples, parsed.
 */
function one(pinyin: string): Syllable {
  const read = readSyllable(pinyin);
  assertNonNullable(read, pinyin);
  return read;
}

/**
 * What a Wade-Giles spelling reads back as on that page.
 */
function loosely(spelling: string): readonly string[] {
  return readWadeGilesLoosely(spelling).map((syllable) =>
    writeSyllable(syllable),
  );
}

/**
 * A Wade-Giles spelling with the marks a hurried text drops taken off it.
 */
function dropped(spelling: string): string {
  return spelling.replaceAll(/['êŭü]/gu, (mark) =>
    mark === "ê" ? "e" : mark === "'" ? "" : "u",
  );
}

/**
 * A number read out, as the numbers page reads it.
 */
function said(value: string | number, options: NumeralOptions = {}): string {
  return (
    readNumeral(value, options)
      ?.map((syllable) => writeSyllable(syllable))
      .join(" ") ?? ""
  );
}

describe("the examples in docs/", () => {
  describe("getting-started", () => {
    it("converts the four texts the page opens on", () => {
      assertIdentical(convert(dictionary, "银行"), "yínháng");
      assertIdentical(convert(dictionary, "行长"), "hángzhǎng");
      assertIdentical(
        convert(dictionary, "我要去北京。"),
        "Wǒ yào qù Běijīng.",
      );
      assertIdentical(convert(dictionary, "3D银行"), "sān D yínháng");
    });
  });

  describe("converting", () => {
    it("beats the greedy baseline on the spacing of 研究生命起源", () => {
      assertIdentical(
        convert(dictionary, "研究生命起源"),
        "yánjiū shēngmìng qǐyuán",
      );
      assertIdentical(
        convertGreedily(dictionary, "研究生命起源"),
        "yánjiūshēng mìng qǐyuán",
      );
    });

    it("writes the orthography examples the page cites", () => {
      assertIdentical(convert(dictionary, "他看了"), "tā kànle");
      assertIdentical(convert(dictionary, "南京市"), "Nánjīng Shì");
      assertIdentical(convert(dictionary, "天安门"), "Tiān'ānmén");
    });

    it("reads 得 the three ways the page shows", () => {
      assertIdentical(convert(dictionary, "我得走了"), "wǒ děi zǒule");
      assertIdentical(convert(dictionary, "他跑得很快"), "tā pǎo de hěn kuài");
      assertIdentical(convert(dictionary, "他得到了"), "tā dédàole");
    });

    it("keeps 儿 off its own where the 儿化 is attested", () => {
      assertIdentical(convert(dictionary, "那边儿"), "nà biānr");
      assertIdentical(convert(dictionary, "女儿"), "nǚ'ér");
    });

    it("joins pieces back into what convert returns", () => {
      const pieces = convertPieces(dictionary, "长江大桥");
      assertIdentical(joinPieces(pieces), "Cháng Jiāng Dàqiáo");
      assertIdentical(joinPieces(pieces), convert(dictionary, "长江大桥"));
    });

    it("renders html from the same pieces convertToHtml uses", () => {
      const pieces = convertPieces(dictionary, "长江大桥");
      assertIdentical(toHtml(pieces), convertToHtml(dictionary, "长江大桥"));
    });
  });

  describe("options", () => {
    it("writes Latin punctuation by default and keeps it when asked", () => {
      assertIdentical(convert(dictionary, "北京。"), "Běijīng.");
      assertIdentical(
        convert(dictionary, "北京。", { punctuation: "keep" }),
        "Běijīng。",
      );
      assertIdentical(
        convert(dictionary, "北京。", { capitals: "none" }),
        "běijīng.",
      );
    });

    it("capitalises proper nouns only under capitals: proper", () => {
      assertIdentical(
        convert(dictionary, "我要去北京。", { capitals: "proper" }),
        "wǒ yào qù Běijīng.",
      );
    });

    it("writes the apostrophe on the styles the page shows", () => {
      assertIdentical(convert(dictionary, "海鸥"), "hǎi'ōu");
      assertIdentical(
        convert(dictionary, "海鸥", { apostrophe: "standard" }),
        "hǎiōu",
      );
      assertIdentical(
        convert(dictionary, "天安门", { apostrophe: "never" }),
        "Tiānānmén",
      );
    });

    it("writes the neutral tone as 5 in the numbered notations only", () => {
      assertIdentical(convert(dictionary, "我的"), "wǒ de");
      assertIdentical(
        convert(dictionary, "我的", { notation: "numbers" }),
        "wo3 de5",
      );
      assertIdentical(
        convert(dictionary, "我的", { notation: "superscript" }),
        "wo³ de⁵",
      );
    });

    it("merges the sandhi object with the defaults, leaving yiBu on", () => {
      assertIdentical(
        convert(dictionary, "不是", { sandhi: { thirdTone: true } }),
        "bú shì",
      );
      assertIdentical(
        convert(dictionary, "不是", { sandhi: { yiBu: false } }),
        "bù shì",
      );
    });
  });

  describe("orthography", () => {
    it("does the three things the opening example claims at once", () => {
      assertIdentical(
        convert(dictionary, "我要去北京玩儿。"),
        "Wǒ yào qù Běijīng wánr.",
      );
    });

    it("applies the grouping rules the page lists", () => {
      assertIdentical(convert(dictionary, "走着"), "zǒuzhe");
      assertIdentical(convert(dictionary, "我的"), "wǒ de");
      assertIdentical(convert(dictionary, "桌子"), "zhuōzi");
      assertIdentical(convert(dictionary, "现代化"), "xiàndàihuà");
      assertIdentical(convert(dictionary, "一个人"), "yí gè rén");
      assertIdentical(
        convert(dictionary, "南京市", { grouping: false }),
        "Nánjīngshì",
      );
    });

    it("writes the curated list entries the page names", () => {
      assertIdentical(convert(dictionary, "一天"), "yì tiān");
      assertIdentical(
        convert(dictionary, "我还给你了。"),
        "Wǒ huán gěi nǐ le.",
      );
    });

    it("capitalises names and place generics", () => {
      assertIdentical(convert(dictionary, "李华"), "Lǐ Huá");
      assertIdentical(convert(dictionary, "长江"), "Cháng Jiāng");
      assertIdentical(convert(dictionary, "上海"), "Shànghǎi");
    });

    it("handles 儿 three different ways", () => {
      assertIdentical(convert(dictionary, "玩儿"), "wánr");
      assertIdentical(convert(dictionary, "女儿"), "nǚ'ér");
      assertIdentical(convert(dictionary, "儿子"), "érzi");
    });

    it("hyphenates the reduplications the page shows", () => {
      assertIdentical(convert(dictionary, "干干净净"), "gāngān-jìngjìng");
      assertIdentical(convert(dictionary, "高高兴兴"), "gāogāo-xìngxìng");
      assertIdentical(convert(dictionary, "研究研究"), "yánjiū-yánjiū");
      assertIdentical(
        convert(dictionary, "请你休息休息。"),
        "Qǐng nǐ xiūxi-xiūxi.",
      );
    });

    it("leaves the two shapes the page says it leaves", () => {
      assertIdentical(convert(dictionary, "爸爸妈妈"), "bàba māma");
      assertIdentical(convert(dictionary, "看看"), "kànkan");
    });

    it("hyphenates a listed 成语 and leaves the rest solid", () => {
      assertIdentical(convert(dictionary, "风平浪静"), "fēngpíng-làngjìng");
      assertIdentical(convert(dictionary, "層出不窮"), "céngchū-bùqióng");
      // Not on the list, and not two disyllables either.
      assertIdentical(convert(dictionary, "不亦乐乎"), "búyìlèhū");
      assertIdentical(convert(dictionary, "目不转睛"), "mùbùzhuǎnjīng");
    });

    it("writes the gaps the page admits to", () => {
      // jieba tags 无缝钢管 nz, so it capitalises where it should not.
      assertIdentical(convert(dictionary, "无缝钢管"), "Wúfènggāngguǎn");
      assertIdentical(convert(dictionary, "老王"), "lǎo Wáng");
    });
  });

  describe("confidence", () => {
    it("reports 长江大桥 as word-backed where the page says it is", () => {
      const pieces = convertPieces(dictionary, "长江大桥");
      const first = pieces[0];
      assertNonNullable(first);
      assertNonNullable(first.confidence);

      assertIdentical(first.text, "Cháng");
      assertFalse(first.confidence.isLocked);
      assertFalse(isUncertain(first.confidence));
      assertArrayEquals(alternatives("长江大桥", 0), ["zhǎng"]);
    });

    it("gives a piece between syllables no syllable and no confidence", () => {
      const space = convertPieces(dictionary, "长江大桥")[1];
      assertNonNullable(space);
      assertIdentical(space.text, " ");
      assertUndefined(space.syllable);
      assertUndefined(space.confidence);
    });
  });

  describe("html", () => {
    it("emits the elements and classes the page documents", () => {
      assertIdentical(
        convertToHtml(dictionary, "银行"),
        '<span class="py-syllable py-tone-2">yín</span>' +
          '<span class="py-syllable py-tone-2">háng</span>',
      );
    });

    it("marks up a read number and escapes the rest", () => {
      assertIdentical(
        convertToHtml(dictionary, "3D银行"),
        '<span class="py-syllable py-tone-1">sān</span> D ' +
          '<span class="py-syllable py-tone-2">yín</span>' +
          '<span class="py-syllable py-tone-2">háng</span>',
      );
    });

    it("drops the tone classes and the uncertainty marking when asked", () => {
      assertIdentical(
        convertToHtml(dictionary, "银行", { toneClasses: false }),
        '<span class="py-syllable">yín</span>' +
          '<span class="py-syllable">háng</span>',
      );
      assertIdentical(
        convertToHtml(dictionary, "行", { markUncertain: false }),
        '<span class="py-syllable py-tone-2">xíng</span>',
      );
    });
  });

  describe("dictionaries", () => {
    it("holds the entry fields the page tabulates", () => {
      const entry = dictionary.lookup("垃圾");
      assertNonNullable(entry);
      assertIdentical(entry.word, "垃圾");
      assertIdentical(written(entry.reading), "lā jī");
      assertNonNullable(entry.taiwanReading);
      assertIdentical(written(entry.taiwanReading), "lè sè");
      assertIdentical(entry.partOfSpeech, "n");
      assertFalse(entry.isProperNoun);
    });

    it("has no taiwanReading where the readings do not differ", () => {
      const entry = dictionary.lookup("银行");
      assertNonNullable(entry);
      assertUndefined(entry.taiwanReading);
    });

    it("flags a proper noun", () => {
      const entry = dictionary.lookup("北京");
      assertNonNullable(entry);
      assertTrue(entry.isProperNoun);
      assertIdentical(entry.partOfSpeech, "ns");
    });

    it("counts keys rather than entries", () => {
      assertIdentical(dictionary.size, 723_139);
    });

    it("returns undefined for a word it does not have", () => {
      assertUndefined(dictionary.lookup("蛋糕店铺子"));
      assertFalse(dictionary.hasPrefix("蛋糕店"));
    });

    it("reads 银行 on standard and full but not on core", async () => {
      const core = await loadDictionary(fileSource(dataDirectory), "core");
      assertIdentical(core.size, 16_987);
      assertIdentical(convert(core, "银行"), "yín xíng");
      assertIdentical(convert(core, "我要去北京。"), "Wǒ yào qù běi Jīng.");

      const standard = await loadDictionary(
        fileSource(dataDirectory),
        "standard",
      );
      assertIdentical(standard.size, 98_018);
      assertIdentical(convert(standard, "银行"), "yínháng");
      assertIdentical(convert(standard, "我要去北京。"), "Wǒ yào qù Běijīng.");
    });
  });

  describe("syllables", () => {
    it("parses the underlying final rather than the spelling", () => {
      assertObjectEquals(readSyllable("jūn"), {
        initial: "j",
        final: "ün",
        tone: 1,
      });
      assertObjectEquals(readSyllable("jun1"), {
        initial: "j",
        final: "ün",
        tone: 1,
      });
    });

    it("writes the toneless spelling back", () => {
      assertIdentical(
        writeSyllableSpelling({ initial: "j", final: "ün", tone: 1 }),
        "jun",
      );
    });

    it("takes every ü convention", () => {
      const lu = { initial: "l", final: "ü", tone: 4 } as const;
      assertObjectEquals(readSyllable("lü4"), lu);
      assertObjectEquals(readSyllable("lv4"), lu);
      assertObjectEquals(readSyllable("lu:4"), lu);
      assertIdentical(normaliseUmlaut("lv"), "lü");
    });

    it("parses shong as well formed while the inventory rejects it", () => {
      assertObjectEquals(readSyllable("shong"), {
        initial: "sh",
        final: "ong",
        tone: undefined,
      });
      assertTrue(isSyllable("shong"));
      assertFalse(DICTIONARY_SYLLABLES.has("shong"));
      assertTrue(DICTIONARY_SYLLABLES.has("zhuang"));
    });

    it("sizes the three inventories as the page tabulates them", () => {
      assertArrayLength(ATTESTED_SYLLABLES, 415);
      assertArrayLength(RARE_SYLLABLES, 9);
      assertSetSize(DICTIONARY_SYLLABLES, 424);
      assertArrayEquals(
        [...RARE_SYLLABLES],
        ["bong", "cei", "din", "eng", "fiao", "lo", "rua", "sei", "tei"],
      );
      assertArrayLength(INITIALS, 21);
      assertArrayLength(FINALS, 41);
    });

    it("splits without breaking a final apart", () => {
      assertArrayEquals(splitSyllables("Zhōngguórén"), ["Zhōng", "guó", "rén"]);
    });

    it("finds a reading in Latin text that is not pinyin at all", () => {
      // Which is why the page says to check the pieces against the inventory
      // rather than to expect undefined here.
      assertNonNullable(readWord("nonsense"));
    });

    it("marks and strips tones as the page shows", () => {
      assertIdentical(applyToneMark("hao", 3), "hǎo");
      assertIdentical(applyToneMark("hao", NEUTRAL_TONE), "hao");
      assertIdentical(applyToneMark("lü", 4), "lǜ");
      assertIdentical(stripToneMarks("Xī'ān"), "Xi'an");
      assertIdentical(toneFromMarks("hǎo"), 3);
      assertUndefined(toneFromMarks("hao"));
    });
  });

  describe("sandhi", () => {
    it("flattens 不 before a fourth tone only", () => {
      assertIdentical(convert(dictionary, "不是"), "bú shì");
      assertIdentical(convert(dictionary, "不对"), "bú duì");
      assertIdentical(convert(dictionary, "不行"), "bùxíng");
    });

    it("writes each 一 sandhi the page lists", () => {
      assertIdentical(convert(dictionary, "一天"), "yì tiān");
      assertIdentical(convert(dictionary, "一起"), "yìqǐ");
      assertIdentical(convert(dictionary, "一个"), "yí gè");
      assertIdentical(convert(dictionary, "一样"), "yíyàng");
      assertIdentical(convert(dictionary, "第一"), "dìyī");
    });

    it("leaves the third tone alone unless asked", () => {
      assertIdentical(convert(dictionary, "好好"), "hǎohǎo");
      assertIdentical(
        convert(dictionary, "好好", { sandhi: { thirdTone: true } }),
        "háohǎo",
      );

      const henHao = readWord("hěnhǎo") ?? [];
      assertIdentical(written(applySandhi(henHao)), "hěn hǎo");
      assertIdentical(
        written(applySandhi(henHao, { thirdTone: true })),
        "hén hǎo",
      );
    });
  });

  describe("scripts-and-locales", () => {
    it("converts either script without being told which", () => {
      assertIdentical(convert(dictionary, "银行"), "yínháng");
      assertIdentical(convert(dictionary, "銀行"), "yínháng");
      assertIdentical(convert(dictionary, "臺灣"), "Táiwān");
      assertIdentical(convert(dictionary, "台灣"), "Táiwān");
    });

    it("keys both 繁體 spellings of 台湾 to the same entry", () => {
      const first = dictionary.lookup("臺灣");
      const second = dictionary.lookup("台灣");
      assertNonNullable(first);
      assertNonNullable(second);
      assertIdentical(written(first.reading), written(second.reading));
    });
  });

  describe("numerals", () => {
    it("counts and spells out the examples the page shows", () => {
      assertIdentical(numeralHanzi(12_345), "一万两千三百四十五");
      assertIdentical(numeralHanzi(2026), "两千零二十六");
      assertIdentical(numeralHanzi(2026, { style: "digits" }), "二〇二六");
      assertIdentical(numeralHanzi(10), "十");
      assertIdentical(numeralHanzi(115), "一百一十五");
      assertIdentical(numeralHanzi(1005), "一千零五");
      assertIdentical(numeralHanzi(1500), "一千五百");
      assertIdentical(numeralHanzi(25_000), "两万五千");
      assertIdentical(numeralHanzi(20_050), "两万零五十");
      assertIdentical(numeralHanzi(100_000_005), "一亿零五");
    });

    it("keeps the digits of a string and not of a number", () => {
      assertIdentical(numeralHanzi("007", { style: "digits" }), "〇〇七");
      assertIdentical(numeralHanzi("007"), "七");
      assertIdentical(
        numeralHanzi(2019, { style: "digits", zero: "零" }),
        "二零一九",
      );
    });

    it("reads them as the page reads them", () => {
      assertIdentical(said(2026), "liǎng qiān líng èr shí liù");
      assertIdentical(said(2026, { style: "digits" }), "èr líng èr liù");
      assertIdentical(
        said(110, { style: "digits", yao: true }),
        "yāo yāo líng",
      );
      assertIdentical(said("3.14"), "sān diǎn yī sì");
      assertIdentical(said(-40), "fù sì shí");
    });

    it("puts the sandhi back where the page says to", () => {
      assertIdentical(
        applySandhi(readNumeral(100) ?? [])
          .map((syllable) => writeSyllable(syllable))
          .join(" "),
        "yì bǎi",
      );
    });

    it("reverses a percentage and a fraction", () => {
      assertIdentical(percentHanzi(95), "百分之九十五");
      assertIdentical(fractionHanzi(3, 4), "四分之三");
    });

    it("reads the numbers in text the way the page shows", () => {
      assertIdentical(
        convert(dictionary, "我有3个苹果。"),
        "Wǒ yǒu sān gè píngguǒ.",
      );
      assertIdentical(
        convert(dictionary, "1988年之后"),
        "yī jiǔ bā bā nián zhīhòu",
      );
      assertIdentical(
        convert(dictionary, "95%的人"),
        "bǎifēnzhījiǔshíwǔ de rén",
      );
      assertIdentical(convert(dictionary, "3D打印"), "sān D dǎyìn");
      assertIdentical(
        convert(dictionary, "我有3个", { numbers: "keep" }),
        "wǒ yǒu3gè",
      );
    });

    it("leaves an identifier as written, as the page says", () => {
      assertIdentical(convert(dictionary, "6:30起床"), "6:30qǐchuáng");
    });

    it("writes a counted number as one word and spells a year out", () => {
      assertIdentical(convert(dictionary, "25个"), "èrshíwǔ gè");
      assertIdentical(convert(dictionary, "1997年"), "yī jiǔ jiǔ qī nián");
      assertIdentical(convert(dictionary, "1个"), "yí gè");
    });
  });

  describe("romanization", () => {
    it("writes the syllable the page opens on in every system", () => {
      assertIdentical(writeBopomofo(one("jiù")), "ㄐㄧㄡˋ");
      assertIdentical(writeWadeGiles(one("jiù")), "chiu⁴");
      assertIdentical(writeYale(one("jiù")), "jyòu");
      assertIdentical(writeIpa(one("jiù")), "tɕiou˥˩");
    });

    it("writes the bopomofo the page shows", () => {
      assertIdentical(writeBopomofo(one("zhōng")), "ㄓㄨㄥ");
      assertIdentical(writeBopomofo(one("zhī")), "ㄓ");
      assertIdentical(writeBopomofo(one("ma5")), "˙ㄇㄚ");
      const xiong = readBopomofo("ㄒㄩㄥˊ");
      assertNonNullable(xiong);
      assertIdentical(writeSyllable(xiong), "xióng");
      // 事儿 has no rhyme for the ㄦ to attach to; 二儿 is ㄦㄦ.
      assertIdentical(writeBopomofo(one("shìr")), "ㄕㄦˋ");
      assertIdentical(writeBopomofo(one("èrr")), "ㄦㄦˋ");
      assertIdentical(writeBopomofo(one("ǹg")), "ㄫˋ");
    });

    it("writes the Wade-Giles the page shows", () => {
      const spelt = (pinyin: string): string =>
        writeWadeGiles(one(pinyin), { tones: "none" });
      assertIdentical(spelt("běi"), "pei");
      assertIdentical(spelt("gē"), "ko");
      assertIdentical(spelt("zuò"), "tso");
      assertIdentical(spelt("guì"), "kuei");
      assertIdentical(spelt("zī"), "tzŭ");
      assertIdentical(
        writeWadeGilesWord([one("běi"), one("jīng")]),
        "pei³-ching¹",
      );
    });

    it("reads back the spellings the page reads back", () => {
      assertArrayEquals(
        readWadeGiles("chiu⁴").map((syllable) => writeSyllable(syllable)),
        ["jiù"],
      );
      assertArrayEquals(
        readWadeGiles("lo²").map((syllable) => writeSyllable(syllable)),
        ["luó", "ló"],
      );
      assertArrayEquals(
        readWadeGiles("o¹").map((syllable) => writeSyllable(syllable)),
        ["ō", "ē"],
      );
      assertArrayEquals(loosely("chi¹"), ["jī", "qī"]);
      assertArrayEquals(loosely("chu¹"), ["zhū", "chū", "jū", "qū"]);
      assertArrayEquals(loosely("hsueh²"), ["xué"]);
      // Marks may be missing, never wrong.
      assertArrayEquals(loosely("ch'u¹"), ["chū", "qū"]);
    });

    it("has the ambiguity figures the page tabulates", () => {
      const spellings = [...DICTIONARY_SYLLABLES].map((pinyin) =>
        writeWadeGilesSpelling(one(pinyin)),
      );
      assertSetSize(new Set(spellings), 423);
      assertArrayLength(
        spellings.filter((spelling) => /['êŭü]/u.test(spelling)),
        164,
      );

      const merged = spellings.filter(
        (spelling) => readWadeGilesLoosely(dropped(spelling)).length > 1,
      );
      assertArrayLength(merged, 219);
      assertIdentical(spellings.length - merged.length, 205);
      assertArrayLength(
        spellings.filter(
          (spelling) => readWadeGilesLoosely(dropped(spelling)).length === 4,
        ),
        12,
      );
      // Taking the first candidate means believing the text wrote what it
      // meant, which is right wherever the marks-dropped spelling is somebody
      // else's correct one.
      const believed = [...DICTIONARY_SYLLABLES].filter((pinyin) => {
        const spelling = writeWadeGilesSpelling(one(pinyin));
        const first = readWadeGilesLoosely(dropped(spelling))[0];
        return first !== undefined && writeSyllable(first, "none") === pinyin;
      });
      assertArrayLength(believed, 312);
    });

    it("round-trips every form except the tone each system cannot write", () => {
      let forms = 0;
      let bopomofo = 0;
      let wade = 0;
      let yale = 0;
      let yaleNumbered = 0;
      let ipa = 0;
      for (const pinyin of DICTIONARY_SYLLABLES) {
        for (const tone of [undefined, ...TONES]) {
          for (const erhua of [false, true]) {
            const form = {
              ...one(pinyin),
              tone,
              ...(erhua && { erhua: true }),
            };
            forms += 1;
            const back = readBopomofo(writeBopomofo(form));
            if (back !== undefined && back.tone === form.tone) {
              bopomofo += 1;
            }
            if (
              readWadeGiles(writeWadeGiles(form)).some(
                (found) =>
                  found.final === form.final && found.tone === form.tone,
              )
            ) {
              wade += 1;
            }
            if (
              readYale(writeYale(form)).some(
                (found) =>
                  found.final === form.final && found.tone === form.tone,
              )
            ) {
              yale += 1;
            }
            if (
              readYale(writeYale(form, { tones: "numbers" })).some(
                (found) =>
                  found.final === form.final && found.tone === form.tone,
              )
            ) {
              yaleNumbered += 1;
            }
            if (
              readIpa(writeIpa(form)).some(
                (found) =>
                  found.final === form.final && found.tone === form.tone,
              )
            ) {
              ipa += 1;
            }
          }
        }
      }
      assertIdentical(forms, 5088);
      assertIdentical(wade, 5088);
      assertIdentical(bopomofo, 4240);
      assertIdentical(yale, 4240);
      assertIdentical(yaleNumbered, 5088);
      assertIdentical(ipa, 4240);
    });

    it("writes the Yale the page shows", () => {
      assertIdentical(writeYaleSpelling(one("xī")), "syi");
      assertIdentical(writeYaleSpelling(one("zhī")), "jr");
      assertIdentical(writeYaleSpelling(one("rì")), "r");
      assertIdentical(writeYaleSpelling(one("bō")), "bwo");
      assertIdentical(writeYaleSpelling(one("dūn")), "dwun");
      assertIdentical(writeYaleSpelling(one("wén")), "wen");
      assertIdentical(writeYaleSpelling(one("jiā")), "jya");
      assertIdentical(writeYaleSpelling(one("ya")), "ya");
      assertIdentical(writeYale(one("zhī")), "jr̄");
      assertIdentical(writeYale(one("zì")), "dz̀");
      // The r suffix is a letter the system already uses, so it collides.
      assertArrayEquals(
        readYale("ér").map((syllable) => writeSyllable(syllable)),
        ["ér", "ér", "ếr"],
      );
    });

    it("transcribes the IPA the page shows", () => {
      assertIdentical(writeIpaSymbols(one("yī")), "i");
      assertIdentical(writeIpaSymbols(one("wén")), "uən");
      assertIdentical(writeIpaSymbols(one("dūn")), "tuən");
      assertIdentical(writeIpaSymbols(one("tiān")), "tʰiɛn");
      assertIdentical(writeIpaSymbols(one("zhī")), "ʈʂɨ");
      assertIdentical(writeIpa(one("mǎ")), "ma˨˩˦");
      assertIdentical(writeIpa(one("mǎ"), { tones: "numbers" }), "ma214");
      assertIdentical(writeIpaSymbols(one("bō")), "puo");
      assertIdentical(writeIpaSymbols(one("lo")), "lɔ");
    });

    it("counts how many syllables each system can tell apart", () => {
      assertIdentical(
        distinct((pinyin) => writeBopomofo(one(pinyin))),
        424,
      );
      assertIdentical(
        distinct((pinyin) => writeIpaSymbols(one(pinyin))),
        424,
      );
      assertIdentical(
        distinct((pinyin) => writeWadeGilesSpelling(one(pinyin))),
        423,
      );
      assertIdentical(
        distinct((pinyin) => writeYaleSpelling(one(pinyin))),
        423,
      );
    });
  });

  describe("the command line", () => {
    /**
     * The CLI, against the same committed dictionary and a fixed version, as
     * `readme.test.ts` runs it.
     */
    const environment: CliEnvironment = {
      version: "0.0.0",
      readInput: () => Promise.resolve(""),
      loadDictionary: () => Promise.resolve(dictionary),
    };

    async function cli(...argv: readonly string[]): Promise<readonly string[]> {
      const result = await runCli(argv, environment);
      assertIdentical(result.status, 0, result.errors.join("\n"));
      return result.output;
    }

    it("explains 长江大桥 as the page shows", async () => {
      assertArrayEquals(await cli("explain", "长江大桥"), [
        "长江大桥  Cháng Jiāng Dàqiáo",
        "  Cháng   word    zhǎng +24.6",
        "  Jiāng   locked",
        "  Dà      word    dài +22.6",
        "  qiáo    locked",
      ]);
    });

    it("shows the Taiwan reading on its own line", async () => {
      assertArrayEquals(await cli("lookup", "垃圾"), [
        "垃圾  lā jī  n",
        "  zh-TW  lè sè",
      ]);
    });

    it("converts with the locale flag", async () => {
      assertArrayEquals(await cli("convert", "--locale", "zh-TW", "垃圾"), [
        "lèsè",
      ]);
    });

    it("romanises pinyin and reads sloppy Wade-Giles back", async () => {
      assertArrayEquals(await cli("romanize", "běijīng"), [
        "běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   pei˨˩˦tɕiŋ˥",
      ]);
      assertArrayEquals(await cli("romanize", "--from", "wade-giles", "chu¹"), [
        "chu¹        zhū       ㄓㄨ          chu¹        jū        ʈʂu˥",
        "            chū       ㄔㄨ          ch'u¹       chū       ʈʂʰu˥       marks restored",
        "            jū        ㄐㄩ          chü¹        jyū       tɕy˥        marks restored",
        "            qū        ㄑㄩ          ch'ü¹       chyū      tɕʰy˥       marks restored",
      ]);
      assertArrayEquals(await cli("romanize", "--from", "yale", "syī"), [
        "syī         xī        ㄒㄧ          hsi¹        syī       ɕi˥",
      ]);
    });

    it("applies sandhi from the command line", async () => {
      assertArrayEquals(await cli("sandhi", "bùshì"), ["bùshì  bú shì"]);
      assertArrayEquals(await cli("sandhi", "--third-tone", "nǐhǎo"), [
        "nǐhǎo  ní hǎo",
      ]);
    });
  });
});
