import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  assertArrayEquals,
  assertArrayIncludes,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertNumberBetween,
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
import { check } from "./grade/check.js";
import {
  fractionHanzi,
  numeralHanzi,
  type NumeralOptions,
  percentHanzi,
  readNumeral,
} from "./numerals/numerals.js";
import { fileSource } from "./dictionary/node-source.js";
import {
  loadDictionary,
  loadScriptTables,
  loadWordCounts,
} from "./dictionary/source.js";
import {
  convertToAnnotatedHtml,
  convertToHtml,
  type HtmlOptions,
  toHtml,
} from "./format/html.js";
import {
  BOPOMOFO,
  GWOYEU,
  IPA,
  type TranscriptionSystem,
  WADE_GILES,
  YALE,
} from "./transcription/systems.js";
import {
  isUncertainChoice,
  toScript,
  toScriptPieces,
} from "./decode/script.js";
import { match } from "./search/match.js";
import { candidates, homophonesOf } from "./search/candidates.js";
import { ReverseIndex } from "./search/reverse-index.js";
import { slug } from "./format/slug.js";
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
const scriptTables = await loadScriptTables(fileSource(dataDirectory));
const coreDictionary = await loadDictionary(fileSource(dataDirectory), "core");

/**
 * Long enough to derive the reverse index over the full tier, which is about
 * half a second and is not what any of these tests is timing.
 */
const INDEX_TIMEOUT = 10_000;

let derived: ReverseIndex | undefined;

/**
 * The reverse index, derived once and only where a test asks for it.
 */
function reverseIndex(): ReverseIndex {
  derived ??= ReverseIndex.of(dictionary);
  return derived;
}

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
 * Where a query matched, each range as `at+length`, or the empty string.
 */
function matched(haystack: string, query: string): string {
  return (match(dictionary, haystack, query)?.ranges ?? [])
    .map((range) => `${String(range.at)}+${String(range.length)}`)
    .join(" ");
}

/**
 * What a match scored, for the assertions about ranking.
 */
