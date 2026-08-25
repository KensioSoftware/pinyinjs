import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertMapSize,
  assertNonNullable,
  assertObjectEquals,
  assertStringIncludes,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { isUncertain } from "./decode/confidence.js";
import { convert, convertPieces, joinPieces } from "./decode/convert.js";
import { check } from "./grade/check.js";
import { type CliEnvironment, runCli } from "./cli/run.js";
import { convertToAnnotatedHtml, convertToHtml } from "./format/html.js";
import { BOPOMOFO } from "./transcription/systems.js";
import { toScript } from "./decode/script.js";
import { applySandhi } from "./decode/sandhi.js";
import { segment } from "./decode/segment.js";
import { match } from "./search/match.js";
import { candidates, homophonesOf } from "./search/candidates.js";
import { ReverseIndex } from "./search/reverse-index.js";
import {
  numeralHanzi,
  percentHanzi,
  readNumeral,
} from "./numerals/numerals.js";
import { Dictionary } from "./dictionary/dictionary.js";
import { COMMANDS } from "./cli/commands.js";
import { fileSource } from "./dictionary/node-source.js";
import { loadDictionary, loadScriptTables } from "./dictionary/source.js";
import { writeBopomofo } from "./transcription/bopomofo.js";
import { writeGwoyeu } from "./transcription/gwoyeu.js";
import { writeIpa } from "./transcription/ipa.js";
import {
  readWadeGilesLoosely,
  writeWadeGiles,
} from "./transcription/wade-giles.js";
import { writeYale } from "./transcription/yale.js";
import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
} from "./syllable/inventory.js";
import { readWord, splitSyllables } from "./syllable/split.js";
import {
  isSyllable,
  readSyllable,
  type Syllable,
  writeSyllable,
} from "./syllable/syllable.js";
import {
  applyToneMark,
  stripToneMarks,
  toneFromMarks,
} from "./tone/tone-mark.js";
import { NEUTRAL_TONE } from "./tone/tone.js";

/**
 * Every example the README shows, run against the committed dictionary.
 *
 * The README claimed three things that were not true when it was written —
 * that `readSyllable("shong")` returns undefined, that 行 has three readings,
 * and that 好好 converts with a space — and none of them would have been caught
 * by reading it. Documentation drifts silently in the other direction too, as
 * soon as behaviour changes underneath it.
 *
 * **Update this file and the README together.** A failure here means one of
 * them is now lying to somebody. The README quotes no accuracy figures any
 * more — `pnpm accuracy` and `pnpm polyphones` report them, and ROADMAP.md
 * records them — so what is guarded here is every example it shows.
 */
