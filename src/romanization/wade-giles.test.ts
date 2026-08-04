import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertObjectEquals,
  assertSetSize,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { TONES } from "../tone/tone.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
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
    assertArrayEquals(read("lo²"), ["luó", "ló"]);
    assertArrayEquals(read("o¹"), ["ō", "ē"]);
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
    let checked = 0;
    for (const spelling of DICTIONARY_SYLLABLES) {
      const base = syllable(spelling);
      for (const tone of TONES) {
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
    assertIdentical(checked, 424 * 5 * 2);
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
    // The number `pnpm romanization` reports, asserted here so that a change to
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
