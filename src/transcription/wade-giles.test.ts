import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertObjectEquals,
  assertSetSize,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { DICTIONARY_SYLLABLES, SYLLABLE_TONES } from "../syllable/inventory.js";
import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  readWadeGilesWord,
  splitWadeGiles,
  writeWadeGiles,
  writeWadeGilesSpelling,
  writeWadeGilesWord,
} from "./wade-giles.js";

/**
 * A pinyin syllable, parsed, for a readable expectation.
 */
function syllable(
  pinyin: string,
): NonNullable<ReturnType<typeof readSyllable>> {
  const read = readSyllable(pinyin);
  assertNonNullable(read, pinyin);
  return read;
}

/**
 * What a pinyin syllable is spelled as in Wade-Giles, without its tone.
 */
function spelt(pinyin: string): string {
  return writeWadeGilesSpelling(syllable(pinyin));
}

/**
 * What a Wade-Giles spelling reads back as, in pinyin.
 */
function read(spelling: string): readonly string[] {
  return readWadeGiles(spelling).map((found) => writeSyllable(found));
}

/**
 * The same, allowing for the marks a real text drops.
 */
function readLoosely(spelling: string): readonly string[] {
  return readWadeGilesLoosely(spelling).map((found) => writeSyllable(found));
}

/**
 * What a whole Wade-Giles word reads back as, written out.
 */
function readingOf(text: string): readonly string[] {
  return (readWadeGilesWord(text) ?? []).map((one) => writeSyllable(one));
}

describe("writing Wade-Giles", () => {
  it("shifts the whole stop series, so pinyin b is p", () => {
    assertIdentical(spelt("bā"), "pa");
    assertIdentical(spelt("pà"), "p'a");
    assertIdentical(spelt("dà"), "ta");
    assertIdentical(spelt("tài"), "t'ai");
    assertIdentical(spelt("gāo"), "kao");
    assertIdentical(spelt("kǒu"), "k'ou");
  });

  it("writes the two ch series and hs", () => {
    assertIdentical(spelt("jī"), "chi");
    assertIdentical(spelt("qī"), "ch'i");
    assertIdentical(spelt("zhī"), "chih");
    assertIdentical(spelt("chī"), "ch'ih");
    assertIdentical(spelt("xī"), "hsi");
    assertIdentical(spelt("rì"), "jih");
  });

  it("writes the empty rhyme after the dental sibilants as ŭ", () => {
    assertIdentical(spelt("zī"), "tzŭ");
    assertIdentical(spelt("cí"), "tz'ŭ");
    assertIdentical(spelt("sì"), "ssŭ");
    // And the plain forms elsewhere in the same series.
    assertIdentical(spelt("zuò"), "tso");
    assertIdentical(spelt("sù"), "su");
  });

  it("respells the finals the system respells after particular initials", () => {
    // -e is ê, but o after the velars.
    assertIdentical(spelt("dé"), "tê");
    assertIdentical(spelt("gē"), "ko");
    assertIdentical(spelt("hé"), "ho");
    // -uo drops its u after the dentals and retroflexes, but not after sh.
    assertIdentical(spelt("zuò"), "tso");
    assertIdentical(spelt("zhuō"), "cho");
    assertIdentical(spelt("ruò"), "jo");
    assertIdentical(spelt("shuō"), "shuo");
    assertIdentical(spelt("guó"), "kuo");
    // -ui keeps its middle vowel after the velars only.
    assertIdentical(spelt("duì"), "tui");
    assertIdentical(spelt("guì"), "kuei");
    assertIdentical(spelt("huì"), "hui");
  });

  it("writes the finals that change shape wherever they stand", () => {
    assertIdentical(spelt("yán"), "yen");
    assertIdentical(spelt("jiàn"), "chien");
    assertIdentical(spelt("èr"), "êrh");
    assertIdentical(spelt("xué"), "hsüeh");
    assertIdentical(spelt("yuè"), "yüeh");
    assertIdentical(spelt("dōng"), "tung");
    assertIdentical(spelt("qióng"), "ch'iung");
  });

  it("writes the two u finals that collide once their marks go", () => {
    // 有 and 魚 are `yu` and `yü`, one diaeresis apart.
    assertIdentical(spelt("yǒu"), "yu");
    assertIdentical(spelt("yú"), "yü");
  });

  it("writes the tone as a raised digit, and on the line when asked", () => {
    assertIdentical(writeWadeGiles(syllable("jiù")), "chiu⁴");
    assertIdentical(
      writeWadeGiles(syllable("jiù"), { tones: "numbers" }),
      "chiu4",
    );
    assertIdentical(writeWadeGiles(syllable("jiù"), { tones: "none" }), "chiu");
    assertIdentical(writeWadeGiles(syllable("de5")), "tê⁵");
    // An unwritten tone stays unwritten rather than becoming a first tone.
    assertIdentical(writeWadeGiles(syllable("jiu")), "chiu");
  });

  it("writes 儿化 as the separate syllable the system writes it as", () => {
    assertIdentical(writeWadeGiles(syllable("wánr")), "wan-êrh²");
    assertIdentical(spelt("gēr"), "ko-êrh");
  });

  it("hyphenates the syllables of a word", () => {
    assertIdentical(
      writeWadeGilesWord([syllable("běi"), syllable("jīng")]),
      "pei³-ching¹",
    );
    assertIdentical(
      writeWadeGilesWord([syllable("máo"), syllable("zé"), syllable("dōng")], {
        tones: "none",
      }),
      "mao-tsê-tung",
    );
  });
});