const dataDirectory = fileURLToPath(new URL("../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");
const scriptTables = await loadScriptTables(fileSource(dataDirectory));

/**
 * The CLI, against the same committed dictionary and a fixed version.
 */
const environment: CliEnvironment = {
  version: "0.0.0",
  colours: 0,
  readInput: () => Promise.resolve(""),
  loadDictionary: () => Promise.resolve(dictionary),
  loadScriptTables: () => Promise.resolve(scriptTables),
};

/**
 * Run the CLI as the README shows it being run.
 */
async function cli(...argv: readonly string[]): Promise<readonly string[]> {
  const result = await runCli(argv, environment);
  assertIdentical(result.status, 0, result.errors.join("\n"));
  return result.output;
}

/**
 * The pieces of a conversion the decoder was guessing at, as the README filters
 * for them.
 */
function guesses(text: string): readonly string[] {
  return convertPieces(dictionary, text)
    .filter(
      (piece) =>
        piece.confidence !== undefined && isUncertain(piece.confidence),
    )
    .map((piece) => piece.text);
}

/**
 * Long enough to derive the reverse index over the full tier, which is about
 * half a second and is not what any of these tests is timing.
 */
const INDEX_TIMEOUT = 10_000;

let derived: ReverseIndex | undefined;

/**
 * The reverse index, derived once and only where a test asks for it.
 *
 * Lazily, because deriving it is too much to charge to the import cost of every
 * other test in the file.
 */
function reverseIndex(): ReverseIndex {
  derived ??= ReverseIndex.of(dictionary);
  return derived;
}

/**
 * Where a query matched, each range as `at+length`.
 */
function rangesOf(haystack: string, query: string): readonly string[] {
  return (match(dictionary, haystack, query)?.ranges ?? []).map(
    (range) => `${String(range.at)}+${String(range.length)}`,
  );
}

/**
 * A reading written out, for readable expectations.
 */
function written(syllables: readonly Syllable[]): string {
  return syllables.map((syllable) => writeSyllable(syllable)).join(" ");
}

/**
 * The README itself, read rather than transcribed.
 *
 * The command table listed seven of the nine commands for two releases, because
 * nothing executed it — the same failure the accuracy table had. A table of
 * names is checkable against the names, so it is checked.
 */
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

/**
 * The rows of the command table, as `name` and `does` pairs.
 */
function commandRows(): ReadonlyMap<string, string> {
  // Only the table under "## Command line": the README has other two-column
  // tables and one of them lists the library's functions.
  const section = readme.split("\n## ").find((part) => {
    return part.startsWith("Command line");
  });
  assertNonNullable(section);
  const rows = new Map<string, string>();
  for (const line of section.split("\n")) {
    const found = /^\|\s*`(?<name>\w+)`\s*\|(?<does>[^|]*)\|$/u.exec(line);
    const name = found?.groups?.["name"];
    const does = found?.groups?.["does"];
    if (name !== undefined && does !== undefined) {
      rows.set(name, does.trim());
    }
  }
  return rows;
}

describe("the command table in README.md", () => {
  it("lists every command, in the order the CLI lists them", () => {
    // The names and their order, not the wording: the README shortens two of
    // the summaries because it has no room for them, and that is a choice
    // rather than a defect. A missing *command* is the thing that went wrong.
    const rows = commandRows();
    assertArrayEquals(
      [...rows.keys()],
      COMMANDS.map((command) => command.name),
    );
    assertMapSize(rows, COMMANDS.length);
    // And every one of them says something.
    assertArrayLength(
      [...rows.values()].filter((does) => does !== ""),
      COMMANDS.length,
    );
  });
});

describe("the examples in README.md", () => {
  describe("converting hanzi", () => {
    it("converts the three words shown", () => {
      assertIdentical(convert(dictionary, "银行"), "yínháng");
      assertIdentical(convert(dictionary, "行长"), "hángzhǎng");
      assertIdentical(
        convert(dictionary, "我要去北京。"),
        "Wǒ yào qù Běijīng.",
      );
    });

    it("converts 长城 on the standard tier, as the browser example does", async () => {
      const standard = await loadDictionary(
        fileSource(dataDirectory),
        "standard",
      );
      assertIdentical(convert(standard, "长城"), "Chángchéng");
    });
  });

  describe("the options shown", () => {
    it("takes the locale's reading", () => {
      assertIdentical(convert(dictionary, "垃圾"), "lājī");
      assertIdentical(convert(dictionary, "垃圾", { locale: "zh-TW" }), "lèsè");
    });

    it("writes the notation asked for", () => {
      assertIdentical(
        convert(dictionary, "银行", { notation: "numbers" }),
        "yin2hang2",
      );
      assertIdentical(
        convert(dictionary, "银行", { notation: "superscript" }),
        "yin²hang²",
      );
      assertIdentical(
        convert(dictionary, "银行", { notation: "none" }),
        "yinhang",
      );
    });

    it("writes third-tone sandhi when asked", () => {
      assertIdentical(
        convert(dictionary, "好好", { sandhi: { thirdTone: true } }),
        "háohǎo",
      );
    });

    it("writes the curated 正词法 list examples", () => {
      assertIdentical(convert(dictionary, "不是"), "bú shì");
      assertIdentical(convert(dictionary, "一个"), "yí gè");
      assertIdentical(convert(dictionary, "黄河"), "Huáng Hé");
      assertIdentical(convert(dictionary, "中国人"), "Zhōngguórén");
      // The counterparts the list deliberately leaves out.
      assertIdentical(convert(dictionary, "不但"), "búdàn");
      assertIdentical(convert(dictionary, "大米"), "dàmǐ");
      assertIdentical(convert(dictionary, "青海"), "Qīnghǎi");
    });

    it("reads the numbers in text the README shows", () => {
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
        convert(dictionary, "6:30起床"),
        "liù diǎn sānshí fēn qǐchuáng",
      );
      assertIdentical(convert(dictionary, "16:9的"), "16:9de");
    });

    it("reads the numbers the README reads", () => {
      assertIdentical(numeralHanzi(12_345), "一万两千三百四十五");
      assertIdentical(numeralHanzi(1005), "一千零五");
      assertIdentical(numeralHanzi(2000), "两千");
      assertIdentical(numeralHanzi(2, { counts: true }), "两");
      assertIdentical(percentHanzi(95), "百分之九十五");
      assertIdentical(numeralHanzi(2026), "两千零二十六");
      assertIdentical(numeralHanzi(2026, { style: "digits" }), "二〇二六");
      assertIdentical(
        (readNumeral(110, { style: "digits", yao: true }) ?? [])
          .map((syllable) => writeSyllable(syllable))
          .join(" "),
        "yāo yāo líng",
      );
    });

    it("romanises the syllable the README romanises", () => {
      const jiu = readSyllable("jiù");
      assertNonNullable(jiu);
      assertIdentical(writeBopomofo(jiu), "ㄐㄧㄡˋ");
      assertIdentical(writeWadeGiles(jiu), "chiu⁴");
      assertIdentical(writeYale(jiu), "jyòu");
      assertIdentical(writeGwoyeu(jiu), "jiow");
      assertIdentical(writeIpa(jiu), "tɕiou˥˩");
      // 陝西 is Shaanxi and 山西 is Shanxi, which is GR's third tone.
      assertArrayEquals(
        ["shān", "shán", "shǎn", "shàn"].map((pinyin) => {
          const read = readSyllable(pinyin);
          assertNonNullable(read, pinyin);
          return writeGwoyeu(read);
        }),
        ["shan", "sharn", "shaan", "shann"],
      );
      assertArrayEquals(
        readWadeGilesLoosely("chi¹").map((syllable) => writeSyllable(syllable)),
        ["jī", "qī"],
      );
      assertArrayEquals(
        readWadeGilesLoosely("chu¹").map((syllable) => writeSyllable(syllable)),
        ["zhū", "chū", "jū", "qū"],
      );
    });

    it("settles the readings the rules are shown settling", () => {
      assertIdentical(convert(dictionary, "我得走了"), "wǒ děi zǒule");
      assertIdentical(convert(dictionary, "他跑得很快"), "tā pǎo de hěn kuài");
      assertIdentical(convert(dictionary, "那边儿"), "nà biānr");
    });

    it("hyphenates the reduplications shown", () => {
      assertIdentical(convert(dictionary, "干干净净"), "gāngān-jìngjìng");
      assertIdentical(convert(dictionary, "研究研究"), "yánjiū-yánjiū");
      // The same shape, arriving as two words, which it is.
      assertIdentical(convert(dictionary, "爸爸妈妈"), "bàba māma");
    });

    it("hyphenates a listed 成语 and leaves the rest solid", () => {
      assertIdentical(convert(dictionary, "风平浪静"), "fēngpíng-làngjìng");
      assertIdentical(convert(dictionary, "不亦乐乎"), "búyìlèhū");
    });

    it("writes the orthography options shown", () => {
      assertIdentical(convert(dictionary, "西安"), "Xī'ān");
      assertIdentical(
        convert(dictionary, "海鸥", { apostrophe: "standard" }),
        "hǎiōu",
      );
      assertIdentical(
        convert(dictionary, "北京。", { punctuation: "keep" }),
        "Běijīng。",
      );
      assertIdentical(
        convert(dictionary, "北京。", { capitals: "none" }),
        "běijīng.",
      );
    });

    it("writes the apostrophes and grouping the orthography section shows", () => {
      assertIdentical(convert(dictionary, "天安门"), "Tiān'ānmén");
      assertIdentical(convert(dictionary, "女儿"), "nǚ'ér");
      assertIdentical(convert(dictionary, "你好，世界"), "nǐ hǎo, shìjiè");
      assertIdentical(convert(dictionary, "他看了"), "tā kànle");
      assertIdentical(convert(dictionary, "作者"), "zuòzhě");
      assertIdentical(convert(dictionary, "南京市"), "Nánjīng Shì");
      assertIdentical(
        convert(dictionary, "南京市", { grouping: false }),
        "Nánjīngshì",
      );
      assertIdentical(
        convert(dictionary, "我还给你了。"),
        "Wǒ huán gěi nǐ le.",
      );
    });

    it("reads a digit and leaves the rest of the non-Han as written", () => {
      assertIdentical(convert(dictionary, "3D银行"), "sān D yínháng");
    });
  });

  describe("the command line", () => {
    it("converts as the README shows", async () => {
      assertArrayEquals(await cli("convert", "我要去北京。"), [
        "Wǒ yào qù Běijīng.",
      ]);
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
      assertArrayEquals(await cli("convert", "--notation", "numbers", "银行"), [
        "yin2hang2",
      ]);
    });

    it("checks as the README shows", async () => {
      assertArrayEquals(await cli("check", "银行", "yínxíng"), [
        "银行  yínháng  50%",
        "  银     yín     yín     correct",
        "  行     háng    xíng    wrong",
      ]);
    });

    it("explains as the README shows", async () => {
      assertArrayEquals(await cli("explain", "银行"), [
        "银行  yínháng",
        "  yín     locked",
        "  háng    word    xíng +14.6  héng +16.6  hàng +17.6",
      ]);
    });

    it("looks a word up as the README shows", async () => {
      assertArrayEquals(await cli("lookup", "头发"), ["头发  tóu fa  n"]);
    });

    it("filters by a pinyin query as the README shows", async () => {
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
    });

    it("takes a syllable apart as the README shows", async () => {
      assertArrayEquals(await cli("syllable", "nǐhǎo"), [
        "nǐhǎo  nǐ hǎo",
        "  nǐ        n + i, tone 3         nǐ  ni3  ni³",
        "  hǎo       h + ao, tone 3        hǎo  hao3  hao³",
      ]);
    });

    it("romanises from the command line as the README shows", async () => {
      assertArrayEquals(await cli("transcribe", "běijīng"), [
        "běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   beeijing  pei˨˩˦tɕiŋ˥",
      ]);
    });

    it("writes the JSON the README pipes into jq", async () => {
      const explained = await cli("explain", "长江大桥", "--json");
      assertArrayLength(explained, 1);
      assertObjectEquals(JSON.parse(explained[0]), {
        text: "长江大桥",
        pinyin: "Cháng Jiāng Dàqiáo",
        syllables: [
          {
            text: "Cháng",
            state: "word",
            tone: 2,
            alternatives: [{ reading: "zhǎng", cost: 14.62 }],
          },
          { text: "Jiāng", state: "locked", tone: 1, alternatives: [] },
          {
            text: "Dà",
            state: "word",
            tone: 4,
            alternatives: [{ reading: "dài", cost: 12.62 }],
          },
          { text: "qiáo", state: "locked", tone: 2, alternatives: [] },
        ],
      });

      const looked = await cli("lookup", "垃圾", "--json");
      assertArrayLength(looked, 1);
      assertObjectEquals(JSON.parse(looked[0]), {
        word: "垃圾",
        found: true,
        reading: "lā jī",
        partOfSpeech: "n",
        isProperNoun: false,
        taiwanReading: "lè sè",
        otherReadings: [],
      });
    });

    it("has every command the README lists", async () => {
      const help = await cli();
      for (const command of [
        "convert",
        "html",
        "match",
        "explain",
        "lookup",
        "syllable",
        "sandhi",
        "info",
      ]) {
        assertStringIncludes(help.join("\n"), command);
      }
    });
  });

  describe("confidence, and what was rejected", () => {
    it("reports the pieces and the alternatives shown for 银行", () => {
      const pieces = convertPieces(dictionary, "银行");
      assertArrayEquals(
        pieces.map((piece) => piece.text),
        ["yín", "háng"],
      );
      assertIdentical(joinPieces(pieces), convert(dictionary, "银行"));

      const [yin, hang] = pieces;
      assertNonNullable(yin);
      assertNonNullable(hang);
      assertObjectEquals(hang.syllable, {
        initial: "h",
        final: "ang",
        tone: 2,
      });
      assertTrue(yin.confidence?.isLocked ?? false);
      assertArrayEquals(
        (hang.confidence?.alternatives ?? []).map((found) =>
          written(found.reading),
        ),
        ["xíng", "héng", "hàng"],
      );
    });

    it("finds the guesses the README's filter finds", () => {
      assertArrayEquals(guesses("行"), ["xíng"]);
      assertArrayLength(guesses("银行"), 0);
    });

    it("calls 行 in 银行 backed by a word rather than locked", () => {
      const inWord = convertPieces(dictionary, "银行")[1]?.confidence;
      assertNonNullable(inWord);
      assertFalse(inWord.isLocked);
      assertFalse(isUncertain(inWord));
    });

    it("marks up 行 exactly as the HTML section shows", () => {
      assertIdentical(
        convertToHtml(dictionary, "行"),
        '<span class="py-syllable py-tone-2 py-uncertain" ' +
          'lang="zh-Latn-CN-pinyin" ' +
          'data-alternatives="háng héng hàng">xíng</span>',
      );
    });

    it("annotates 银行 exactly as the annotated section shows", () => {
      assertStringIncludes(
        convertToAnnotatedHtml(dictionary, "银行"),
        '<ruby lang="zh">银<rp>(</rp><rt>' +
          '<span class="py-syllable py-tone-2" ' +
          'lang="zh-Latn-CN-pinyin">yín</span></rt><rp>)</rp></ruby>',
      );
    });

    it("annotates 银 in bopomofo exactly as the section shows", () => {
      assertIdentical(
        convertToAnnotatedHtml(dictionary, "银", { transcription: BOPOMOFO }),
        '<ruby lang="zh">银<rp>(</rp><rt>' +
          '<span class="py-syllable py-tone-2" ' +
          'lang="zh-Bopo-CN">ㄧㄣˊ</span></rt><rp>)</rp></ruby>',
      );
    });

    it("annotates 玩儿 and 95% whole, as the section says it does", () => {
      const erhua = convertToAnnotatedHtml(dictionary, "玩儿");
      assertStringIncludes(erhua, '<ruby lang="zh">玩儿<rp>(</rp>');
      assertStringIncludes(erhua, ">wánr</span>");
      const number = convertToAnnotatedHtml(dictionary, "95%");
      assertStringIncludes(number, '<ruby lang="zh">95%<rp>(</rp>');
      assertArrayLength(number.match(/<ruby/gu) ?? [], 1);
    });
  });

  describe("segmenting", () => {
    it("splits 南京市长江大桥 the way the section shows", () => {
      assertArrayEquals(
        segment(dictionary, "南京市长江大桥").map((found) => found.text),
        ["南京市", "长江", "大桥"],
      );
    });

    it("reports the fields the section shows for 我要去北京。", () => {
      const found = segment(dictionary, "我要去北京。");
      assertArrayEquals(
        found.map((one) => one.text),
        ["我", "要", "去", "北京", "。"],
      );
      const beijing = found[3];
      assertNonNullable(beijing);
      assertIdentical(beijing.partOfSpeech, "ns");
      assertTrue(beijing.isProperNoun);
      assertIdentical(beijing.at, 3);
    });

    it("rejoins into the text, as the section claims", () => {
      const text = "我要去北京。";
      assertIdentical(
        segment(dictionary, text)
          .map((one) => one.text)
          .join(""),
        text,
      );
    });

    it("leaves the word spacing to the conversion", () => {
      assertArrayEquals(
        segment(dictionary, "他看了").map((one) => one.text),
        ["他", "看", "了"],
      );
      assertIdentical(convert(dictionary, "他看了"), "tā kànle");
    });
  });

  describe("matching a pinyin query", () => {
    it("matches the three the section shows", () => {
      assertArrayEquals(rangesOf("北京大学", "bjdx"), ["0+4"]);
      assertArrayEquals(rangesOf("北京大学", "beijing"), ["0+2"]);
      assertUndefined(match(dictionary, "北京大学", "nanjing"));
    });

    it("scores 银行 as the section scores it, by either reading", () => {
      assertIdentical(match(dictionary, "银行", "yh")?.score, 7);
      assertIdentical(match(dictionary, "银行", "yx")?.score, 5);
    });
  });

  describe("pinyin to hanzi", () => {
    it(
      "answers the four queries the section shows",
      () => {
        const index = reverseIndex();
        // 時 ranks beside 时 because the merge carries the count across the
        // scripts. Before it did, 時 looked all but unattested.
        assertArrayEquals(candidates(index, "shi", { limit: 5 }), [
          "是",
          "时",
          "時",
          "事",
          "使",
        ]);
        assertArrayEquals(candidates(index, "yinhang"), [
          "銀行",
          "银行",
          "引吭",
          "引航",
          "印航",
        ]);
        assertArrayEquals(candidates(index, "yínháng"), ["銀行", "银行"]);
        assertArrayEquals(homophonesOf(index, "长城"), [
          "長城",
          "長程",
          "长程",
          "常程",
        ]);
      },
      INDEX_TIMEOUT,
    );

    it(
      "takes the ü and 儿化 spellings the section claims",
      () => {
        const index = reverseIndex();
        for (const query of ["lv", "lu:", "lu"]) {
          assertTrue(candidates(index, query).includes("绿"), query);
        }
        for (const query of ["wanr", "wan"]) {
          assertTrue(candidates(index, query).includes("玩儿"), query);
        }
      },
      INDEX_TIMEOUT,
    );

    it(
      "keeps one writing of a word when given a script preference",
      () => {
        const index = reverseIndex();
        assertArrayEquals(
          candidates(index, "yinhang", {
            script: { prefer: "Hans", tables: scriptTables },
          }),
          ["银行", "引吭", "引航", "印航"],
        );
      },
      INDEX_TIMEOUT,
    );
  });

  describe("checking what somebody typed", () => {
    it("marks 银行 typed yínxíng the way the section shows", () => {
      const marked = check(dictionary, "银行", "yínxíng");
      assertArrayEquals(
        marked.syllables.map((one) => one.verdict),
        ["correct", "wrong"],
      );
      assertIdentical(marked.syllables[1]?.source, "行");
      assertIdentical(marked.score, 0.5);
    });

    it("passes every answer the section calls fair", () => {
      assertTrue(check(dictionary, "北京", "bei3jīng").isCorrect);
      assertTrue(check(dictionary, "行", "háng").isCorrect);
      assertTrue(check(dictionary, "你好", "ní hǎo").isCorrect);
      assertTrue(check(dictionary, "不是", "bù shì").isCorrect);
      assertTrue(check(dictionary, "海鸥", "hǎiōu").isCorrect);
      assertTrue(check(dictionary, "我的书", "wǒ de shū").isCorrect);
    });

    it("counts a missing tone only where the caller asks for tones", () => {
      assertTrue(check(dictionary, "北京", "bei jing").isCorrect);
      assertFalse(
        check(dictionary, "北京", "bei jing", { tones: "required" }).isCorrect,
      );
    });

    it("reports the spacing beside the verdict, as the section shows", () => {
      const split = check(dictionary, "银行", "yín háng");
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

    it("takes either spacing convention, as the section shows", () => {
      const graded = { spacing: "required" } as const;
      assertTrue(check(dictionary, "他看了", "tā kànle", graded).isCorrect);
      assertTrue(check(dictionary, "他看了", "tā kàn le", graded).isCorrect);
      assertTrue(
        check(dictionary, "干干净净", "gāngān jìngjìng", graded).isCorrect,
      );
      assertFalse(
        check(dictionary, "我要去北京。", "wǒyàoqùběijīng", graded).isCorrect,
      );
    });
  });

  describe("looking words up", () => {
    it("reports the fields the README shows for 头发", () => {
      const entry = dictionary.lookup("头发");
      assertNonNullable(entry);
      assertIdentical(written(entry.reading), "tóu fa");
      assertFalse(entry.isProperNoun);
      assertIdentical(entry.partOfSpeech, "n");
    });

    it("finds the same reading under 繁體", () => {
      const entry = dictionary.lookup("頭髮");
      assertIdentical(written(entry?.reading ?? []), "tóu fa");
    });

    it("finds a word under either of its 繁體 spellings", () => {
      assertIdentical(
        written(dictionary.lookup("重複")?.reading ?? []),
        "chóng fù",
      );
      assertIdentical(
        written(dictionary.lookup("重覆")?.reading ?? []),
        "chóng fù",
      );
    });

    it("answers a prefix query", () => {
      assertTrue(dictionary.hasPrefix("银"));
    });

    it("gives 行 all four of its readings, likeliest first", () => {
      assertArrayEquals(
        dictionary.readingsOf("行").map((found) => written(found)),
        ["xíng", "háng", "héng", "hàng"],
      );
    });
  });

  describe("syllables", () => {
    it("parses both notations to the same syllable", () => {
      const marked = readSyllable("jiù");
      assertNonNullable(marked);
      assertIdentical(marked.initial, "j");
      assertIdentical(marked.final, "iou");
      assertIdentical(marked.tone, 4);
      assertIdentical(
        JSON.stringify(readSyllable("jiu4")),
        JSON.stringify(marked),
      );
    });

    it("reads the v convention for ü", () => {
      assertIdentical(readSyllable("lv4")?.final, "ü");
    });

    it("returns undefined for something that is not a syllable at all", () => {
      assertUndefined(readSyllable("hello"));
    });

    it("accepts 儿化 as a suffix", () => {
      assertTrue(isSyllable("wánr"));
    });

    it("rejects both notations on one syllable", () => {
      assertUndefined(readSyllable("běi3"));
    });

    it("parses a well-formed spelling Mandarin does not use", () => {
      // The distinction the README draws: parsing is about well-formedness,
      // the inventory is about what is attested.
      assertNonNullable(readSyllable("shong"));
      assertFalse(DICTIONARY_SYLLABLES.has("shong"));
      assertTrue(DICTIONARY_SYLLABLES.has("zhuang"));
      assertArrayLength(ATTESTED_SYLLABLES, 415);
    });

    it("writes a syllable in each notation", () => {
      const jiu: Syllable = { initial: "j", final: "iou", tone: 4 };
      assertIdentical(writeSyllable(jiu), "jiù");
      assertIdentical(writeSyllable(jiu, "numbers"), "jiu4");
      assertIdentical(writeSyllable(jiu, "superscript"), "jiu⁴");
      assertIdentical(writeSyllable(jiu, "none"), "jiu");
    });

    it("splits the written words shown", () => {
      assertArrayEquals(splitSyllables("nǐhǎo") ?? [], ["nǐ", "hǎo"]);
      assertArrayEquals(splitSyllables("Xī'ān") ?? [], ["Xī", "ān"]);
      assertArrayEquals(splitSyllables("yinhang") ?? [], ["yin", "hang"]);
      assertArrayEquals(splitSyllables("guórén") ?? [], ["guó", "rén"]);
      assertArrayEquals(splitSyllables("hǎiōu") ?? [], ["hǎi", "ōu"]);
      assertIdentical(written(readWord("yínháng") ?? []), "yín háng");
    });
  });

  describe("tones", () => {
    it("applies and strips a tone mark", () => {
      assertIdentical(applyToneMark("hao", 3), "hǎo");
      assertIdentical(applyToneMark("hao", NEUTRAL_TONE), "hao");
      assertIdentical(stripToneMarks("hǎo"), "hao");
      assertIdentical(toneFromMarks("hǎo"), 3);
    });
  });

  describe("sandhi", () => {
    it("flattens 不 before a fourth tone", () => {
      const flattened = applySandhi(readWord("bùshì") ?? []);
      assertIdentical(written(flattened), "bú shì");
    });

    it("leaves third-tone sandhi unwritten by default", () => {
      const niHao = readWord("nǐhǎo") ?? [];
      const plain = applySandhi(niHao);
      const sandhied = applySandhi(niHao, { thirdTone: true });
      assertIdentical(written(plain), "nǐ hǎo");
      assertIdentical(written(sandhied), "ní hǎo");
    });

    it("can be switched off", () => {
      const untouched = applySandhi(readWord("bùshì") ?? [], { yiBu: false });
      assertIdentical(written(untouched), "bù shì");
    });
  });

  describe("simplified and traditional", () => {
    it("converts the sentence the section opens on", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "我们后来发现了头发问题", {
          to: "zh-Hant",
        }),
        "我們後來發現了頭髮問題",
      );
    });

    it("splits 发 on the reading, as the section claims", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "头发", { to: "zh-Hant" }),
        "頭髮",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "出发", { to: "zh-Hant" }),
        "出發",
      );
    });

    it("runs both ways over 乾", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "乾燥", { to: "zh-Hans" }),
        "干燥",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "乾隆", { to: "zh-Hans" }),
        "乾隆",
      );
    });

    it("targets a region", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "面包", { to: "zh-Hant-TW" }),
        "麵包",
      );
      assertIdentical(
        toScript(dictionary, scriptTables, "面包", { to: "zh-Hant-HK" }),
        "麪包",
      );
    });

    it("reads Hong Kong 繁體 exactly as its Taiwan spelling", () => {
      assertIdentical(convert(dictionary, "羣眾"), convert(dictionary, "群眾"));
      assertIdentical(convert(dictionary, "麪包"), convert(dictionary, "麵包"));
    });

    it("converts orthography and not vocabulary", () => {
      assertIdentical(
        toScript(dictionary, scriptTables, "软件", { to: "zh-Hant" }),
        "軟件",
      );
    });
  });

  describe("the figures quoted", () => {
    it("has the entry count the README claims", () => {
      // 461,555 entries; the key count is higher because both scripts are keys.
      assertTrue(dictionary.size > 700_000);
    });

    it("wraps an artifact the same way whichever source fetched it", () => {
      // fetchSource and fileSource are two adapters behind one interface, so
      // the browser example assembles a Dictionary exactly like this one.
      const empty = Dictionary.from({
        keys: "",
        entries: "",
        frequencies: new Uint8Array(),
      });
      // `Dictionary.size` counts keys and is a plain number getter; the
      // rule's Map and Set assertions do not apply to it.
      assertIdentical(empty.size, 0);
    });
  });
});
