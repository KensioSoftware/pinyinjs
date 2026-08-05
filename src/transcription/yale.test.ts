import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertObjectEquals,
  assertSetSize,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { DICTIONARY_SYLLABLES, SYLLABLE_TONES } from "../syllable/inventory.js";
import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  readYale,
  writeYale,
  writeYaleSpelling,
  writeYaleWord,
} from "./yale.js";

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
 * What a pinyin syllable is spelled as in Yale, without its tone.
 */
function spelt(pinyin: string): string {
  return writeYaleSpelling(syllable(pinyin));
}

/**
 * What a Yale spelling reads back as, in pinyin.
 */
function read(spelling: string): readonly string[] {
  return readYale(spelling).map((found) => writeSyllable(found));
}

describe("writing Yale", () => {
  it("spells the aspiration pairs as English reads them", () => {
    assertIdentical(spelt("bā"), "ba");
    assertIdentical(spelt("pà"), "pa");
    assertIdentical(spelt("dà"), "da");
    assertIdentical(spelt("tài"), "tai");
    assertIdentical(spelt("zì"), "dz");
    assertIdentical(spelt("zuò"), "dzwo");
    assertIdentical(spelt("cā"), "tsa");
  });

  it("borrows the retroflex letters for the palatals, except for x", () => {
    assertIdentical(spelt("jī"), "ji");
    assertIdentical(spelt("qī"), "chi");
    assertIdentical(spelt("xī"), "syi");
    assertIdentical(spelt("zhī"), "jr");
    assertIdentical(spelt("chī"), "chr");
    assertIdentical(spelt("shī"), "shr");
    assertIdentical(spelt("rì"), "r");
  });

  it("writes the empty rhyme as a letter, and never writes one twice", () => {
    // The retroflexes take r and the dental sibilants z...
    assertIdentical(spelt("zhī"), "jr");
    assertIdentical(spelt("cí"), "tsz");
    assertIdentical(spelt("sì"), "sz");
    // ...and where the initial already ends in that letter, it is not
    // repeated: 日 is `r` rather than `rr`, 字 `dz` rather than `dzz`.
    assertIdentical(spelt("rì"), "r");
    assertIdentical(spelt("zì"), "dz");
    // The same collapse in the other direction: sy + ya is sya.
    assertIdentical(spelt("xiā"), "sya");
    assertIdentical(spelt("xué"), "sywe");
    assertIdentical(spelt("xióng"), "syung");
  });

  it("writes the medials with y and w", () => {
    assertIdentical(spelt("jiù"), "jyou");
    assertIdentical(spelt("jiàn"), "jyan");
    assertIdentical(spelt("biǎo"), "byau");
    assertIdentical(spelt("guó"), "gwo");
    assertIdentical(spelt("duì"), "dwei");
    assertIdentical(spelt("dūn"), "dwun");
    assertIdentical(spelt("jūn"), "jyun");
    assertIdentical(spelt("yuán"), "ywan");
  });

  it("writes -o after a labial as -wo, which is what is said", () => {
    assertIdentical(spelt("bō"), "bwo");
    assertIdentical(spelt("mò"), "mwo");
    // And leaves it alone elsewhere.
    assertIdentical(spelt("lo"), "lo");
    assertIdentical(spelt("ó"), "o");
  });

  it("needs a second form for only five finals with no initial", () => {
    assertIdentical(spelt("yī"), "yi");
    assertIdentical(spelt("yīn"), "yin");
    assertIdentical(spelt("yīng"), "ying");
    assertIdentical(spelt("wū"), "wu");
    // 文 is `wen` alone, where the same final after an initial is `wun`.
    assertIdentical(spelt("wén"), "wen");
    assertIdentical(spelt("dūn"), "dwun");
    // Everything else in the i, u and ü groups is spelled as it is after an
    // initial, because it already carries its y or w.
    assertIdentical(spelt("yā"), "ya");
    assertIdentical(spelt("wǒ"), "wo");
    assertIdentical(spelt("yú"), "yu");
  });

  it("writes the tone as pinyin's diacritics, and as a digit when asked", () => {
    assertIdentical(writeYale(syllable("jiù")), "jyòu");
    assertIdentical(writeYale(syllable("xī")), "syī");
    assertIdentical(writeYale(syllable("jiù"), { tones: "numbers" }), "jyou4");
    assertIdentical(writeYale(syllable("jiù"), { tones: "none" }), "jyou");
    // An unwritten tone stays unwritten, and the neutral tone is written with
    // no mark at all — which is Yale's convention and pinyin's.
    assertIdentical(writeYale(syllable("jiu")), "jyou");
    assertIdentical(writeYale(syllable("de5")), "de");
    assertIdentical(writeYale(syllable("de5"), { tones: "numbers" }), "de5");
  });

  it("marks the tone on syllables with no vowel to carry it", () => {
    // `applyToneMark` has nowhere to put the mark on these, so Yale puts it on
    // the letter standing in for the vowel.
    assertIdentical(writeYale(syllable("zhī")), "jr̄");
    assertIdentical(writeYale(syllable("shì")), "shr̀");
    assertIdentical(writeYale(syllable("zì")), "dz̀");
    assertIdentical(writeYale(syllable("sī")), "sz̄");
  });

  it("writes 儿化 as an r, with the mark left on the syllable itself", () => {
    assertIdentical(writeYale(syllable("wánr")), "wánr");
    assertIdentical(spelt("gēr"), "ger");
    assertIdentical(writeYale(syllable("shìr")), "shr̀r");
  });

  it("writes a word solid, as Yale's own textbooks do", () => {
    assertIdentical(
      writeYaleWord([syllable("zhōng"), syllable("guó")]),
      "jūnggwó",
    );
    assertIdentical(
      writeYaleWord([syllable("běi"), syllable("jīng")], { tones: "none" }),
      "beijing",
    );
  });
});