function scored(haystack: string, query: string): number {
  const found = match(dictionary, haystack, query);
  assertNonNullable(found, `${haystack} does not match ${query}`);
  return found.score;
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
      assertIdentical(convert(dictionary, "1998年"), "yī jiǔ jiǔ bā nián");
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

    it("reads 过 toneless where it marks aspect and guò where it does not", () => {
      assertIdentical(convert(dictionary, "他去过法国。"), "Tā qùguo Fǎguó.");
      assertIdentical(convert(dictionary, "我吃过饭了。"), "Wǒ chīguo fàn le.");
      assertIdentical(convert(dictionary, "他经过我家"), "tā jīngguò wǒjiā");
    });

    it("reads 教 as jiāo where it teaches and jiào where it does not", () => {
      assertIdentical(
        convert(dictionary, "他在北京大学教了三年书。"),
        "Tā zài Běijīng Dàxué jiāole sān nián shū.",
      );
      assertIdentical(convert(dictionary, "我教英语"), "wǒ jiāo Yīngyǔ");
      assertIdentical(convert(dictionary, "教育"), "jiàoyù");
      assertIdentical(convert(dictionary, "宗教"), "zōngjiào");
      // The modal in front of it, for the 教 that governs nothing after it.
      assertIdentical(
        convert(dictionary, "他怎么教，我都学不会。"),
        "Tā zěnme jiāo, wǒ dōu xué búhuì.",
      );
      assertIdentical(
        convert(dictionary, "这在学校是不教的"),
        "zhè zài xuéxiào shì bù jiāo de",
      );
      assertIdentical(convert(dictionary, "有教无类"), "yǒujiàowúlèi");
    });

    it("keeps a word beginning with 的 out of the particle's place", () => {
      assertIdentical(
        convert(dictionary, "没有人知道他的真名字"),
        "méiyǒu rén zhīdào tā de zhēn míngzi",
      );
      // The words jieba counted, which the rule leaves alone.
      assertIdentical(convert(dictionary, "我的确知道"), "wǒ díquè zhīdào");
      assertIdentical(
        convert(dictionary, "我要一辆的士"),
        "wǒ yào yí liàng dī shì",
      );
    });

    it("keeps a counted 量词 out of the word behind it", () => {
      assertIdentical(convert(dictionary, "三个人"), "sān gè rén");
      assertIdentical(convert(dictionary, "个人"), "gèrén");
      assertIdentical(convert(dictionary, "五分钟"), "wǔ fēnzhōng");
      // The page's other three: a rule firing on every character after a
      // number would break all of them.
      assertIdentical(convert(dictionary, "三部分"), "sān bùfen");
      assertIdentical(convert(dictionary, "五成分"), "wǔ chéngfèn");
      assertIdentical(convert(dictionary, "五年级"), "wǔ niánjí");
      // An ordinal counts nothing, and a numeral inside a longer word is not
      // counting either.
      assertIdentical(convert(dictionary, "第三集团军"), "dìsān jítuánjūn");
      // 道路 stays one word, which is the page's claim; the 一 of 唯一 taking
      // a sandhi it should not is a separate miss and not this rule's.
      assertStringIncludes(convert(dictionary, "唯一道路"), "dàolù");
    });

    it("reads 长 as cháng where an adverb of degree measures it", () => {
      assertIdentical(
        convert(dictionary, "这篇文章不太长。"),
        "Zhè piān wénzhāng bú tài cháng.",
      );
      assertIdentical(
        convert(dictionary, "要多长时间"),
        "yào duō cháng shíjiān",
      );
      // The other side of the page's claim: the growing 长 and the title both
      // keep the stored default.
      assertIdentical(
        convert(dictionary, "她长得很漂亮"),
        "tā zhǎng de hěn piàoliang",
      );
      assertIdentical(convert(dictionary, "校长"), "xiàozhǎng");
      // 了 and 的 after an adverb are the particle and the attributive, which
      // is why neither guards the rule.
      assertIdentical(convert(dictionary, "时间太长了"), "shíjiān tài chángle");
      assertIdentical(convert(dictionary, "很长的道路"), "hěn cháng de dàolù");
      // The two contexts that need both sides, each with the shape it must
      // not reach beside it.
      assertIdentical(
        convert(dictionary, "那座桥不长。"),
        "Nà zuò qiáo bù cháng.",
      );
      assertIdentical(
        convert(dictionary, "胡子不长在前额上"),
        "húzi bù zhǎng zài qián'é shàng",
      );
      assertIdentical(
        convert(dictionary, "他有长头发。"),
        "Tā yǒu cháng tóufa.",
      );
      assertIdentical(convert(dictionary, "树长叶子"), "shù zhǎng yèzi");
      // The contexts that read the far side alone, and the ordinal that must
      // not be taken for a determiner.
      assertIdentical(convert(dictionary, "长一点"), "cháng yìdiǎn");
      assertIdentical(
        convert(dictionary, "队伍已经长极了"),
        "duìwǔ yǐjīng cháng jíle",
      );
      assertIdentical(
        convert(dictionary, "神经棘长而狭窄"),
        "shénjīng jí cháng ér xiázhǎi",
      );
      assertIdentical(
        convert(dictionary, "那条河长三百公里"),
        "nà tiáo hé cháng sānbǎi gōnglǐ",
      );
      // The same sentence with the number in digits, which is three runs away
      // from the 公里 that measures the 长.
      assertIdentical(
        convert(dictionary, "那条河长300公里"),
        "nà tiáo hé cháng sānbǎi gōnglǐ",
      );
      assertIdentical(
        convert(dictionary, "那条河长300公里。"),
        "Nà tiáo hé cháng sānbǎi gōnglǐ.",
      );
      assertIdentical(
        convert(dictionary, "我看见一个长头发的女生"),
        "wǒ kànjiàn yí gè cháng tóufa de nǚshēng",
      );
      assertIdentical(
        convert(dictionary, "这是我第一次长胡子"),
        "zhè shì wǒ dìyīcì zhǎng húzi",
      );
    });

    it("reads the 得 of a potential complement as the particle", () => {
      assertIdentical(
        convert(dictionary, "他算得上一个作家"),
        "tā suàn de shàng yí gè zuòjiā",
      );
      assertIdentical(
        convert(dictionary, "取得上级批准"),
        "qǔdé shàngjí pīzhǔn",
      );
    });

    it("reads 弹 as tán where it is playing", () => {
      assertIdentical(
        convert(dictionary, "他会弹一点儿古筝。"),
        "Tā huì tán yìdiǎnr gǔzhēng.",
      );
      assertIdentical(
        convert(dictionary, "他钢琴弹得很好"),
        "tā gāngqín tán de hěn hǎo",
      );
      // The other side of the page's claim: the words carry `dàn` themselves,
      // and a cartridge with a particle behind it keeps the stored default.
      assertIdentical(convert(dictionary, "子弹"), "zǐdàn");
      assertIdentical(convert(dictionary, "弹药"), "dànyào");
      assertStringIncludes(convert(dictionary, "魔弹的射手"), "dàn");
      // The `dàn` that reached the position from a two-character reading.
      assertIdentical(
        convert(dictionary, "我的爱好是开车和弹吉他。"),
        "Wǒ de àihào shì kāichē hé tán jítā.",
      );
    });

    it("takes the readings a caller asserts, with the reach the page gives", () => {
      assertIdentical(
        convert(dictionary, "这篇文章不太长。", {
          readings: { 太长: "tài cháng" },
        }),
        "Zhè piān wénzhāng bú tài cháng.",
      );
      // A word hint does not reach into a longer word...
      assertIdentical(
        convert(dictionary, "校长", { readings: { 长: "cháng" } }),
        "xiàozhǎng",
      );
      // ...but naming the whole word does, and keeps it one word.
      assertIdentical(
        convert(dictionary, "银行", { readings: { 银行: "yín xíng" } }),
        "yínxíng",
      );
      // A position outranks the word around it, which is the escape hatch.
      assertIdentical(
        convert(dictionary, "校长", {
          readings: [{ at: 1, reading: "cháng" }],
        }),
        "xiàocháng",
      );
      // An unmarked syllable is 轻声.
      assertIdentical(
        convert(dictionary, "的", { readings: { 的: "de" } }),
        "de",
      );
    });

    it("reads 越长越X as growing only where growing is what it names", () => {
      assertIdentical(
        convert(dictionary, "他越长越高"),
        "tā yuè zhǎng yuè gāo",
      );
      assertIdentical(
        convert(dictionary, "时间越长越好"),
        "shíjiān yuè cháng yuè hǎo",
      );
      // The page's claim that it guesses rather than settles: 越长越X is
      // ambiguous, so the syllable must still come back uncertain.
      const pieces = convertPieces(dictionary, "他越长越高");
      const grown = pieces.find((piece) => piece.text === "zhǎng");
      assertNonNullable(grown, "the 长 comes back as a piece");
      assertNonNullable(grown.confidence, "with a confidence");
      assertTrue(isUncertain(grown.confidence));
    });

    it("decodes the Han after a number with that number in front of it", () => {
      assertIdentical(convert(dictionary, "2个人"), "liǎng gè rén");
      assertIdentical(convert(dictionary, "两个人"), "liǎng gè rén");
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
      assertArrayEquals(dictionary.lookup("齐白石")?.nameBoundaries ?? [], [1]);
      assertArrayEquals(dictionary.lookup("司马迁")?.nameBoundaries ?? [], [2]);
      assertUndefined(dictionary.lookup("马克思")?.nameBoundaries);

      assertIdentical(convert(dictionary, "齐白石"), "Qí Báishí");
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
        "N\u{E0} sh\u{EC} Xi\u{1CE}o L\u{1D0} de sh\u{16B}.",
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

  describe("checking", () => {
    it("marks 银行 typed yínxíng where the page says it does", () => {
      const marked = check(dictionary, "银行", "yínxíng");
      assertArrayEquals(
        marked.syllables.map((one) => one.verdict),
        ["correct", "wrong"],
      );
      assertIdentical(marked.syllables[1]?.source, "行");
      assertIdentical(marked.score, 0.5);
    });

    it("takes either notation, mixed", () => {
      for (const typed of ["běijīng", "bei3jing1", "bei3jīng"]) {
        assertTrue(check(dictionary, "北京", typed).isCorrect, typed);
      }
    });

    it("takes a reading the decoder was guessing at, and no more", () => {
      assertTrue(check(dictionary, "行", "xíng").isCorrect);
      assertTrue(check(dictionary, "行", "háng").isCorrect);
      assertIdentical(
        check(dictionary, "银行", "yínxíng").syllables[1]?.verdict,
        "wrong",
      );
    });

    it("takes sandhi either way", () => {
      for (const [text, typed] of [
        ["你好", "nǐ hǎo"],
        ["你好", "ní hǎo"],
        ["不是", "bú shì"],
        ["不是", "bù shì"],
      ] as const) {
        assertTrue(check(dictionary, text, typed).isCorrect, typed);
      }
    });

    it("tells a missing tone apart from a wrong one", () => {
      assertArrayEquals(
        check(dictionary, "北京", "bei jing").syllables.map(
          (one) => one.verdict,
        ),
        ["toneless", "toneless"],
      );
      assertArrayEquals(
        check(dictionary, "北京", "bei3jing3").syllables.map(
          (one) => one.verdict,
        ),
        ["correct", "tone"],
      );
      assertTrue(check(dictionary, "我的书", "wǒ de shū").isCorrect);
    });

    it("ignores the spacing and the 隔音符号, but not one that spells 先", () => {
      for (const typed of ["Xī'ān", "xī ān", "xi1an1"]) {
        assertTrue(check(dictionary, "西安", typed).isCorrect, typed);
      }
      assertFalse(check(dictionary, "西安", "Xīān").isCorrect);
    });

    it("counts a missing tone only where the caller asks for tones", () => {
      assertTrue(check(dictionary, "北京", "bei jing").isCorrect);
      assertFalse(
        check(dictionary, "北京", "bei jing", { tones: "required" }).isCorrect,
      );
    });

    it("names the characters of the one mistake in a sentence", () => {
      const marked = check(dictionary, "我要去银行", "wǒ yào qù yínxíng");
      assertArrayEquals(
        marked.syllables
          .filter((one) => !one.isCorrect)
          .map((one) => `${one.source ?? ""} ${String(one.at)} ${one.text}`),
        ["行 4 xíng"],
      );
    });

    it("charges an invented syllable as much as a dropped one", () => {
      assertIdentical(check(dictionary, "北京", "běi běi jīng").score, 2 / 3);
      assertIdentical(check(dictionary, "北京市", "běi shì").score, 2 / 3);
      assertArrayEquals(
        check(dictionary, "北京市", "běi shì").syllables.map(
          (one) => one.verdict,
        ),
        ["correct", "missing", "correct"],
      );
    });

    it("grades against a reading the caller asserts", () => {
      assertTrue(
        check(
          dictionary,
          "这篇文章不太长。",
          "zhè piān wénzhāng bú tài cháng",
          {
            readings: { 太长: "tài cháng" },
          },
        ).isCorrect,
      );
    });

    it("reports the spacing on its own axis", () => {
      const split = check(dictionary, "银行", "yín háng");
      assertArrayEquals(
        split.syllables.map((one) => one.verdict),
        ["correct", "correct"],
      );
      assertArrayEquals(
        split.syllables.map((one) => one.spacing),
        ["correct", "split"],
      );
      assertTrue(split.isCorrect);
      assertFalse(
        check(dictionary, "银行", "yín háng", { spacing: "required" })
          .isCorrect,
      );
    });

    it("takes either spacing convention, and a hyphen either way", () => {
      const graded = { spacing: "required" } as const;
      for (const [text, typed] of [
        ["他看了", "tā kànle"],
        ["他看了", "tā kàn le"],
        ["南京市", "Nánjīng Shì"],
        ["南京市", "Nánjīngshì"],
        ["干干净净", "gāngān-jìngjìng"],
        ["干干净净", "gāngān jìngjìng"],
        ["干干净净", "gāngānjìngjìng"],
      ] as const) {
        assertTrue(check(dictionary, text, typed, graded).isCorrect, typed);
      }
    });

    it("marks a sentence written with no boundaries in it", () => {
      assertArrayEquals(
        check(dictionary, "我要去北京。", "wǒyàoqùběijīng", {
          spacing: "required",
        }).syllables.map((one) => one.spacing),
        ["correct", "joined", "joined", "joined", "correct"],
      );
    });

    it("grades 垃圾 against the locale's reading", () => {
      assertTrue(check(dictionary, "垃圾", "lājī").isCorrect);
      assertTrue(
        check(dictionary, "垃圾", "lèsè", { locale: "zh-TW" }).isCorrect,
      );
      assertFalse(check(dictionary, "垃圾", "lèsè").isCorrect);
    });
  });

  describe("html", () => {
    it("annotates the four shapes the page tabulates", () => {
      // The table under "A base is not always one character".
      const one = convertToAnnotatedHtml(dictionary, "银行");
      assertStringIncludes(one, '<ruby lang="zh">银<rp>(</rp>');
      assertStringIncludes(one, '<ruby lang="zh">行<rp>(</rp>');

      assertStringIncludes(
        convertToAnnotatedHtml(dictionary, "玩儿"),
        '<ruby lang="zh">玩儿<rp>(</rp>',
      );

      const number = convertToAnnotatedHtml(dictionary, "95%");
      assertStringIncludes(number, '<ruby lang="zh">95%<rp>(</rp>');
      assertArrayLength(number.match(/<ruby/gu) ?? [], 1);

      // 干干净净 is gāngān-jìngjìng: four bases, and the hyphen is a boundary
      // inside the word, so it sits in the reading and not in the hanzi.
      const doubled = convertToAnnotatedHtml(dictionary, "干干净净");
      assertArrayLength(doubled.match(/<ruby/gu) ?? [], 4);
      assertStringIncludes(doubled, ">gān</span>-</rt>");
      assertStringNotIncludes(doubled, "</ruby>-<ruby");
    });

    it("writes the reading in the system the page names", () => {
      assertIdentical(
        convertToAnnotatedHtml(dictionary, "银行", { transcription: BOPOMOFO }),
        '<ruby lang="zh">银<rp>(</rp><rt>' +
          '<span class="py-syllable py-tone-2" lang="zh-Bopo-CN">ㄧㄣˊ</span>' +
          "</rt><rp>)</rp></ruby>" +
          '<ruby lang="zh">行<rp>(</rp><rt>' +
          '<span class="py-syllable py-tone-2" lang="zh-Bopo-CN">ㄏㄤˊ</span>' +
          "</rt><rp>)</rp></ruby>",
      );
      assertStringIncludes(
        convertToHtml(dictionary, "北京", { transcription: WADE_GILES }),
        ">Pei³</span>-<span",
      );
    });

    it("tags each system the way the page tabulates", () => {
      const tags: readonly [TranscriptionSystem, string, string][] = [
        [BOPOMOFO, "zh-Bopo-CN", "zh-Bopo-TW"],
        [WADE_GILES, "zh-Latn-CN-wadegile", "zh-Latn-TW-wadegile"],
        [YALE, "zh-Latn-CN", "zh-Latn-TW"],
        [GWOYEU, "zh-Latn-CN", "zh-Latn-TW"],
        [IPA, "zh-Latn-CN-fonipa", "zh-Latn-TW-fonipa"],
      ];
      for (const [system, mainland, taiwan] of tags) {
        assertStringIncludes(
          convertToHtml(dictionary, "银行", { transcription: system }),
          `lang="${mainland}"`,
        );
        assertStringIncludes(
          convertToHtml(dictionary, "银行", {
            transcription: system,
            locale: "zh-TW",
          }),
          `lang="${taiwan}"`,
        );
      }
    });

    it("spaces a read number as bopomofo spaces a word, in one <rt>", () => {
      const number = convertToAnnotatedHtml(dictionary, "95%", {
        transcription: BOPOMOFO,
        lang: false,
        toneClasses: false,
      });
      assertArrayLength(number.match(/<ruby/gu) ?? [], 1);
      assertIdentical(
        number.replaceAll(/<\/?span[^>]*>/gu, ""),
        "<ruby>95%<rp>(</rp><rt>ㄅㄞˇ ㄈㄣ ㄓ ㄐㄧㄡˇ ㄕˊ ㄨˇ</rt><rp>)</rp></ruby>",
      );
    });

    it("drops a mark pinyin writes that the system has no use for", () => {
      const written = (options: HtmlOptions): string =>
        convertToHtml(dictionary, "干干净净", {
          ...options,
          lang: false,
          toneClasses: false,
        }).replaceAll(/<\/?span[^>]*>/gu, "");
      assertIdentical(written({}), "gāngān-jìngjìng");
      assertIdentical(
        written({ transcription: WADE_GILES }),
        "kan¹-kan¹-ching⁴-ching⁴",
      );
      assertIdentical(
        written({ transcription: BOPOMOFO }),
        "ㄍㄢ ㄍㄢ ㄐㄧㄥˋ ㄐㄧㄥˋ",
      );
    });

    it("emits the elements and classes the page documents", () => {
      assertIdentical(
        convertToHtml(dictionary, "银行"),
        '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span>' +
          '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>',
      );
    });

    it("marks up a read number and escapes the rest", () => {
      assertIdentical(
        convertToHtml(dictionary, "3D银行"),
        '<span class="py-syllable py-tone-1" lang="zh-Latn-CN-pinyin">sān</span> D ' +
          '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span>' +
          '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>',
      );
    });

    it("declares the 國語 reading standard where the conversion reads it", () => {
      assertIdentical(
        convertToHtml(dictionary, "垃圾", { locale: "zh-TW" }),
        '<span class="py-syllable py-tone-4" lang="zh-Latn-TW-pinyin">lè</span>' +
          '<span class="py-syllable py-tone-4" lang="zh-Latn-TW-pinyin">sè</span>',
      );
    });

    it("drops the tone classes, the uncertainty and the language when asked", () => {
      assertIdentical(
        convertToHtml(dictionary, "银行", { toneClasses: false }),
        '<span class="py-syllable" lang="zh-Latn-CN-pinyin">yín</span>' +
          '<span class="py-syllable" lang="zh-Latn-CN-pinyin">háng</span>',
      );
      assertIdentical(
        convertToHtml(dictionary, "行", { markUncertain: false }),
        '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">xíng</span>',
      );
      assertIdentical(
        convertToHtml(dictionary, "银行", { lang: false }),
        '<span class="py-syllable py-tone-2">yín</span>' +
          '<span class="py-syllable py-tone-2">háng</span>',
      );
    });
  });

  describe("script conversion", () => {
    it("converts the sentence the page opens on", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "我们后来发现了头发问题", {
          to: "zh-Hant",
        }),
        "我們後來發現了頭髮問題",
      );
    });

    it("splits a merged character on the reading", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "头发", { to: "zh-Hant" }),
        "頭髮",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "出发", { to: "zh-Hant" }),
        "出發",
      );
    });

    it("splits 干 three ways and 只 two, as the table lists", () => {
      const rows = [
        ["干燥", "乾燥"],
        ["干部", "幹部"],
        ["干扰", "干擾"],
        ["一只猫", "一隻貓"],
        ["只有", "只有"],
      ] as const;
      for (const [hans, hant] of rows) {
        assertIdentical(
          toScript(dictionary, scriptTables, hans, { to: "zh-Hant" }),
          hant,
        );
      }
    });

    it("keeps 乾 where the reading says it is not 干", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "乾燥", { to: "zh-Hans" }),
        "干燥",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "乾隆", { to: "zh-Hans" }),
        "乾隆",
      );
    });

    it("writes the Taiwan and Hong Kong forms the page tabulates", () => {
      const rows = [
        ["面包", "麵包", "麪包"],
        ["群众", "群眾", "羣眾"],
        ["里面", "裡面", "裏面"],
        ["卫生", "衛生", "衞生"],
      ] as const;
      for (const [hans, taiwan, hongKong] of rows) {
        assertIdentical(
          toScript(dictionary, scriptTables, hans, { to: "zh-Hant-TW" }),
          taiwan,
        );
        assertIdentical(
          toScript(dictionary, scriptTables, hans, { to: "zh-Hant-HK" }),
          hongKong,
        );
      }
    });

    it("splits 著 and 着 for Hong Kong on the reading", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "看着", { to: "zh-Hant-HK" }),
        "看着",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "著作", { to: "zh-Hant-HK" }),
        "著作",
      );
    });

    it("writes 蔘 only for the 參 that is ginseng", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "人参", { to: "zh-Hant-HK" }),
        "人蔘",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "参加", { to: "zh-Hant-HK" }),
        "參加",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "参差", { to: "zh-Hant-HK" }),
        "參差",
      );
    });

    it("reports 面 as the guess in 下面, with 麵 as its rival", () => {
      const { text, choices } = toScriptPieces(
        dictionary,
        scriptTables,
        "下面",
        {
          to: "zh-Hant",
        },
      );
      assertIdentical(text, "下面");
      assertArrayEquals(
        choices
          .filter((choice) => isUncertainChoice(choice))
          .map((c) => c.from),
        ["面"],
      );
      assertArrayEquals([...(choices[1]?.alternatives ?? [])], ["麵"]);
    });

    it("names 万 as its own rival, and 麪 as Hong Kong's", () => {
      const { choices } = toScriptPieces(dictionary, scriptTables, "一万人", {
        to: "zh-Hant",
      });
      const wan = choices[1];
      assertNonNullable(wan);
      assertIdentical(wan.evidence, "default");
      assertArrayEquals([...wan.alternatives], ["万"]);

      const hongKong = toScriptPieces(dictionary, scriptTables, "下面", {
        to: "zh-Hant-HK",
      });
      assertArrayEquals([...(hongKong.choices[1]?.alternatives ?? [])], ["麪"]);
    });

    it("settles 台 for Hong Kong, which writes one character for two", () => {
      const { text, choices } = toScriptPieces(
        dictionary,
        scriptTables,
        "台北",
        { to: "zh-Hant-HK" },
      );
      assertIdentical(text, "台北");
      assertArrayEquals(
        choices.map((choice) => choice.evidence),
        ["locked", "locked"],
      );
    });

    it("credits the reading rather than calling it a guess", () => {
      const { choices } = toScriptPieces(dictionary, scriptTables, "头发", {
        to: "zh-Hant",
      });
      assertArrayEquals(
        choices.map((choice) => choice.evidence),
        ["locked", "reading"],
      );
    });

    it("leaves text already in the target script alone", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "准將", { to: "zh-Hant" }),
        "准將",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "群众", {
          to: "zh-Hant",
          from: "Hans",
        }),
        "群眾",
      );
    });

    it("converts orthography and not vocabulary", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "软件", { to: "zh-Hant" }),
        "軟件",
      );
    });
  });

  describe("candidates", () => {
    it(
      "finds the ü spellings the page tabulates, and 路 only from u",
      () => {
        const index = reverseIndex();
        for (const query of ["lvse", "lu:se", "lüse"]) {
          assertArrayEquals(candidates(index, query), ["綠色", "绿色"], query);
        }
        assertArrayEquals(candidates(index, "luse"), [
          "綠色",
          "绿色",
          "卢瑟",
          "盧瑟",
          "路涩",
          "路澀",
        ]);
      },
      INDEX_TIMEOUT,
    );

    it(
      "takes 儿化 with the r and without it",
      () => {
        const index = reverseIndex();
        assertArrayEquals(candidates(index, "wanr"), [
          "玩儿",
          "玩兒",
          "腕儿",
          "腕兒",
        ]);
        assertTrue(candidates(index, "wan").includes("玩儿"));
      },
      INDEX_TIMEOUT,
    );

    it(
      "refuses a half-typed query, since a reading key is a key",
      () => {
        assertArrayLength(candidates(reverseIndex(), "yinha"), 0);
      },
      INDEX_TIMEOUT,
    );

    it(
      "ranks the likeliest first, and takes the top on a limit",
      () => {
        assertArrayEquals(candidates(reverseIndex(), "beijing", { limit: 6 }), [
          "北京",
          "背景",
          "北境",
          "背静",
          "背靜",
          "倍經",
        ]);
      },
      INDEX_TIMEOUT,
    );

    it(
      "keeps whichever writing a script preference asks for",
      () => {
        const index = reverseIndex();
        assertArrayEquals(
          candidates(index, "yinhang", {
            script: { prefer: "Hant", tables: scriptTables },
          }),
          ["銀行", "引吭", "引航", "印航"],
        );
      },
      INDEX_TIMEOUT,
    );

    it(
      "lists homophones, and does not count the other writing as one",
      () => {
        const index = reverseIndex();
        assertArrayEquals(homophonesOf(index, "公式", { limit: 5 }), [
          "攻势",
          "攻勢",
          "公事",
          "宫室",
          "宮室",
        ]);
        assertArrayEquals(
          homophonesOf(index, "实施", {
            script: { prefer: "Hans", tables: scriptTables },
          }),
          ["石狮", "十失", "时失", "时师", "石师"],
        );
        assertArrayEquals(homophonesOf(index, "银行"), ["銀行"]);
        assertArrayLength(
          homophonesOf(index, "银行", {
            script: { prefer: "Hans", tables: scriptTables },
          }),
          0,
        );
      },
      INDEX_TIMEOUT,
    );

    it(
      "leaves out the 281 keys the dictionary cannot return",
      () => {
        const index = reverseIndex();
        // 校覈 derives to xiào hé and folds to a 校核 that reads jiào hé, so it is
        // offered under neither; 中峯 folds to a 中峰 already in the list.
        assertFalse(candidates(index, "xiaohe").includes("校覈"));
        assertTrue(candidates(index, "jiaohe").includes("校核"));
        const feng = candidates(index, "zhongfeng");
        assertTrue(feng.includes("中峰"));
        assertFalse(feng.includes("中峯"));
      },
      INDEX_TIMEOUT,
    );

    it(
      "holds the tier counts the page tabulates",
      () => {
        // Bracketed rather than pinned, the way `data.test.ts` brackets the
        // dictionary's own size. These are counts *derived* from the artifacts,
        // so a dictionary rebuild moves them a little without anything here
        // being wrong — re-ranking the readings in #73 moved the full tier's
        // from 201,379 to 201,378. A band still catches the failure that
        // matters, which is the index emptying out or doubling.
        assertNumberBetween(dictionary.size, 700_000, 750_000);
        assertNumberBetween(reverseIndex().size, 195_000, 210_000);
        assertNumberBetween(ReverseIndex.of(coreDictionary).size, 380, 440);
      },
      INDEX_TIMEOUT,
    );

    it(
      "gives the postings the page reads directly",
      () => {
        const index = reverseIndex();
        assertArrayEquals(
          [...index.positionsFor("yinhang")].map((at) => dictionary.wordAt(at)),
          ["銀行", "银行", "引吭", "引航", "印航"],
        );
      },
      INDEX_TIMEOUT,
    );

    it(
      "reaches the same index a slice at a time as in one go",
      () => {
        // The page shows a build driven from requestIdleCallback; this is that
        // loop, on the core tier so it is a test rather than a benchmark.
        const build = ReverseIndex.building(coreDictionary);
        let stepped = build.step(2000);
        while (stepped === undefined) {
          stepped = build.step(2000);
        }
        assertIdentical(build.progress, 1);
        assertIdentical(
          stepped.serialise().keys,
          ReverseIndex.of(coreDictionary).serialise().keys,
        );
      },
      INDEX_TIMEOUT,
    );
  });

  describe("matching", () => {
    it("matches the four ways the page opens on, and refuses the fifth", () => {
      for (const query of [
        "bjdx",
        "beijingdaxue",
        "bei jing da xue",
        "beijingdx",
        "bjdaxue",
      ]) {
        assertIdentical(matched("北京大学", query), "0+4", query);
      }
      assertUndefined(match(dictionary, "北京大学", "nanjing"));
    });

    it("takes every ü convention the page tabulates", () => {
      assertIdentical(matched("绿色", "lvse"), "0+2");
      assertIdentical(matched("绿色", "lu:se"), "0+2");
    });

    it("grows the match as the query is typed", () => {
      assertIdentical(matched("北京", "b"), "0+1");
      assertIdentical(matched("北京", "be"), "0+1");
      assertIdentical(matched("北京", "bei"), "0+1");
      assertIdentical(matched("北京", "beij"), "0+2");
    });

    it("holds a query to a tone it wrote as a digit, and not to a mark", () => {
      assertIdentical(matched("北京大学", "bei3jing1"), "0+2");
      assertIdentical(matched("北京大学", "bei1jing1"), "");
      // A mark is dropped rather than honoured, so it matches whatever tone.
      assertIdentical(matched("北京大学", "běijīng"), "0+2");
    });

    it("takes a written syllable boundary as one", () => {
      assertIdentical(matched("县城", "xian"), "0+1");
      assertIdentical(matched("县城", "xi an"), "");
      assertIdentical(matched("西安", "xi an"), "0+2");
    });

    it("matches a polyphone by either reading and ranks the right one up", () => {
      // The three the page names, each of them a reading the character has
      // and only one of them the reading this text takes.
      const pairs = [
        ["银行", "yh", "yx"],
        ["长江大桥", "cj", "zj"],
        ["重庆", "cq", "zq"],
      ] as const;
      for (const [text, inContext, other] of pairs) {
        assertIdentical(matched(text, inContext), "0+2", text);
        assertIdentical(matched(text, other), "0+2", text);
        assertTrue(scored(text, inContext) > scored(text, other), text);
      }
      assertIdentical(scored("银行", "yh"), 7);
      assertIdentical(scored("银行", "yx"), 5);
    });

    it("matches the 國語 reading, below the one the text takes", () => {
      assertIdentical(matched("垃圾", "lese"), "0+2");
      assertTrue(scored("垃圾", "laji") > scored("垃圾", "lese"));
    });

    it("ranks a word-initial match above one inside a word", () => {
      const query = "dx";
      const ranked = ["上海大学", "大学生活"]
        .map((text) => ({ text, found: match(dictionary, text, query) }))
        .filter((one) => one.found !== undefined)
        .toSorted(
          (first, second) =>
            (second.found?.score ?? 0) - (first.found?.score ?? 0),
        )
        .map((one) => one.text);
      assertArrayEquals(ranked, ["大学生活", "上海大学"]);
    });

    it("gives back the ranges, in code points, of what it matched", () => {
      assertIdentical(matched("我在北京大学学中文", "bjdx"), "2+4");
    });

    it("steps over what has no reading, and reports the rest as two", () => {
      assertIdentical(matched("北京·大学", "bjdx"), "0+2 3+2");
    });

    it("matches on the core tier, which is what the page promises", async () => {
      const core = await loadDictionary(fileSource(dataDirectory), "core");
      const found = match(core, "北京大学", "bjdx");
      assertNonNullable(found);
      assertArrayLength(found.ranges, 1);
      assertObjectEquals(found.ranges[0], { at: 0, length: 4 });
    });

    it("takes the r of 儿化 onto the syllable in front of it", () => {
      assertIdentical(matched("玩儿", "wanr"), "0+2");
      assertIdentical(matched("这儿", "zher"), "0+2");
      assertIdentical(matched("一点儿", "yidianr"), "0+3");
      // And the characters read as themselves still match, below it.
      assertIdentical(matched("玩儿", "wane"), "0+2");
      assertTrue(scored("玩儿", "wanr") > scored("玩儿", "wane"));
    });

    it("offers the r wherever an 儿 follows, and lets the reading rank it", () => {
      // 女儿 is nǚ'ér and not nǚr, so `nvr` is not how it is said — and it is
      // how plenty of people type it, so it finds the word and sorts below the
      // spelling that reads correctly rather than being refused.
      assertIdentical(matched("女儿", "nvr"), "0+2");
      assertIdentical(matched("女儿", "nver"), "0+2");
      assertTrue(scored("女儿", "nver") > scored("女儿", "nvr"));
    });

    it("does not guess at a typo in the middle of a query", () => {
      assertIdentical(matched("北京", "bejing"), "");
    });
  });

  describe("slug", () => {
    it("slugs the text the page opens on", () => {
      assertIdentical(
        slug(dictionary, "我想学中文。"),
        "wo3-xiang3-xue2-zhong1wen2",
      );
    });

    it("beats a slugifier working on the characters", () => {
      assertIdentical(slug(dictionary, "银行"), "yin2hang2");
      assertIdentical(slug(dictionary, "西安"), "xi1an1");
      assertIdentical(slug(dictionary, "中文"), "zhong1wen2");
      assertIdentical(
        slug(dictionary, "北京市银行"),
        "bei3jing1-shi4-yin2hang2",
      );
    });

    it("keeps the 隔音符号 as a break once the tones have gone", () => {
      assertIdentical(
        slug(dictionary, "西安交通大学", { tones: "none" }),
        "xi-an-jiaotong-daxue",
      );
    });

    it("writes the tones the page's two 重庆火锅 show", () => {
      assertIdentical(slug(dictionary, "重庆火锅"), "chong2qing4-huo3guo1");
      assertIdentical(
        slug(dictionary, "重庆火锅", { tones: "none" }),
        "chongqing-huoguo",
      );
    });

    it("runs the homophones together that the page says it does", () => {
      assertIdentical(slug(dictionary, "权利"), "quan2li4");
      assertIdentical(slug(dictionary, "权力"), "quan2li4");
      for (const text of ["树", "书", "输"]) {
        assertIdentical(slug(dictionary, text, { tones: "none" }), "shu");
      }
    });

    it("tells those homophones apart with the hash the page shows", () => {
      assertIdentical(
        slug(dictionary, "权利", { hash: true }),
        "quan2li4-1lpt",
      );
      assertIdentical(
        slug(dictionary, "权力", { hash: true }),
        "quan2li4-uta0",
      );
    });

    it("handles everything in a text that is not hanzi", () => {
      assertIdentical(slug(dictionary, "iPhone 15 发布"), "iphone-15-fa1bu4");
      assertIdentical(
        slug(dictionary, "《中文》：真好！"),
        "zhong1wen2-zhen1-hao3",
      );
      assertIdentical(slug(dictionary, "2024年报告"), "2024-nian2-bao4gao4");
      assertIdentical(
        slug(dictionary, "2024年报告", { numbers: "read" }),
        "er4-ling2-er4-si4-nian2-bao4gao4",
      );
    });

    it("falls back where a text slugs to nothing", () => {
      assertIdentical(
        slug(dictionary, "！？。", { fallback: "untitled" }),
        "untitled",
      );
    });

    it("cuts a long slug at a word", () => {
      assertIdentical(
        slug(dictionary, "北京市银行", { maxLength: 20 }),
        "bei3jing1-shi4",
      );
    });

    it("writes the search key the page recommends", () => {
      assertIdentical(
        slug(dictionary, "中文", { tones: "none", separator: "" }),
        "zhongwen",
      );
      assertIdentical(
        slug(dictionary, "西安", { tones: "none", separator: "" }),
        "xian",
      );
    });
  });

  describe("dictionaries", () => {
    it("reads a key, its bucket and its reading by position", () => {
      // The page's three positional calls, checked against the key rather than
      // against a fixed position, which a rebuild would move.
      const at = [...Array.from({ length: dictionary.size }).keys()].find(
        (position) => dictionary.wordAt(position) === "银行",
      );
      assertNonNullable(at);
      assertIdentical(dictionary.wordAt(at), "银行");
      assertIdentical(dictionary.readingsInOrder().readingAt(at), "yin2 hang2");
      assertTrue(dictionary.frequencyAt(at) > 0);
    });

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
      assertIdentical(dictionary.size, 723_147);
    });

    it("returns undefined for a word it does not have", () => {
      assertUndefined(dictionary.lookup("蛋糕店铺子"));
      assertFalse(dictionary.hasPrefix("蛋糕店"));
    });

    it("ranks words on the counts the page sweeps them out with", async () => {
      const counts = await loadWordCounts(fileSource(dataDirectory));
      // `WordCounts.size` is a plain number getter on a type that is neither a
      // Map nor a Set, so the rule's size assertions do not apply to it.
      assertIdentical(counts.size, dictionary.size);

      const corpusCount = new Map<string, number>();
      for (let at = 0; at < dictionary.size; at++) {
        corpusCount.set(dictionary.wordAt(at), counts.countOf(at));
      }

      // 正殿 and 毁灭 share a bucket, which is what the page opens on, and the
      // counts behind that bucket order them.
      assertArrayEquals(
        ["毁灭", "正殿"].toSorted(
          (left, right) =>
            (corpusCount.get(right) ?? 0) - (corpusCount.get(left) ?? 0),
        ),
        ["毁灭", "正殿"],
      );
      assertIdentical(corpusCount.get("䘚"), 0);
    });

    it("reads 银行 on standard and full but not on core", async () => {
      const core = await loadDictionary(fileSource(dataDirectory), "core");
      // `Dictionary.size` counts keys and is a plain number getter; the
      // rule's Map and Set assertions do not apply to it.
      assertIdentical(core.size, 16_976);
      assertIdentical(convert(core, "银行"), "yín xíng");
      assertIdentical(convert(core, "我要去北京。"), "Wǒ yào qù běi Jīng.");

      const standard = await loadDictionary(
        fileSource(dataDirectory),
        "standard",
      );
      // `Dictionary.size` counts keys and is a plain number getter; the
      // rule's Map and Set assertions do not apply to it.
      assertIdentical(standard.size, 97_998);
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
      // The 汉字 settle it where the spellings could not: 时 is not 十.
      assertIdentical(convert(dictionary, "当时一个人"), "dāngshí yí gè rén");
      assertIdentical(convert(dictionary, "那是一条狗"), "nà shì yìtiáo gǒu");
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

    it("applies the third tone over feet rather than syllables", () => {
      const said = { sandhi: { thirdTone: true } };
      assertIdentical(convert(dictionary, "展览馆", said), "zhánlánguǎn");
      assertIdentical(convert(dictionary, "纸老虎", said), "zhǐláohǔ");
      assertIdentical(convert(dictionary, "老板很好", said), "láobǎn hén hǎo");
      assertIdentical(convert(dictionary, "我也很好", said), "wó yé hén hǎo");
      assertIdentical(
        convert(dictionary, "这家银行的行长很喜欢旅行。", said),
        "Zhè jiā yínháng de hángzhǎng hén xǐhuan lǚxíng.",
      );
      // And the one the page names as given up: 好 leans backwards onto 保管.
      assertIdentical(convert(dictionary, "保管好", said), "báoguǎn hǎo");
    });

    it("takes a grouping where the reading alone does not say", () => {
      const reading = readWord("hángzhǎnghěnxǐhuan") ?? [];
      assertIdentical(
        written(applySandhi(reading, { thirdTone: true })),
        "háng zháng hén xǐ huan",
      );
      assertIdentical(
        written(applySandhi(reading, { thirdTone: true }, [2, 1, 2])),
        "háng zhǎng hén xǐ huan",
      );
    });
  });

  describe("scripts-and-locales", () => {
    it("converts either script without being told which", () => {
      assertIdentical(convert(dictionary, "银行"), "yínháng");
      assertIdentical(convert(dictionary, "銀行"), "yínháng");
      assertIdentical(convert(dictionary, "重複"), "chóngfù");
      assertIdentical(convert(dictionary, "重覆"), "chóngfù");
    });

    it("keys both 繁體 spellings of 重复 to the same entry", () => {
      const first = dictionary.lookup("重複");
      const second = dictionary.lookup("重覆");
      assertNonNullable(first);
      assertNonNullable(second);
      assertIdentical(written(first.reading), written(second.reading));
    });

    it("reads a rule's sentence the same way in either script", () => {
      // The tag every rule decides on is jieba's, and jieba counted 听 and not
      // 聽, so the 繁體 spelling takes the tag its 简体 word carries.
      assertIdentical(
        convert(dictionary, "我听过这首歌"),
        "wǒ tīngguo zhè shǒu gē",
      );
      assertIdentical(
        convert(dictionary, "我聽過這首歌"),
        "wǒ tīngguo zhè shǒu gē",
      );
      assertIdentical(dictionary.lookup("聽")?.partOfSpeech, "v");
      assertIdentical(convert(dictionary, "他錯了"), "tā cuòle");
    });

    // The page's point is what a *missing* key costs, so the assertion is on
    // the reading the character-by-character fallback would give: 重 alone is
    // `zhòng`, and only the entry says this word takes `chóng`.
    it("reads a 繁體 spelling that is not keyed character by character", () => {
      assertUndefined(dictionary.lookup("重覄"));
      assertIdentical(convert(dictionary, "重覄"), "zhòng fù");
      assertIdentical(convert(dictionary, "重"), "zhòng");
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

    it("writes the 两 that counts, as the page shows", () => {
      assertIdentical(numeralHanzi(2), "二");
      assertIdentical(numeralHanzi(2, { counts: true }), "两");
      assertIdentical(numeralHanzi(12, { counts: true }), "十二");
      assertIdentical(numeralHanzi(200, { counts: true }), "二百");
      assertIdentical(numeralHanzi(2, { counts: true, liang: "never" }), "二");
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

    it("counts with 两 in text, and labels with 二, as the page shows", () => {
      assertIdentical(
        convert(dictionary, "我们买了2个西瓜"),
        "wǒmen mǎile liǎng gè xīguā",
      );
      assertIdentical(convert(dictionary, "他2岁"), "tā liǎng suì");
      assertIdentical(convert(dictionary, "2点"), "liǎng diǎn");
      assertIdentical(convert(dictionary, "2万人"), "liǎng wàn rén");
      assertIdentical(convert(dictionary, "2月"), "èr yuè");
      assertIdentical(convert(dictionary, "2号"), "èr hào");
      assertIdentical(convert(dictionary, "第2次"), "dì èr cì");
      assertIdentical(convert(dictionary, "12个"), "shí'èr gè");
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
      assertIdentical(convert(dictionary, "1998年"), "yī jiǔ jiǔ bā nián");
      assertIdentical(convert(dictionary, "1个"), "yí gè");
    });

    it("writes a decimal as the counted word and then digits", () => {
      assertIdentical(
        convert(dictionary, "一共75.5元"),
        "yígòng qīshíwǔ diǎn wǔ yuán",
      );
      assertIdentical(convert(dictionary, "3.14"), "sān diǎn yī sì");
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
      // 事儿 has no rhyme for the ㄦ to attach to; 二儿 is ㄦㄦ. The mark goes on
      // the nucleus, in front of the suffix.
      assertIdentical(writeBopomofo(one("shìr")), "ㄕˋㄦ");
      assertIdentical(writeBopomofo(one("èrr")), "ㄦˋㄦ");
      assertIdentical(writeBopomofo(one("nǎr")), "ㄋㄚˇㄦ");
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
      // 李时珍 was one of the five the page recorded as a word boundary rather
      // than a hyphen defect. The 姓/名 rule supplies the boundary, so both
      // come out as the attested forms do — bar the ê a real text drops.
      assertIdentical(
        convertToWadeGiles(dictionary, "\u{674E}\u{65F6}\u{73CD}", {
          notation: "none",
        }),
        "Li Shih-ch\u{EA}n",
      );
      assertIdentical(
        convert(dictionary, "\u{674E}\u{65F6}\u{73CD}"),
        "L\u{1D0} Sh\u{ED}zh\u{113}n",
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
      assertArrayEquals(splitWadeGiles("hua\u{B9}-'rh"), ["hua\u{B9}-'rh"]);
      assertArrayEquals(splitWadeGiles("hua-\u{EA}rh"), ["hua", "\u{EA}rh"]);
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
      // that Yale and IPA each spell like a syllable plus 儿化. GR loses 128
      // to its 儿化 fusion, which collapses rimes the others keep apart.
      assertIdentical(wade, 5080);
      assertIdentical(bopomofo, 4240);
      assertIdentical(yale, 4239);
      assertIdentical(yaleNumbered, 5085);
      assertIdentical(gwoyeu, 4112);
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

    it("writes the neutral dot and the fused -l the page shows", () => {
      assertIdentical(writeGwoyeu(one("de5")), ".de");
      // The dot keeps the tone the syllable came from where it is recorded,
      // and takes the basic form where it is not.
      assertIdentical(
        writeGwoyeu({ ...one("you5"), originalTone: 3 }),
        ".yeou",
      );
      assertIdentical(writeGwoyeuWord([one("méi"), one("you5")]), "mei.iou");
      // 儿化 fuses into the rime rather than hanging off it.
      assertIdentical(writeGwoyeu(one("huār")), "hual");
      assertIdentical(writeGwoyeu(one("wánr")), "wal");
      assertIdentical(writeGwoyeu(one("shìr")), "shell");
      assertIdentical(writeGwoyeu(one("zhèr")), "jehl");
      assertIdentical(writeGwoyeu(one("diǎnr")), "deal");
      assertArrayEquals(
        readGwoyeu("shaan").map((syllable) => writeSyllable(syllable)),
        ["shǎn"],
      );
      assertArrayEquals(
        readGwoyeu("jiel").map((syllable) => writeSyllable(syllable)),
        ["jīr", "jīnr"],
      );
      assertArrayEquals(
        readGwoyeu("hual").map((syllable) => writeSyllable(syllable)),
        ["huār", "huānr"],
      );
      assertArrayEquals(
        readGwoyeu("ell").map((syllable) => writeSyllable(syllable)),
        ["èir", "ènr", "èr"],
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

    it("matches Lee & Zee's own example words, as the page claims", () => {
      // The IPA's Illustration of Standard Chinese — Lee & Zee (2003), JIPA
      // 33(1), 109-112 — is where the page's third table comes from. It is the
      // broad symbols this uses, with the narrow realisations stated apart from
      // them: [ai]=[aɪ], [uo]=[uo̝], and [a]=[a̠] in a syllable closed by a
      // nasal. So the two Wikipedia tables are a convention apart rather than
      // one of them being wrong, and this side of it is the IPA's own.
      for (const [pinyin, ipa] of [
        ["shuō", "ʂuo˥"],
        ["xiā", "ɕia˥"],
        ["huā", "xua˥"],
        ["xiāng", "ɕiaŋ˥"],
        ["āi", "ai˥"],
        ["āo", "au˥"],
        ["ōu", "ou˥"],
        ["hēi", "xei˥"],
        ["yī", "i˥"],
      ] as const) {
        assertIdentical(writeIpa(one(pinyin)), ipa, pinyin);
      }
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
      loadScriptTables: () => Promise.resolve(scriptTables),
    };

    async function cli(...argv: readonly string[]): Promise<readonly string[]> {
      const result = await runCli(argv, environment);
      assertIdentical(result.status, 0, result.errors.join("\n"));
      return result.output;
    }

    it("explains 长江大桥 as the page shows", async () => {
      assertArrayEquals(await cli("explain", "长江大桥"), [
        "长江大桥  Cháng Jiāng Dàqiáo",
        "  Cháng   word    zhǎng +14.6",
        "  Jiāng   locked",
        "  Dà      word    dài +12.6",
        "  qiáo    locked",
      ]);
    });

    it("filters and ranks by a pinyin query, as the page shows", async () => {
      assertArrayEquals(
        await cli(
          "match",
          "--query",
          "bjdx",
          "北京大学",
          "我在北京大学学中文",
          "上海大学",
        ),
        [
          "[北京大学]  7.00",
          "我在[北京大学]学中文  6.33",
          "上海大学  no match",
        ],
      );
      // And the query forms the section lists, each finding the same word.
      const forms = ["beijing", "bei jing", "bj", "beij", "bei3jing1"];
      const found = await Promise.all(
        forms.map(async (query) => cli("match", "--query", query, "北京")),
      );
      assertArrayEquals(
        found.flat(),
        forms.map(() => "[北京]  7.00"),
      );
    });

    it("checks the three answers the page marks", async () => {
      assertArrayEquals(await cli("check", "银行", "yínxíng"), [
        "银行  yínháng  50%",
        "  银     yín     yín     correct",
        "  行     háng    xíng    wrong",
      ]);
      assertArrayEquals(await cli("check", "北京", "bei3jing3"), [
        "北京  Běijīng  50%",
        "  北     běi     bei3    correct",
        "  京     jīng    jing3   tone",
      ]);
      assertArrayEquals(
        await cli("check", "银行", "yín háng", "--require-spacing"),
        [
          "银行  yínháng  50%",
          "  银     yín     yín     correct",
          "  行     háng    háng    correct   split",
        ],
      );
    });

    it("joins the arguments after the first, as the page shows", async () => {
      assertArrayIncludes(
        await cli("check", "北京市", "běijīng", "shì"),
        "北京市  Běijīng Shì  100%",
      );
    });

    it("reads a tab-separated pair per line, as the page shows", async () => {
      const piped: CliEnvironment = {
        ...environment,
        readInput: () => Promise.resolve("银行\tyínxíng\n北京\tbei3jing3\n"),
      };
      const result = await runCli(["check"], piped);
      assertIdentical(result.status, 0, result.errors.join("\n"));
      assertArrayIncludes(result.output, "银行  yínháng  50%");
      assertArrayIncludes(result.output, "北京  Běijīng  50%");
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

    it("writes the capitals only where the system has them, as the page shows", async () => {
      assertArrayEquals(
        await cli("convert", "--system", "yale", "我去银行。他姓王。"),
        ["Wǒ chyù yínháng. Tā syìng Wáng."],
      );
      assertArrayEquals(
        await cli("convert", "--system", "ipa", "我去银行。他姓王。"),
        ["uo˨˩˦ tɕʰy˥˩ in˧˥xaŋ˧˥. tʰa˥ ɕiŋ˥˩ uaŋ˧˥."],
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
        ".ell        enr       ˙ㄣㄦ         ên⁵-'rh     enr       .ell      ənɚ",
        "            err       ˙ㄦㄦ         êrh⁵-'rh    err       .ell      aɚɚ",
        "            er        ˙ㄦ          êrh⁵        er        .ell      aɚ",
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