describe("reading Wade-Giles", () => {
  it("reads a spelling back to pinyin, tone and all", () => {
    assertArrayEquals(read("chiu⁴"), ["jiù"]);
    assertArrayEquals(read("chiu4"), ["jiù"]);
    assertArrayEquals(read("hsüeh²"), ["xué"]);
    assertArrayEquals(read("ssŭ"), ["si"]);
  });

  it("takes every shape of the aspiration mark, and any capitalisation", () => {
    for (const mark of ["'", "ʻ", "ʼ", "‘", "’", "`", "´"]) {
      assertArrayEquals(read(`ch${mark}i¹`), ["qī"]);
    }
    assertArrayEquals(read("Ch'ing²"), ["qíng"]);
  });

  it("reads the alternative spellings the sources also write", () => {
    assertArrayEquals(read("i"), ["yi"]);
    assertArrayEquals(read("yi"), ["yi"]);
    assertArrayEquals(read("ch'uo¹"), ["chuō"]);
    assertArrayEquals(read("ch'o¹"), ["chuō"]);
  });

  it("gives back more than one syllable where the system is ambiguous", () => {
    // Correctly written Wade-Giles is still not injective, in two places.
    assertArrayEquals(read("lo"), ["luo", "lo"]);
    assertArrayEquals(read("o¹"), ["ō", "ē"]);
  });

  it("drops the candidates whose tone Mandarin does not write", () => {
    // `lo` is 羅 luó and 咯 lo, and 咯 is only ever neutral, so the tone
    // settles it wherever one is written. The neutral tone is the one place
    // both syllables are real and the ambiguity survives.
    assertArrayEquals(read("lo²"), ["luó"]);
    assertArrayEquals(read("lo⁵"), ["luo", "lo"]);
  });

  it("narrows across the exact and loose readings together", () => {
    // `pan` exactly is 半 pan, which has no second tone; the reading worth
    // keeping is the 盤 pán of a text that dropped an apostrophe. Untoned,
    // both are real and both come back.
    assertArrayEquals(readLoosely("pan²"), ["pán"]);
    assertArrayEquals(readLoosely("pan"), ["ban", "pan"]);
  });

  it("narrows to nothing, and so hands back what it had", () => {
    // 覅 fiào is written in the fourth tone and in no other. A text writing
    // `fiao²` has the tone wrong rather than the spelling, and saying so is
    // not this function's job.
    assertArrayEquals(read("fiao⁴"), ["fiào"]);
    assertArrayEquals(read("fiao²"), ["fiáo"]);
  });

  it("reads the 儿化 syllable back as a suffix", () => {
    assertArrayEquals(read("wan-êrh²"), ["wánr"]);
    assertArrayEquals(readLoosely("wan-erh²"), ["wánr"]);
    // Standing alone it is 兒 itself.
    assertArrayEquals(read("êrh²"), ["ér"]);
  });

  it("reads nothing for what is not Wade-Giles", () => {
    assertArrayLength(read(""), 0);
    assertArrayLength(read("zhi"), 0);
    assertArrayLength(read("ㄓ"), 0);
    // A regular Wade-Giles spelling of a syllable Mandarin does not have.
    assertArrayLength(read("shung"), 0);
  });
});