describe("reading Yale", () => {
  it("reads a spelling back to pinyin, tone and all", () => {
    assertArrayEquals(read("jyòu"), ["jiù"]);
    assertArrayEquals(read("jyou4"), ["jiù"]);
    assertArrayEquals(read("syī"), ["xī"]);
    assertArrayEquals(read("jr̄"), ["zhī"]);
    assertArrayEquals(read("dzwo"), ["zuo"]);
    assertArrayEquals(read("Jūng"), ["zhōng"]);
  });

  it("reads an unmarked syllable as having no tone, not a neutral one", () => {
    // The two are written alike, so the difference is in what comes back
    // rather than in how it prints.
    assertUndefined(readYale("de")[0]?.tone);
    assertIdentical(readYale("de5")[0]?.tone, NEUTRAL_TONE);
  });

  it("gives back both syllables where the system is ambiguous", () => {
    // Yale writes 誒 ê as `e`, which is also 額 e.
    assertArrayEquals(read("e"), ["e", "ê"]);
  });

  it("reads the r suffix, and what it collides with", () => {
    assertArrayEquals(read("wánr"), ["wánr"]);
    assertArrayEquals(read("shr̀r"), ["shìr"]);
    // `er` is 兒 ér itself, and it is also any of the three syllables Yale
    // spells `e` with the suffix on the end. The suffix is a letter the system
    // already uses, so this is a collision Wade-Giles's `-êrh` does not have.
    assertArrayEquals(read("ér"), ["ér", "ér", "ếr"]);
  });

  it("reads nothing for what is not Yale", () => {
    assertArrayLength(read(""), 0);
    assertArrayLength(read("ㄓ"), 0);
    assertArrayLength(read("hsüeh"), 0);
    // A regular Yale spelling of a syllable Mandarin does not have.
    assertArrayLength(read("shung"), 0);
  });
});

describe("Yale over the whole inventory", () => {
  it("writes every syllable and reads every one of them back", () => {
    // Over the tones each syllable is written in, since reading narrows on
    // the tone: `ēr` is 啊儿 ār, there being no 兒 in a first tone.
    let checked = 0;
    for (const [spelling, tones] of SYLLABLE_TONES) {
      const base = syllable(spelling);
      for (const tone of tones) {
        for (const erhua of [false, true]) {
          const form = { ...base, tone, ...(erhua && { erhua: true }) };
          // Numbered, because the marks cannot write the neutral tone: see
          // the round trip in `pnpm transcription`.
          const back = readYale(writeYale(form, { tones: "numbers" }));
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

  it("gives 423 spellings to 424 syllables", () => {
    // 額 e and 誒 ê share `e`, which is the one pair Yale does not separate.
    const spellings = [...DICTIONARY_SYLLABLES].map((pinyin) =>
      writeYaleSpelling(syllable(pinyin)),
    );
    assertArrayLength(spellings, 424);
    assertSetSize(new Set(spellings), 423);
  });

  it("reads all but one syllable back at the head of the list", () => {
    const notFirst = [...DICTIONARY_SYLLABLES].filter((pinyin) => {
      const first = readYale(writeYaleSpelling(syllable(pinyin)))[0];
      return first === undefined || writeSyllable(first, "none") !== pinyin;
    });
    assertArrayEquals(notFirst, ["ê"]);
  });
});
