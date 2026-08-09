import {
  dictionaryOf,
  entry,
  reading,
  sampleDictionary,
  sampleScriptTables,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayIncludes,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertObjectEquals,
  assertStringIncludes,
  assertStringLength,
  assertStringNotIncludes,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { COMMANDS } from "./commands.js";
import { type CliEnvironment, runCli } from "./run.js";

const dictionary = sampleDictionary();

const environment: CliEnvironment = {
  version: "0.0.0",
  colours: 0,
  readInput: () => Promise.resolve(""),
  loadDictionary: () => Promise.resolve(dictionary),
  loadScriptTables: () => Promise.resolve(sampleScriptTables()),
};

/**
 * Run the CLI over the shared test dictionary and return what it wrote.
 */
async function cli(...argv: readonly string[]): Promise<readonly string[]> {
  const result = await runCli(argv, environment);
  assertIdentical(result.status, 0, result.errors.join("\n"));
  return result.output;
}

/**
 * The same, with `--json`, parsed back into the one document it wrote.
 */
async function json(...argv: readonly string[]): Promise<unknown> {
  const written = await cli(...argv, "--json");
  assertArrayLength(written, 1);
  return JSON.parse(written[0]) as unknown;
}

describe("the convert command", () => {
  it("writes one conversion per argument", async () => {
    assertArrayEquals(await cli("convert", "银行", "北京"), [
      "yínháng",
      "Běijīng",
    ]);
  });

  it("passes the conversion options through", async () => {
    assertArrayEquals(await cli("convert", "-n", "numbers", "银行"), [
      "yin2hang2",
    ]);
    assertArrayEquals(await cli("convert", "--capitals", "none", "北京"), [
      "běijīng",
    ]);
    assertArrayEquals(await cli("convert", "--no-grouping", "北京市"), [
      "Běijīngshì",
    ]);
  });

  it("writes the conversion in another system", async () => {
    assertArrayEquals(await cli("convert", "--system", "wade-giles", "北京"), [
      "Pei³-ching¹",
    ]);
  });

  it("leaves the capital off the systems that have none", async () => {
    // 北京 is a proper noun and takes a capital in the three romanisations,
    // which are ways of writing Chinese in the Latin alphabet. IPA is not one:
    // it writes symbols, and [P] is not [p] made bigger but a symbol the IPA
    // has not got. Bopomofo is a script without case and says the same.
    assertArrayEquals(await cli("convert", "--system", "ipa", "北京"), [
      "pei˨˩˦tɕiŋ˥",
    ]);
    assertArrayEquals(await cli("convert", "--system", "bopomofo", "北京"), [
      "ㄅㄟˇ ㄐㄧㄥ",
    ]);
  });

  it("decodes with the greedy baseline when asked", async () => {
    // The one case the two decoders read differently: greedy takes 银行 because
    // it is the longest match at the first character and never revisits it.
    const overlap = dictionaryOf([
      entry("银", "yín", { frequency: 4000 }),
      entry("行", "xíng", { alternates: [reading("háng")] }),
      entry("长", "zhǎng", { frequency: 40 }),
      entry("银行", "yín háng", { frequency: 40 }),
      entry("行长", "háng zhǎng", { frequency: 400_000 }),
    ]);
    const overlapping: CliEnvironment = {
      ...environment,
      loadDictionary: () => Promise.resolve(overlap),
    };
    const greedy = await runCli(["convert", "--greedy", "银行长"], overlapping);
    const lattice = await runCli(["convert", "银行长"], overlapping);
    assertArrayEquals(greedy.output, ["yínháng zhǎng"]);
    assertArrayEquals(lattice.output, ["yín hángzhǎng"]);
  });
});

describe("writing JSON", () => {
  it("writes one document per answer, not one array for the run", async () => {
    const written = await cli("convert", "银行", "北京", "--json");
    assertArrayLength(written, 2);
    assertObjectEquals(JSON.parse(written[0]), {
      text: "银行",
      pinyin: "yínháng",
    });
  });

  it("reports a syllable's state and what it beat", async () => {
    assertObjectEquals(await json("explain", "银行"), {
      text: "银行",
      pinyin: "yínháng",
      syllables: [
        { text: "yín", state: "locked", tone: 2, alternatives: [] },
        {
          text: "háng",
          state: "word",
          tone: 2,
          alternatives: [
            { reading: "xíng", cost: 48.62 },
            { reading: "héng", cost: 50.62 },
          ],
        },
      ],
    });
  });

  it("rounds a cost to something worth printing", async () => {
    // The per-word charge is 4.62, so an unrounded cost lands on
    // 48.620000000000005 as often as not.
    const explained = await json("explain", "银行");
    assertStringNotIncludes(JSON.stringify(explained), "0000000");
  });

  it("reports a word's entry as fields rather than columns", async () => {
    assertObjectEquals(await json("lookup", "垃圾"), {
      word: "垃圾",
      found: true,
      reading: "lā jī",
      partOfSpeech: "",
      isProperNoun: false,
      taiwanReading: "lè sè",
      otherReadings: [],
    });
    assertObjectEquals(await json("lookup", "囧"), {
      word: "囧",
      found: false,
    });
  });

  it("reports a syllable's parts", async () => {
    assertObjectEquals(await json("syllable", "wánr"), {
      text: "wánr",
      read: true,
      syllables: [
        {
          spelling: "wánr",
          initial: "",
          final: "uan",
          tone: 2,
          erhua: true,
          isAttested: true,
          marks: "wánr",
          numbers: "wanr2",
          superscript: "wanr²",
        },
      ],
    });
  });

  it("says in the data when something could not be read", async () => {
    assertObjectEquals(await json("sandhi", "xyz"), {
      text: "xyz",
      read: false,
    });
  });

  it("reports what is loaded", async () => {
    assertObjectEquals(await json("info", "--tier", "core"), {
      tier: "core",
      keys: 33,
      attestedSyllables: 415,
      inventorySpellings: 424,
    });
  });
});

describe("the html command", () => {
  it("writes one element per syllable", async () => {
    assertArrayEquals(await cli("html", "银行"), [
      '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span>' +
        '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>',
    ]);
  });

  it("leaves the classes off when asked", async () => {
    assertArrayEquals(await cli("html", "--no-tone-classes", "银"), [
      '<span class="py-syllable" lang="zh-Latn-CN-pinyin">yín</span>',
    ]);
  });

  it("leaves the language off when asked", async () => {
    assertArrayEquals(await cli("html", "--no-lang", "银"), [
      '<span class="py-syllable py-tone-2">yín</span>',
    ]);
  });

  it("declares the reading standard it was asked for", async () => {
    assertArrayEquals(await cli("html", "--locale", "zh-TW", "银"), [
      '<span class="py-syllable py-tone-2" lang="zh-Latn-TW-pinyin">yín</span>',
    ]);
  });
});

describe("the segment command", () => {
  it("writes the split, then a line for each word", async () => {
    assertArrayEquals(await cli("segment", "行长银行"), [
      "行长 / 银行",
      "  行长  háng zhǎng",
      "  银行  yín háng",
    ]);
  });

  it("shows a stretch that was never Han as itself", async () => {
    // Part of the text and not part of the segmentation, so it is written
    // with a dash where a tag would go rather than left out.
    assertArrayEquals(await cli("segment", "银行。"), [
      "银行 / 。",
      "  银行  yín háng",
      "  。  —",
    ]);
  });

  it("reports the position and the flags as JSON", async () => {
    assertObjectEquals(await json("segment", "北京。"), {
      text: "北京。",
      words: [
        {
          text: "北京",
          at: 0,
          reading: "běi jīng",
          partOfSpeech: "ns",
          isProperNoun: true,
          isKnown: true,
        },
        {
          text: "。",
          at: 2,
          reading: "",
          partOfSpeech: "",
          isProperNoun: false,
          isKnown: false,
        },
      ],
    });
  });
});

describe("the slug command", () => {
  it("writes one slug per argument", async () => {
    assertArrayEquals(await cli("slug", "银行", "北京市"), [
      "yin2hang2",
      "bei3jing1-shi4",
    ]);
  });

  it("passes the slug options through", async () => {
    assertArrayEquals(await cli("slug", "--tones", "none", "银行"), [
      "yinhang",
    ]);
    assertArrayEquals(await cli("slug", "--separator", "_", "北京市"), [
      "bei3jing1_shi4",
    ]);
    assertArrayEquals(await cli("slug", "--syllables", "separate", "北京"), [
      "bei3-jing1",
    ]);
    assertArrayEquals(await cli("slug", "--max-length", "9", "北京市银行"), [
      "bei3jing1",
    ]);
    assertArrayEquals(await cli("slug", "--fallback", "untitled", "！"), [
      "untitled",
    ]);
    assertArrayEquals(await cli("slug", "--locale", "zh-TW", "垃圾"), [
      "le4se4",
    ]);
  });

  it("keeps the digits unless asked to say them", async () => {
    assertArrayEquals(await cli("slug", "3个"), ["3-ge4"]);
    assertArrayEquals(await cli("slug", "--read-numbers", "3个"), ["san1-ge4"]);
  });

  it("writes a hash of the length asked for", async () => {
    const [plain] = await cli("slug", "银行");
    const [hashed] = await cli("slug", "--hash", "银行");
    const [longer] = await cli("slug", "--hash-length", "6", "银行");
    assertNonNullable(plain);
    assertNonNullable(hashed);
    assertNonNullable(longer);
    assertStringLength(hashed, plain.length + 5);
    assertStringLength(longer, plain.length + 7);
  });

  it("is never coloured, whatever the terminal offers", async () => {
    const result = await runCli(["slug", "银行", "--colour"], environment);
    assertArrayEquals(result.output, ["yin2hang2"]);
  });

  it("reports a length that is not a number", async () => {
    const result = await runCli(
      ["slug", "--max-length", "lots", "银行"],
      environment,
    );
    assertIdentical(result.status, 1);
    assertStringIncludes(result.errors.join("\n"), "--max-length");
  });

  it("refuses a flag that would change nothing", async () => {
    const result = await runCli(
      ["slug", "--capitals", "none", "银行"],
      environment,
    );
    assertIdentical(result.status, 1);
    assertStringIncludes(result.errors.join("\n"), "slug does not take");
  });

  it("writes the slug as JSON", async () => {
    assertObjectEquals(await json("slug", "银行"), {
      text: "银行",
      slug: "yin2hang2",
    });
  });
});

describe("the script command", () => {
  it("converts to 繁體 when asked", async () => {
    assertArrayEquals(await cli("script", "银行", "--to", "zh-Hant"), ["銀行"]);
  });

  it("converts to 简体 by default", async () => {
    assertArrayEquals(await cli("script", "銀行"), ["银行"]);
  });

  it("takes a region", async () => {
    assertArrayEquals(await cli("script", "银行", "--to", "zh-Hant-TW"), [
      "銀行",
    ]);
    assertArrayEquals(await cli("script", "银行", "--to", "zh-Hant-HK"), [
      "銀行",
    ]);
  });

  it("converts one text per argument", async () => {
    assertArrayEquals(await cli("script", "银行", "北京", "--to", "zh-Hant"), [
      "銀行",
      "北京",
    ]);
  });

  it("takes the input script where detection cannot tell", async () => {
    assertArrayEquals(
      await cli("script", "银行", "--to", "zh-Hant", "--from-script", "Hans"),
      ["銀行"],
    );
  });

  it("rejects a target it does not write", async () => {
    const result = await runCli(
      ["script", "银行", "--to", "zh-Hunt"],
      environment,
    );
    assertIdentical(result.status, 1);
    assertStringIncludes(result.errors.join("\n"), "--to must be one of");
  });

  it("reports the evidence per character in JSON", async () => {
    // 银 comes out uncertain against this miniature fixture, where two entries
    // are the whole of the evidence. Against the shipped tables it is locked;
    // what is asserted here is the shape, not the verdict.
    const written = await json("script", "银行", "--to", "zh-Hant");
    assertObjectEquals(written, {
      text: "银行",
      script: "銀行",
      to: "zh-Hant",
      characters: [
        { from: "银", to: "銀", evidence: "default" },
        { from: "行", to: "行", evidence: "locked" },
      ],
      uncertain: ["银"],
    });
  });
});

describe("the explain command", () => {
  it("reports each syllable and how settled it was", async () => {
    const lines = await cli("explain", "银行");
    assertArrayEquals(lines, [
      "银行  yínháng",
      "  yín     locked",
      "  háng    word    xíng +48.6  héng +50.6",
    ]);
  });

  it("calls a bare polyphone a guess, and lists what it beat", async () => {
    const lines = await cli("explain", "行");
    assertStringIncludes(lines[1] ?? "", "guess");
    assertStringIncludes(lines[1] ?? "", "háng +1.0");
  });
});

describe("the lookup command", () => {
  it("reports a word's reading and tags", async () => {
    assertArrayEquals(await cli("lookup", "北京"), [
      "北京  běi jīng  ns, proper noun",
    ]);
  });

  it("reports a Taiwan reading where the word has one", async () => {
    assertArrayEquals(await cli("lookup", "垃圾"), [
      "垃圾  lā jī",
      "  zh-TW  lè sè",
    ]);
  });

  it("reports a character's other readings", async () => {
    assertArrayEquals(await cli("lookup", "行"), [
      "行  xíng",
      "  also   háng, héng",
    ]);
  });

  it("says so when the dictionary has nothing", async () => {
    assertArrayEquals(await cli("lookup", "囧"), ["囧  not in the dictionary"]);
  });
});

describe("the syllable command", () => {
  it("splits a written word and takes each syllable apart", async () => {
    const lines = await cli("syllable", "nǐhǎo");
    assertIdentical(lines[0], "nǐhǎo  nǐ hǎo");
    assertStringIncludes(lines[1] ?? "", "n + i, tone 3");
    assertStringIncludes(lines[1] ?? "", "nǐ  ni3  ni³");
  });

  it("writes the underlying initial and final, not the spelling", async () => {
    // 玩儿 is wánr: no initial at all, and the final is uan.
    const lines = await cli("syllable", "wánr");
    assertStringIncludes(lines[1] ?? "", "∅ + uan");
    assertStringIncludes(lines[1] ?? "", "儿化");
  });

  it("marks a well-formed spelling Mandarin does not use", async () => {
    const lines = await cli("syllable", "shong");
    assertStringIncludes(lines[1] ?? "", "not attested");
  });

  it("says so when it cannot be read as pinyin at all", async () => {
    assertArrayEquals(await cli("syllable", "xyz"), [
      "xyz  not readable as pinyin",
    ]);
  });

  it("needs no dictionary", async () => {
    let loaded = 0;
    const counted: CliEnvironment = {
      ...environment,
      loadDictionary: () => {
        loaded++;
        return Promise.resolve(dictionary);
      },
    };
    await runCli(["syllable", "nǐhǎo"], counted);
    assertIdentical(loaded, 0);
  });
});

describe("the sandhi command", () => {
  it("writes the tones the orthography writes", async () => {
    assertArrayEquals(await cli("sandhi", "bùshì"), ["bùshì  bú shì"]);
  });

  it("takes the sandhi flags", async () => {
    assertArrayEquals(await cli("sandhi", "--no-sandhi", "bùshì"), [
      "bùshì  bù shì",
    ]);
    assertArrayEquals(await cli("sandhi", "--third-tone", "nǐhǎo"), [
      "nǐhǎo  ní hǎo",
    ]);
  });

  it("says so when it cannot be read as pinyin at all", async () => {
    assertArrayEquals(await cli("sandhi", "xyz"), [
      "xyz  not readable as pinyin",
    ]);
  });
});

describe("the number command", () => {
  it("counts by default and spells out with --digits", async () => {
    assertArrayEquals(await cli("number", "2026"), [
      "2026        两千零二十六            liǎng qiān líng èr shí liù",
    ]);
    assertArrayEquals(await cli("number", "--digits", "2026"), [
      "2026        二〇二六              èr líng èr liù",
    ]);
  });

  it("sandhis a quantity and leaves a spelled-out digit alone", async () => {
    // 一百 is said `yìbǎi`; 110 read out is `yāo yāo líng`, never `yì yì líng`.
    assertArrayEquals(await cli("number", "100"), [
      "100         一百                yì bǎi",
    ]);
    assertArrayEquals(await cli("number", "--digits", "--yao", "110"), [
      "110         一一〇               yāo yāo líng",
    ]);
  });

  it("stops the sandhi at the decimal point", async () => {
    assertArrayEquals(await cli("number", "3.14"), [
      "3.14        三点一四              sān diǎn yī sì",
    ]);
  });

  it("reverses a percentage", async () => {
    assertArrayEquals(await cli("number", "--percent", "95"), [
      "95          百分之九十五            bǎi fēn zhī jiǔ shí wǔ",
    ]);
  });

  it("writes 二 for 两 when asked", async () => {
    assertArrayEquals(await cli("number", "--no-liang", "2000"), [
      "2000        二千                èr qiān",
    ]);
  });

  it("says so when it is not a number", async () => {
    assertArrayEquals(await cli("number", "3D"), ["3D  not a number"]);
    assertObjectEquals(await json("number", "3D"), { text: "3D", read: false });
  });

  it("reports the reading as data", async () => {
    assertObjectEquals(await json("number", "--digits", "2019"), {
      text: "2019",
      hanzi: "二〇一九",
      pinyin: "èr líng yī jiǔ",
      style: "digits",
    });
  });

  it("loads no dictionary, since reading a number needs none", async () => {
    let loaded = 0;
    const counted = {
      ...environment,
      loadDictionary: () => {
        loaded += 1;
        return Promise.resolve(dictionary);
      },
    };
    await runCli(["number", "2026"], counted);
    assertIdentical(loaded, 0);
  });
});

describe("the transcribe command", () => {
  it("writes pinyin in every system", async () => {
    assertArrayEquals(await cli("transcribe", "běijīng"), [
      "běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   beeijing  pei˨˩˦tɕiŋ˥",
    ]);
  });

  it("reads bopomofo without being told what it is", async () => {
    assertArrayEquals(await cli("transcribe", "ㄅㄟˇ"), [
      "ㄅㄟˇ         běi       ㄅㄟˇ         pei³        běi       beei      pei˨˩˦",
    ]);
  });

  it("reads Wade-Giles, marking what needed a mark put back", async () => {
    assertArrayEquals(await cli("transcribe", "--from", "wade-giles", "chu¹"), [
      "chu¹        zhū       ㄓㄨ          chu¹        jū        ju        ʈʂu˥",
      "            chū       ㄔㄨ          ch'u¹       chū       chu       ʈʂʰu˥       marks restored",
      "            jū        ㄐㄩ          chü¹        jyū       jiu       tɕy˥        marks restored",
      "            qū        ㄑㄩ          ch'ü¹       chyū      chiu      tɕʰy˥       marks restored",
    ]);
  });

  it("reads Yale, GR and IPA when told which one it is", async () => {
    assertArrayEquals(await cli("transcribe", "--from", "yale", "syī"), [
      "syī         xī        ㄒㄧ          hsi¹        syī       shi       ɕi˥",
    ]);
    assertArrayEquals(await cli("transcribe", "--from", "ipa", "tɕiou˥˩"), [
      "tɕiou˥˩     jiù       ㄐㄧㄡˋ        chiu⁴       jyòu      jiow      tɕiou˥˩",
    ]);
    assertArrayEquals(await cli("transcribe", "--from", "gwoyeu", "jiow"), [
      "jiow        jiù       ㄐㄧㄡˋ        chiu⁴       jyòu      jiow      tɕiou˥˩",
    ]);
    // GR's 儿化 fusion puts 二 and two rhotacised rimes on the same spelling,
    // and every reading of it comes back.
    assertArrayEquals(await cli("transcribe", "--from", "gwoyeu", "ell"), [
      "ell         èir       ㄟˋㄦ         ei⁴-'rh     èir       ell       eiɚ˥˩",
      "            ènr       ㄣˋㄦ         ên⁴-'rh     ènr       ell       ənɚ˥˩",
      "            èr        ㄦˋ          êrh⁴        èr        ell       aɚ˥˩",
    ]);
    assertArrayEquals(await cli("transcribe", "--from", "gwoyeu", ".ell"), [
      ".ell        enr       ˙ㄣㄦ         ên⁵-'rh     enr       .ell      ənɚ",
      "            err       ˙ㄦㄦ         êrh⁵-'rh    err       .ell      aɚɚ",
      "            er        ˙ㄦ          êrh⁵        er        .ell      aɚ",
    ]);
  });

  it("reports the readings as data", async () => {
    assertObjectEquals(
      await json("transcribe", "--from", "wade-giles", "chi"),
      {
        text: "chi",
        read: true,
        readings: [
          {
            pinyin: "ji",
            bopomofo: "ㄐㄧ",
            wadeGiles: "chi",
            yale: "ji",
            gwoyeu: "ji",
            ipa: "tɕi",
            isExact: true,
          },
          {
            pinyin: "qi",
            bopomofo: "ㄑㄧ",
            wadeGiles: "ch'i",
            yale: "chi",
            gwoyeu: "chi",
            ipa: "tɕʰi",
            isExact: false,
          },
        ],
      },
    );
  });

  it("says so when it cannot read the text at all", async () => {
    assertArrayEquals(await cli("transcribe", "zzz"), ["zzz  not readable"]);
    // A regular Wade-Giles spelling of a syllable Mandarin does not have.
    assertArrayEquals(
      await cli("transcribe", "--from", "wade-giles", "shung"),
      ["shung  not readable"],
    );
  });

  it("reads a whole Wade-Giles word, hyphens or none", async () => {
    // One row rather than a candidate list: `maotsetung` splits five ways
    // before any of its syllables has been chosen, so what is shown is the
    // reading the module settles on. See docs/romanization/.
    assertArrayEquals(
      await cli("transcribe", "--from", "wade-giles", "maotsetung"),
      [
        "maotsetung  maocedong ㄇㄠ ㄘㄜ ㄉㄨㄥ   mao-ts'ê-tung  mautsedung  mhautsedong  mautsʰɤtʊŋ  marks restored",
      ],
    );
    const solid = await cli("transcribe", "--from", "wade-giles", "maotsetung");
    assertArrayEquals(
      await cli("transcribe", "--from", "wade-giles", "mao-tse-tung"),
      solid.map((one) => one.replace("maotsetung", "mao-tse-tung")),
    );
  });

  it("widens its columns for a cell that does not fit one", async () => {
    // A word is wider than a syllable and the widths were sized for syllables.
    // Every cell keeps at least one space after it, which is what the fixed
    // widths gave the widest syllable anyway.
    const [line] = await cli(
      "transcribe",
      "--from",
      "wade-giles",
      "kuomintang",
    );
    assertNonNullable(line);
    assertStringIncludes(line, "kuo-min-tang");
    assertStringNotIncludes(line, "kuo-min-tangkuomintang");
    for (const cell of ["guomindang", "kuo-min-tang"]) {
      assertStringIncludes(line, `${cell} `);
    }
  });

  it("loads no dictionary, since a transcription needs none", async () => {
    let loaded = 0;
    const counted = {
      ...environment,
      loadDictionary: () => {
        loaded += 1;
        return Promise.resolve(dictionary);
      },
    };
    await runCli(["transcribe", "běijīng"], counted);
    assertIdentical(loaded, 0);
  });
});

describe("the info command", () => {
  it("reports what is loaded", async () => {
    const lines = await cli("info");
    assertArrayIncludes(lines, "tier       full");
    assertStringIncludes(lines[1] ?? "", "the artifacts that shipped");
    assertStringIncludes(lines[2] ?? "", "keys");
  });

  it("reports the directory it was pointed at", async () => {
    assertArrayIncludes(
      await cli("info", "--data", "./elsewhere"),
      "data       ./elsewhere",
    );
  });
});

describe("the command list", () => {
  it("gives every command a summary and an argument line", () => {
    for (const command of COMMANDS) {
      assertIdentical(command.summary.trim(), command.summary);
      assertIdentical(command.name.trim(), command.name);
    }
  });
});