describe("reading Wade-Giles that dropped its marks", () => {
  it("offers what was written first and the repairs after it", () => {
    // `chi` is a correct spelling of jī, and also what `ch'i` looks like once
    // the apostrophe is gone.
    assertArrayEquals(readLoosely("chi¹"), ["jī", "qī"]);
    assertArrayEquals(readLoosely("tai⁴"), ["dài", "tài"]);
    // Neither spelling is exact here — 資 is `tzŭ` and 此 is `tz'ŭ` — so the
    // candidates come back in inventory order rather than led by one of them.
    assertArrayEquals(readLoosely("tzu³"), ["cǐ", "zǐ"]);
  });

  it("finds four syllables under the worst of them", () => {
    assertArrayEquals(readLoosely("chu¹"), ["zhū", "chū", "jū", "qū"]);
    assertArrayEquals(readLoosely("chun¹"), ["zhūn", "chūn", "jūn", "qūn"]);
  });

  it("recovers a spelling that is not correct Wade-Giles at all", () => {
    // `hsueh` for `hsüeh`, `erh` for `êrh`, `ssu` for `ssŭ`: none of these is
    // a spelling anything writes, so nothing is lost by reading them.
    assertArrayEquals(readLoosely("hsueh²"), ["xué"]);
    assertArrayEquals(readLoosely("erh²"), ["ér"]);
    assertArrayEquals(readLoosely("ssu⁴"), ["sì"]);
  });

  it("allows for the marks that are missing and not the ones that are there", () => {
    // `chʻu` kept its apostrophe, so whatever it is, it is not 朱 chu or 居
    // chü. Only the diaeresis is in question.
    assertArrayEquals(readLoosely("ch'u¹"), ["chū", "qū"]);
    assertArrayEquals(readLoosely("chü¹"), ["jū", "qū"]);
    assertArrayEquals(readLoosely("chu¹"), ["zhū", "chū", "jū", "qū"]);
  });

  it("leaves an unambiguous spelling alone", () => {
    assertArrayEquals(readLoosely("shuo¹"), ["shuō"]);
    assertArrayEquals(readLoosely("hsi¹"), ["xī"]);
  });
});

