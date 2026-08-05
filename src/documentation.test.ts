import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertObjectEquals,
  assertSetSize,
  assertStringIncludes,
  assertStringNotIncludes,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import * as api from "./index.js";
import { paletteAt, stripColour, visibleLength } from "./cli/colour.js";
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
import { convertToWadeGiles } from "./format/transcription.js";
import { readBopomofo, writeBopomofo } from "./transcription/bopomofo.js";
import {
  readGwoyeu,
  writeGwoyeu,
  writeGwoyeuWord,
} from "./transcription/gwoyeu.js";
import { readIpa, writeIpa, writeIpaSymbols } from "./transcription/ipa.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  readWadeGilesWord,
  splitWadeGiles,
  writeWadeGiles,
  writeWadeGilesSpelling,
  writeWadeGilesWord,
} from "./transcription/wade-giles.js";
import {
  readYale,
  writeYale,
  writeYaleSpelling,
} from "./transcription/yale.js";
import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
  isAttestedTone,
  RARE_SYLLABLES,
  SYLLABLE_TONES,
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
 * A pinyin syllable spelled in Gwoyeu Romatzyh, as that page writes it.
 */
function gr(pinyin: string): string {
  return writeGwoyeu(one(pinyin));
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

/**
 * The API page itself, read rather than transcribed.
 *
 * It opens by claiming to list *everything the package exports*, and nothing
 * executed that claim: 18 of 153 exports were absent from it — the whole of
 * Yale, Gwoyeu Romatzyh and IPA, both end-to-end transcription functions, and
 * every 重叠 and 成语 rule. The same failure as the README's command table, and
 * checkable the same way.
 */
const apiPage = await readFile(
  new URL("../docs/api/README.md", import.meta.url),
  "utf8",
);

describe("the API page", () => {
  it("names every export the package has", () => {
    const missing = Object.keys(api).filter(
      (name) => !apiPage.includes(`\`${name}\``),
    );
    assertArrayEquals(missing, []);
  });
});

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

    // The page said digits passed through untouched and that reading them was
    // unbuilt, next to an example showing 3 read as `sān`. The example was
    // executed and the sentence was not, so what is asserted here is the claim
    // the sentence makes: a digit is read by default and only `keep` stops it.
    it("reads the digits in a non-Han run, and keeps them when asked", () => {
      assertIdentical(convert(dictionary, "3D银行"), "sān D yínháng");
      assertIdentical(convert(dictionary, "1997年"), "yī jiǔ jiǔ qī nián");
      assertIdentical(
        convert(dictionary, "3D银行", { numbers: "keep" }),
        "3Dyínháng",
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

    // The page's claim is about *where the boundary comes from*, so the
    // assertion is on the mechanism and not only on the four outputs: the
    // dictionary states the boundary, it lands after two characters for a
    // compound surname without anything knowing 司马 is one, and it is absent
    // for a transliteration — which is the whole reason Marx stays one word.
    it("writes a name's parts apart, on boundaries the dictionary states", () => {
      assertArrayEquals(dictionary.lookup("毛泽东")?.nameBoundaries ?? [], [1]);
      assertArrayEquals(dictionary.lookup("司马迁")?.nameBoundaries ?? [], [2]);
      assertUndefined(dictionary.lookup("马克思")?.nameBoundaries);

      assertIdentical(convert(dictionary, "毛泽东"), "Máo Zédōng");
      assertIdentical(convert(dictionary, "李白"), "Lǐ Bái");
      assertIdentical(convert(dictionary, "司马迁"), "Sīmǎ Qiān");
      assertIdentical(convert(dictionary, "马克思"), "Mǎkèsī");
    });

    it("writes the names the page counts among its 304 firings", () => {
      assertIdentical(convert(dictionary, "蒋介石"), "Jiǎng Jièshí");
      assertIdentical(convert(dictionary, "孙中山"), "Sūn Zhōngshān");
      assertIdentical(convert(dictionary, "诸葛亮"), "Zhūgě Liàng");
      assertIdentical(convert(dictionary, "夏目漱石"), "Xiàmù Shùshí");
      // Not a person, and the page says so: jieba calls 富士山 a name and
      // CC-CEDICT marks the generic, so the boundary is the standard's anyway.
      assertIdentical(convert(dictionary, "富士山"), "Fùshì Shān");
      // And the case the place rule handles instead, tagged ns rather than nr.
      assertIdentical(convert(dictionary, "丁青县"), "Dīngqīng Xiàn");
    });

    it("writes an organisation apart from its generic", () => {
      // 5.1's other half. This asserted `Běijīngdàxué` and the gap it recorded
      // while the rule wanted jieba's nr only.
      assertIdentical(dictionary.lookup("北京大学")?.partOfSpeech, "nt");
      assertIdentical(convert(dictionary, "北京大学"), "Běijīng Dàxué");
      assertIdentical(convert(dictionary, "清华大学"), "Qīnghuá Dàxué");
      assertIdentical(convert(dictionary, "汇丰银行"), "Huìfēng Yínháng");
    });

    it("cuts every boundary the dictionary states, not only the first", () => {
      // 48% of nt entries carrying a boundary carry more than one, and one cut
      // would leave `Shànghǎi Jiāotōngdàxué`.
      assertArrayEquals(
        dictionary.lookup("上海交通大学")?.nameBoundaries ?? [],
        [2, 4],
      );
      assertIdentical(
        convert(dictionary, "上海交通大学"),
        "Shànghǎi Jiāotōng Dàxué",
      );
      assertIdentical(
        convert(dictionary, "上海浦东发展银行"),
        "Shànghǎi Pǔdōng Fāzhǎn Yínháng",
      );
    });

    it("cuts an abbreviation too finely, which the page records", () => {
      // 中共中央 is `[Zhong1 Gong4 Zhong1 yang1]`: CC-CEDICT capitalises all
      // three elements at character granularity, so 中共 comes apart. 22 of
      // 244 nt firings over the corpus have this shape.
      assertArrayEquals(
        dictionary.lookup("中共中央")?.nameBoundaries ?? [],
        [1, 2],
      );
      assertIdentical(convert(dictionary, "中共中央"), "Zhōng Gòng Zhōngyāng");
    });

    it("leaves the two the page says it gets wrong", () => {
      // CC-CEDICT capitalises Bethune as though it were a Chinese name.
      assertArrayEquals(dictionary.lookup("白求恩")?.nameBoundaries ?? [], [1]);
      assertIdentical(convert(dictionary, "白求恩"), "Bái Qiú'ēn");
      // And a name the tag misses never reaches the rule at all.
      assertIdentical(dictionary.lookup("习近平")?.partOfSpeech, "nrfg");
      assertFalse(dictionary.lookup("习近平")?.isProperNoun ?? true);
      assertIdentical(convert(dictionary, "习近平"), "xíjìnpíng");
      assertIdentical(convert(dictionary, "周恩来"), "zhōu'ēnlái");
    });

    it("capitalises the 称呼语 in front of a surname", () => {
      assertIdentical(
        convert(
          dictionary,
          "\u{6211}\u{53BB}\u{628A}\u{8001}\u{738B}\u{627E}\u{6765}\u{3002}",
        ),
        "W\u{1D2} q\u{F9} b\u{1CE} L\u{1CE}o W\u{E1}ng zh\u{1CE}o l\u{E1}i.",
      );
      assertIdentical(
        convert(
          dictionary,
          "\u{90A3}\u{662F}\u{5C0F}\u{674E}\u{7684}\u{4E66}\u{3002}",
        ),
        "N\u{E0} shi Xi\u{1CE}o L\u{1D0} de sh\u{16B}.",
      );
      // 大 is deliberately not a prefix: it is also an ordinary adjective, and
      // both of the rule's clear mistakes over the corpus were 大.
      assertStringIncludes(
        convert(dictionary, "\u{6CE1}\u{5927}\u{6C60}"),
        "d\u{E0} ",
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

    // The page used to say `Lǐ Huá` came from a surname list, and this example
    // passed anyway — for a different reason than the prose gave. So the
    // mechanism is asserted rather than only the output: 李华 is no entry, both
    // characters carry the flag alone, and a surname whose character does not
    // carry it gets no capital. A surname list would break the last of those.
    it("capitalises 李华 from two flagged characters, with no surname list", () => {
      assertUndefined(dictionary.lookup("李华"));
      for (const character of ["李", "华"]) {
        const entry = dictionary.lookup(character);
        assertNonNullable(entry);
        assertTrue(entry.isProperNoun);
      }
      assertIdentical(convert(dictionary, "李华"), "Lǐ Huá");

      // 钱 and 孙 are surnames the dictionary does not flag, and 華 is the 繁體
      // 华 without the flag its 简体 spelling carries. All three stay lower
      // case, which no surname list would allow.
      for (const character of ["钱", "孙", "華"]) {
        const entry = dictionary.lookup(character);
        assertNonNullable(entry);
        assertFalse(entry.isProperNoun);
      }
      assertIdentical(convert(dictionary, "钱华"), "qián Huá");
      assertIdentical(convert(dictionary, "孙华"), "sūn Huá");
      assertIdentical(convert(dictionary, "李華"), "Lǐ huá");
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
      // jieba tags 无缝钢管 nz, so it capitalises where it should not — and
      // 6.1.6 wants it split, which is the gap the page measures out.
      assertIdentical(convert(dictionary, "无缝钢管"), "Wúfènggāngguǎn");
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
      // `Dictionary.size` counts keys and is a plain number getter; the
      // rule's Map and Set assertions do not apply to it.
      // eslint-disable-next-line no-restricted-syntax
      assertIdentical(dictionary.size, 723_139);
    });

    it("returns undefined for a word it does not have", () => {
      assertUndefined(dictionary.lookup("蛋糕店铺子"));
      assertFalse(dictionary.hasPrefix("蛋糕店"));
    });

    it("reads 银行 on standard and full but not on core", async () => {
      const core = await loadDictionary(fileSource(dataDirectory), "core");
      // `Dictionary.size` counts keys and is a plain number getter; the
      // rule's Map and Set assertions do not apply to it.
      // eslint-disable-next-line no-restricted-syntax
      assertIdentical(core.size, 16_987);
      assertIdentical(convert(core, "银行"), "yín xíng");
      assertIdentical(convert(core, "我要去北京。"), "Wǒ yào qù běi Jīng.");

      const standard = await loadDictionary(
        fileSource(dataDirectory),
        "standard",
      );
      // `Dictionary.size` counts keys and is a plain number getter; the
      // rule's Map and Set assertions do not apply to it.
      // eslint-disable-next-line no-restricted-syntax
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

    it("says which tones a syllable is written in, as the page shows", () => {
      assertArrayEquals(SYLLABLE_TONES.get("lo"), [NEUTRAL_TONE]);
      assertArrayEquals(SYLLABLE_TONES.get("ban"), [1, 3, 4, 5]);
      assertFalse(isAttestedTone(one("ló")));
      assertTrue(isAttestedTone(one("lo")));
      // 424 syllables in five tones, of which 1,708 combinations are written.
      assertSetSize(new Set(SYLLABLE_TONES.keys()), 424);
      assertArrayLength([...SYLLABLE_TONES.values()].flat(), 1708);
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
    it("keeps the 一 that is not counting, as the page shows", () => {
      assertIdentical(convert(dictionary, "十一月"), "shíyīyuè");
      assertIdentical(convert(dictionary, "十一点"), "shíyīdiǎn");
      assertIdentical(convert(dictionary, "第一次"), "dìyīcì");
      assertIdentical(convert(dictionary, "万一你来"), "wànyī nǐ lái");
      assertIdentical(convert(dictionary, "31日"), "sānshíyī rì");
      assertIdentical(convert(dictionary, "一个"), "yí gè");
      // And the one it gets wrong, which the page names.
      assertIdentical(convert(dictionary, "当时一个人"), "dāngshí yī gè rén");
    });

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

    it("writes 两 the three ways the page shows", () => {
      assertIdentical(numeralHanzi(12_000), "一万两千");
      assertIdentical(numeralHanzi(12_000, { liang: "leading" }), "一万二千");
      assertIdentical(numeralHanzi(12_000, { liang: "never" }), "一万二千");
      assertIdentical(numeralHanzi(2000, { liang: "never" }), "二千");
      // And a 2 that is not a multiplier is 二 whatever the setting.
      assertIdentical(numeralHanzi(120_000), "十二万");
      assertIdentical(numeralHanzi(200), "二百");
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

    it("reads a time and leaves an identifier as written, as the page says", () => {
      assertIdentical(
        convert(dictionary, "6:30起床"),
        "liù diǎn sānshí fēn qǐchuáng",
      );
      assertIdentical(convert(dictionary, "2:30"), "liǎng diǎn sānshí fēn");
      assertIdentical(convert(dictionary, "12:00"), "shí'èr diǎn");
      assertIdentical(convert(dictionary, "16:9的"), "16:9de");
    });

    it("writes a counted number as one word and spells a year out", () => {
      assertIdentical(convert(dictionary, "25个"), "èrshíwǔ gè");
      assertIdentical(convert(dictionary, "1997年"), "yī jiǔ jiǔ qī nián");
      assertIdentical(convert(dictionary, "1个"), "yí gè");
    });
  });

  describe("transcription", () => {
    it("writes the syllable the page opens on in every system", () => {
      assertIdentical(writeBopomofo(one("jiù")), "ㄐㄧㄡˋ");
      assertIdentical(writeWadeGiles(one("jiù")), "chiu⁴");
      assertIdentical(writeYale(one("jiù")), "jyòu");
      assertIdentical(writeGwoyeu(one("jiù")), "jiow");
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
        readWadeGiles("lo").map((syllable) => writeSyllable(syllable)),
        ["luo", "lo"],
      );
      assertArrayEquals(
        readWadeGiles("o¹").map((syllable) => writeSyllable(syllable)),
        ["ō", "ē"],
      );
      // The tone narrows the list, and never to nothing.
      assertArrayEquals(
        readWadeGiles("lo²").map((syllable) => writeSyllable(syllable)),
        ["luó"],
      );
      assertArrayEquals(
        readWadeGiles("lo⁵").map((syllable) => writeSyllable(syllable)),
        ["luo", "lo"],
      );
      assertArrayEquals(loosely("pan²"), ["pán"]);
      assertArrayEquals(
        readWadeGiles("fiao²").map((syllable) => writeSyllable(syllable)),
        ["fiáo"],
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

    it("writes hanzi in Wade-Giles as the page shows", () => {
      assertIdentical(
        convertToWadeGiles(
          dictionary,
          "\u{6211}\u{8981}\u{53BB}\u{5317}\u{4EAC}\u{3002}",
          {
            notation: "none",
          },
        ),
        "Wo yao ch'\u{FC} Pei-ching.",
      );
      assertIdentical(
        convertToWadeGiles(dictionary, "\u{5317}\u{4EAC}"),
        "Pei\u{B3}-ching\u{B9}",
      );
      // The 隔音符号 is not written: Wade-Giles spends the apostrophe on
      // aspiration and the hyphen has marked the boundary already.
      assertIdentical(
        convertToWadeGiles(dictionary, "\u{897F}\u{5B89}", {
          notation: "none",
        }),
        "Hsi-an",
      );
    });

    it("matches the attested forms the page tabulates", () => {
      for (const [hanzi, attested] of [
        ["\u{91CD}\u{5E86}", "Ch'ung-ch'ing"],
        ["\u{9752}\u{5C9B}", "Ch'ing-tao"],
        ["\u{53F0}\u{5317}", "T'ai-pei"],
        ["\u{56FD}\u{6C11}\u{515A}", "Kuo-min-tang"],
        ["\u{5317}\u{4EAC}", "Pei-ching"],
        ["\u{5357}\u{4EAC}", "Nan-ching"],
        ["\u{9ED1}\u{9F99}\u{6C5F}", "Hei-lung-chiang"],
        ["\u{56DB}\u{5DDD}", "Ss\u{16D}-ch'uan"],
        ["\u{5E7F}\u{4E1C}", "Kuang-tung"],
        ["\u{897F}\u{5B89}", "Hsi-an"],
      ] as const) {
        assertIdentical(
          convertToWadeGiles(dictionary, hanzi, { notation: "none" }),
          attested,
          hanzi,
        );
      }
      // 毛泽东 was one of the five the page recorded as a word boundary rather
      // than a hyphen defect. The 姓/名 rule supplies the boundary, so both
      // come out as the attested forms do — bar the ê a real text drops.
      assertIdentical(
        convertToWadeGiles(dictionary, "\u{6BDB}\u{6CFD}\u{4E1C}", {
          notation: "none",
        }),
        "Mao Ts\u{EA}-tung",
      );
      assertIdentical(
        convert(dictionary, "\u{6BDB}\u{6CFD}\u{4E1C}"),
        "M\u{E1}o Z\u{E9}d\u{14D}ng",
      );
      // Supply the boundary and the generic case comes out attested.
      assertIdentical(
        convertToWadeGiles(dictionary, "\u{5317}\u{4EAC} \u{5927}\u{5B66}", {
          notation: "none",
        }),
        "Pei-ching ta-hs\u{FC}eh",
      );
    });

    it("splits a Wade-Giles word as the page shows", () => {
      assertArrayEquals(splitWadeGiles("maotsetung"), ["mao", "tse", "tung"]);
      assertArrayEquals(splitWadeGiles("mao-tse-tung"), ["mao", "tse", "tung"]);
      assertArrayEquals(splitWadeGiles("hua-\u{EA}rh"), ["hua-\u{EA}rh"]);
      assertArrayEquals(
        (readWadeGilesWord("pei\u{B3}ching\u{B9}") ?? []).map((syllable) =>
          writeSyllable(syllable),
        ),
        ["b\u{11B}i", "j\u{12B}ng"],
      );
    });

    it("refuses the Postal Romanisation the page says it refuses", () => {
      for (const name of [
        "chungking",
        "tsingtao",
        "peking",
        "nanking",
        "canton",
      ]) {
        assertUndefined(splitWadeGiles(name), name);
      }
      // And the three that really are Wade-Giles do split.
      for (const name of ["maotsetung", "taipei", "kuomintang"]) {
        assertNonNullable(splitWadeGiles(name), name);
      }
    });

    it("bars the syllabic nasals the page names from a split", () => {
      for (const nasal of ["ng", "m", "n", "hm", "hng"]) {
        assertArrayEquals(splitWadeGiles(nasal), [nasal], nasal);
      }
      assertUndefined(splitWadeGiles("shung"));
    });

    it("round-trips every form except the tone each system cannot write", () => {
      let forms = 0;
      let bopomofo = 0;
      let wade = 0;
      let yale = 0;
      let yaleNumbered = 0;
      let gwoyeu = 0;
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
              readGwoyeu(writeGwoyeu(form)).some(
                (found) =>
                  found.final === form.final && found.tone === form.tone,
              )
            ) {
              gwoyeu += 1;
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
      // The forms that no longer come back are the ones written in a tone
      // their syllable never takes, where the spelling belongs to another
      // syllable too: `lo` in the four contour tones, and the first-tone 兒
      // that Yale, GR and IPA each spell like a syllable plus 儿化.
      assertIdentical(wade, 5080);
      assertIdentical(bopomofo, 4240);
      assertIdentical(yale, 4239);
      assertIdentical(yaleNumbered, 5085);
      assertIdentical(gwoyeu, 4238);
      assertIdentical(ipa, 4239);
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

    it("writes the four spellings of one syllable the page opens on", () => {
      assertIdentical(writeGwoyeu(one("shān")), "shan");
      assertIdentical(writeGwoyeu(one("shán")), "sharn");
      assertIdentical(writeGwoyeu(one("shǎn")), "shaan");
      assertIdentical(writeGwoyeu(one("shàn")), "shann");
      // 陝西 is Shaanxi in English because of that third-tone doubling.
      assertIdentical(writeGwoyeuWord([one("shǎn"), one("xī")]), "shaanshi");
    });

    it("writes the Gwoyeu Romatzyh the page shows", () => {
      assertIdentical(gr("chuán"), "chwan");
      assertIdentical(gr("cháng"), "charng");
      assertIdentical(gr("qiǎn"), "chean");
      assertIdentical(gr("dǎ"), "daa");
      assertIdentical(gr("dào"), "daw");
      assertIdentical(gr("dà"), "dah");
      // j, ch and sh each stand for two series.
      assertIdentical(gr("zhū"), "ju");
      assertIdentical(gr("jū"), "jiu");
      assertIdentical(gr("jiū"), "jiou");
      // The sonorants swap the first two tones over.
      assertIdentical(gr("mā"), "mha");
      assertIdentical(gr("má"), "ma");
      // And a syllable with no initial grows its y- in every tone but the
      // first, keeping the vowel where the i is not a medial.
      assertArrayEquals(
        ["yī", "yí", "yǐ", "yì"].map((pinyin) => gr(pinyin)),
        ["i", "yi", "yii", "yih"],
      );
    });

    it("writes the neutral dot and the -l the page shows, and reads back", () => {
      assertIdentical(writeGwoyeu(one("de5")), ".de");
      assertIdentical(writeGwoyeu(one("huār")), "hual");
      // GR writes `perng.yeou`, keeping the tone 友 came from; a neutral pinyin
      // syllable does not record it, so what comes out is the basic form.
      assertIdentical(writeGwoyeuWord([one("péng"), one("you5")]), "perng.iou");
      assertArrayEquals(
        readGwoyeu("shaan").map((syllable) => writeSyllable(syllable)),
        ["shǎn"],
      );
      assertArrayEquals(
        readGwoyeu("ell").map((syllable) => writeSyllable(syllable)),
        ["èr"],
      );
      assertArrayEquals(
        readGwoyeu(".ell").map((syllable) => writeSyllable(syllable)),
        ["er", "err"],
      );
      assertArrayEquals(
        readGwoyeu("nn").map((syllable) => writeSyllable(syllable)),
        ["ň", "ǹ"],
      );
    });

    it("has the Gwoyeu Romatzyh counts the page tabulates", () => {
      const forms = [...DICTIONARY_SYLLABLES].flatMap((pinyin) =>
        TONES.filter((tone) => tone !== NEUTRAL_TONE).map((tone) =>
          writeGwoyeu({ ...one(pinyin), tone }),
        ),
      );
      assertArrayLength(forms, 1696);
      assertSetSize(new Set(forms), 1695);
      assertIdentical(
        distinct((pinyin) => writeGwoyeu({ ...one(pinyin), tone: 1 })),
        424,
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
      colours: 0,
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

    it("writes a conversion in another system, as the page shows", async () => {
      assertArrayEquals(
        await cli(
          "convert",
          "--system",
          "wade-giles",
          "--notation",
          "none",
          "我要去北京。",
        ),
        ["Wo yao ch'ü Pei-ching."],
      );
      assertArrayEquals(
        await cli("convert", "--system", "bopomofo", "我要去北京大学。"),
        ["ㄨㄛˇ ㄧㄠˋ ㄑㄩˋ ㄅㄟˇ ㄐㄧㄥ ㄉㄚˋ ㄒㄩㄝˊ."],
      );
      assertArrayEquals(
        await cli(
          "convert",
          "--system",
          "wade-giles",
          "--notation",
          "none",
          "我要去北京大学。",
        ),
        ["Wo yao ch'ü Pei-ching Ta-hsüeh."],
      );
    });

    it("converts with the locale flag", async () => {
      assertArrayEquals(await cli("convert", "--locale", "zh-TW", "垃圾"), [
        "lèsè",
      ]);
    });

    it("romanises pinyin and reads sloppy Wade-Giles back", async () => {
      assertArrayEquals(await cli("transcribe", "běijīng"), [
        "běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   beeijing  pei˨˩˦tɕiŋ˥",
      ]);
      assertArrayEquals(
        await cli("transcribe", "--from", "wade-giles", "chu¹"),
        [
          "chu¹        zhū       ㄓㄨ          chu¹        jū        ju        ʈʂu˥",
          "            chū       ㄔㄨ          ch'u¹       chū       chu       ʈʂʰu˥       marks restored",
          "            jū        ㄐㄩ          chü¹        jyū       jiu       tɕy˥        marks restored",
          "            qū        ㄑㄩ          ch'ü¹       chyū      chiu      tɕʰy˥       marks restored",
        ],
      );
      assertArrayEquals(await cli("transcribe", "--from", "yale", "syī"), [
        "syī         xī        ㄒㄧ          hsi¹        syī       shi       ɕi˥",
      ]);
      assertArrayEquals(await cli("transcribe", "--from", "gwoyeu", ".ell"), [
        ".ell        er        ˙ㄦ          êrh⁵        er        .el       aɚ",
        "            err       ˙ㄦㄦ         êrh-êrh⁵    err       .ell      aɚɚ",
      ]);
    });

    // The romanisation page listed four of `--from`'s six values and said
    // bopomofo was not one of them, where the CLI page listed all six. Both
    // pages describe the same flag, so the two that were missing are asserted:
    // `pinyin` is a value, `bopomofo` is a value *and* is what detection falls
    // on, and `chi` reads as pinyin rather than Wade-Giles when left to auto.
    it("takes pinyin and bopomofo by name, and detects only bopomofo", async () => {
      const asPinyin = [
        "chi         chi       ㄔ           ch'ih       chr       chy       ʈʂʰɨ",
      ];
      assertArrayEquals(
        await cli("transcribe", "--from", "pinyin", "chi"),
        asPinyin,
      );
      assertArrayEquals(await cli("transcribe", "chi"), asPinyin);
      assertArrayEquals(
        await cli("transcribe", "--from", "bopomofo", "ㄅㄟˇ"),
        [
          "ㄅㄟˇ         běi       ㄅㄟˇ         pei³        běi       beei      pei˨˩˦",
        ],
      );
    });

    describe("colour", () => {
      /**
       * The same run at a terminal that reports 256 colours.
       */
      const terminal: CliEnvironment = { ...environment, colours: 256 };

      async function coloured(
        ...argv: readonly string[]
      ): Promise<readonly string[]> {
        const result = await runCli(argv, terminal);
        assertIdentical(result.status, 0, result.errors.join("\n"));
        return result.output;
      }

      it("carries the MDBG values the page's table quotes", () => {
        assertArrayEquals(
          paletteAt(256).map((entry) => `${String(entry.tone)} ${entry.mdbg}`),
          ["1 #ff0000", "2 #d09000", "3 #00a000", "4 #0044ff"],
        );
      });

      it("leaves the fifth tone the terminal's own colour", async () => {
        // 我的 is wǒ de, third tone then neutral: one syllable painted and one
        // not, in a line that is otherwise identical either way.
        assertArrayEquals(await cli("convert", "我的"), ["wǒ de"]);
        const [line] = await coloured("convert", "我的");
        assertNonNullable(line);
        assertIdentical(stripColour(line), "wǒ de");
        assertStringIncludes(line, "de");
        assertStringNotIncludes(line, "\u{1B}[38;5;0m");
      });

      it("colours at a terminal and not into a pipe", async () => {
        assertArrayEquals(await cli("convert", "银行"), ["yínháng"]);
        const written = await coloured("convert", "银行");
        assertIdentical(visibleLength(written.join("")), "yínháng".length);
      });

      it("colours every command the page lists and no others", async () => {
        const painted = await Promise.all(
          [
            ["convert", "银行"],
            ["explain", "银行"],
            ["lookup", "银行"],
            ["syllable", "yínháng"],
            ["sandhi", "bùshì"],
            ["number", "26"],
            ["transcribe", "běijīng"],
          ].map(async (argv) => [argv, await coloured(...argv)] as const),
        );
        for (const [argv, lines] of painted) {
          assertStringIncludes(lines.join("\n"), "\u{1B}[", argv.join(" "));
        }

        const plain = await Promise.all(
          [["html", "银行"], ["info"], ["convert", "--json", "银行"]].map(
            async (argv) => [argv, await coloured(...argv)] as const,
          ),
        );
        for (const [argv, lines] of plain) {
          assertStringNotIncludes(lines.join("\n"), "\u{1B}[", argv.join(" "));
        }
      });

      it("says which flags force it, in the help", async () => {
        const shown = await cli("convert", "--help");
        const help = shown.join("\n");
        assertStringIncludes(help, "--colour, --color");
        assertStringIncludes(help, "--no-colour, --no-color");
      });
    });

    it("applies sandhi from the command line", async () => {
      assertArrayEquals(await cli("sandhi", "bùshì"), ["bùshì  bú shì"]);
      assertArrayEquals(await cli("sandhi", "--third-tone", "nǐhǎo"), [
        "nǐhǎo  ní hǎo",
      ]);
    });
  });
});