describe("Wade-Giles over the whole inventory", () => {
  it("writes every syllable and reads every one of them back", () => {
    // Over the tones each syllable is written in rather than over all five of
    // them, since reading now narrows on the tone: `lo¹` is 羅 luō and nothing
    // else, because 咯 has no first tone to be.
    let checked = 0;
    for (const [spelling, tones] of SYLLABLE_TONES) {
      const base = syllable(spelling);
      for (const tone of tones) {
        for (const erhua of [false, true]) {
          const form = { ...base, tone, ...(erhua && { erhua: true }) };
          const back = readWadeGiles(writeWadeGiles(form));
          const found = back.find(
            (candidate) =>
              candidate.initial === form.initial &&
              candidate.final === form.final,
          );
          assertObjectEquals(found, form, spelling);
          checked += 1;
        }
      }
    }
    assertIdentical(checked, 1708 * 2);
  });

  it("reads a syllable written in a tone it never takes as the other one", () => {
    // The eight forms of the 5,088 that no longer come back, and the whole
    // cost of narrowing: `lo` in the four contour tones, with and without the
    // 儿化 suffix, all of them 羅 rather than a 咯 Mandarin does not write.
    assertArrayEquals(read("lo¹"), ["luō"]);
    assertArrayEquals(read("lo-êrh⁴"), ["luòr"]);
  });

  it("gives 423 spellings to 424 syllables", () => {
    // 羅 luó and 咯 lo share `lo`, which is the system's own doing.
    const spellings = [...DICTIONARY_SYLLABLES].map((pinyin) =>
      writeWadeGilesSpelling(syllable(pinyin)),
    );
    assertArrayLength(spellings, 424);
    assertSetSize(new Set(spellings), 423);
  });

  it("reads all but one syllable back at the head of the list", () => {
    // The exception is 咯 lo, which shares `lo` with 羅 luó and loses the tie
    // because candidates are ordered by the inventory and it is a rare
    // syllable. Written Wade-Giles simply does not distinguish them.
    const notFirst = [...DICTIONARY_SYLLABLES].filter((pinyin) => {
      const first = readWadeGiles(writeWadeGilesSpelling(syllable(pinyin)))[0];
      return first === undefined || writeSyllable(first, "none") !== pinyin;
    });
    assertArrayEquals(notFirst, ["lo"]);
  });

  it("merges 219 of the 424 once their marks are dropped", () => {
    // The number `pnpm transcription` reports, asserted here so that a change to
    // the tables cannot move it quietly.
    const merged = [...DICTIONARY_SYLLABLES].filter((pinyin) => {
      const dropped = writeWadeGilesSpelling(syllable(pinyin)).replaceAll(
        /['êŭü]/gu,
        (mark) => (mark === "ê" ? "e" : mark === "'" ? "" : "u"),
      );
      return readWadeGilesLoosely(dropped).length > 1;
    });
    assertArrayLength(merged, 219);
  });
});

describe("splitting a Wade-Giles word that dropped its hyphens", () => {
  it("splits a name written solid", () => {
    assertArrayEquals(splitWadeGiles("maotsetung"), ["mao", "tse", "tung"]);
    assertArrayEquals(splitWadeGiles("kuomintang"), ["kuo", "min", "tang"]);
  });

  it("honours the hyphen where the text kept it", () => {
    assertArrayEquals(splitWadeGiles("mao-tse-tung"), ["mao", "tse", "tung"]);
    assertArrayEquals(splitWadeGiles("ch'ang-ch'eng"), ["ch'ang", "ch'eng"]);
  });

  it("keeps the 儿化 suffix, whose hyphen is not a boundary", () => {
    // `-êrh` is part of a spelling rather than a join, so the longer head wins
    // and 花儿 huār stays one syllable.
    assertArrayEquals(splitWadeGiles("hua-êrh"), ["hua-êrh"]);
    assertArrayEquals(readingOf("hua-êrh"), ["huar"]);
  });

  it("takes the tone digits with the syllables they belong to", () => {
    assertArrayEquals(splitWadeGiles("pei³ching¹"), ["pei³", "ching¹"]);
    assertArrayEquals(readingOf("pei³ching¹"), ["běi", "jīng"]);
  });

  it("splits one syllable as one syllable", () => {
    assertArrayEquals(splitWadeGiles("chu"), ["chu"]);
  });

  it("refuses a run that is not Wade-Giles at all", () => {
    assertUndefined(splitWadeGiles(""));
    assertUndefined(splitWadeGiles("xyz"));
  });

  it("refuses the Postal Romanisation it is usually asked for", () => {
    // `Chungking` and `Tsingtao` are the names ROADMAP.md named for this, and
    // neither is Wade-Giles: `king`, `tsing` and `pe` are Postal Romanisation
    // spellings and are not syllables this system has. 重慶 in Wade-Giles is
    // `chʻung²-chʻing⁴` and 青島 is `chʻing¹-tao³`.
    assertUndefined(splitWadeGiles("chungking"));
    assertUndefined(splitWadeGiles("tsingtao"));
    assertUndefined(splitWadeGiles("peking"));
  });

  it("reads a whole word, taking the first candidate for each syllable", () => {
    assertArrayEquals(readingOf("maotsetung"), ["mao", "ce", "dong"]);
    // Believing what was written costs the aspiration nobody typed: 台北 is
    // Táiběi and `tai` unmarked is 代 dài first. That is the 56.02% figure
    // showing up in one word.
    assertArrayEquals(readingOf("taipei"), ["dai", "bei"]);
    assertArrayEquals(readingOf("t'ai³pei³"), ["tǎi", "běi"]);
  });

  it("says nothing where the run does not split", () => {
    assertUndefined(readWadeGilesWord("chungking"));
  });

  it("splits every pair of inventory syllables written solid", () => {
    // Every two-syllable pair the inventory can make is too many; this walks
    // the syllables in order and pairs each with the next, which covers all 424
    // in both positions. What a pair splits *into* is the 99.19% `pnpm
    // transcription` measures over real vocabulary; what is asserted here is
    // that it splits at all.
    const nasals = new Set(["ng", "m", "n", "hm", "hng"]);
    const spellings = [...DICTIONARY_SYLLABLES].map((pinyin) =>
      writeWadeGilesSpelling(syllable(pinyin)),
    );
    const unsplit = spellings.filter((first, at) => {
      const second = spellings[(at + 1) % spellings.length] ?? "";
      return splitWadeGiles(`${first}${second}`) === undefined;
    });
    // The only pairs that do not are the ones a syllabic nasal is part of,
    // which is the bar below rather than a gap.
    assertArrayLength(unsplit, 9);
    for (const first of unsplit) {
      const at = spellings.indexOf(first);
      const second = spellings[(at + 1) % spellings.length] ?? "";
      assertTrue(nasals.has(first) || nasals.has(second), `${first}${second}`);
    }
  });

  it("refuses a syllabic nasal as a piece of a longer run", () => {
    // 嗯 `ng`, 呣 `m`, 唔 `n`, 噷 `hm` and 哼 `hng` are syllables and read as
    // such on their own — but not one of the 411,956 multi-syllable words of
    // the phrase corpus contains one, and letting `ng` be a piece would hand
    // back `shung` as `shu`-`ng`. `shung` is regular Wade-Giles for a syllable
    // Mandarin does not have, which is what the index exists to refuse.
    for (const nasal of ["ng", "m", "n", "hm", "hng"]) {
      assertArrayEquals(splitWadeGiles(nasal), [nasal], nasal);
      // `hsieh` is 些 and no `hsieh`+nasal is a syllable of its own, so the
      // only way these could split is through the nasal.
      assertUndefined(splitWadeGiles(`hsieh${nasal}`), nasal);
    }
    assertUndefined(splitWadeGiles("shung"));
    // `shun` is 順 and stays one syllable, which is why the bar is on the
    // nasal being a *piece* rather than on the letters it is made of.
    assertArrayEquals(splitWadeGiles("shun"), ["shun"]);
  });
});
