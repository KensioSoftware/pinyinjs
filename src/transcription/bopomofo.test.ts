import {
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

import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { TONES } from "../tone/tone.js";
import {
  isBopomofo,
  readBopomofo,
  writeBopomofo,
  writeBopomofoWord,
} from "./bopomofo.js";

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
 * What a pinyin syllable is written as in bopomofo.
 */
function written(pinyin: string): string {
  return writeBopomofo(syllable(pinyin));
}

/**
 * What a bopomofo syllable reads back as, in pinyin.
 */
function read(bopomofo: string): string {
  const found = readBopomofo(bopomofo);
  assertNonNullable(found, bopomofo);
  return writeSyllable(found);
}

describe("writing bopomofo", () => {
  it("writes an initial, a medial and a rhyme", () => {
    assertIdentical(written("jiù"), "ㄐㄧㄡˋ");
    assertIdentical(written("zhōng"), "ㄓㄨㄥ");
    assertIdentical(written("jūn"), "ㄐㄩㄣ");
    assertIdentical(written("xiōng"), "ㄒㄩㄥ");
  });

  it("writes the empty rhyme as the initial alone", () => {
    // 知 is ㄓ and not ㄓㄧ: the i of zhi is the initial continuing, and
    // bopomofo does not write it.
    assertIdentical(written("zhī"), "ㄓ");
    assertIdentical(written("sì"), "ㄙˋ");
    assertIdentical(written("rì"), "ㄖˋ");
    // Whereas the i of ji is a real medial.
    assertIdentical(written("jī"), "ㄐㄧ");
  });

  it("writes the zero-initial spellings back to their underlying finals", () => {
    assertIdentical(written("yī"), "ㄧ");
    assertIdentical(written("wǔ"), "ㄨˇ");
    assertIdentical(written("yú"), "ㄩˊ");
    assertIdentical(written("yǒu"), "ㄧㄡˇ");
    assertIdentical(written("wèi"), "ㄨㄟˋ");
    assertIdentical(written("wēng"), "ㄨㄥ");
  });

  it("leaves the first tone unmarked unless asked", () => {
    assertIdentical(written("mā"), "ㄇㄚ");
    assertIdentical(
      writeBopomofo(syllable("mā"), { firstTone: "mark" }),
      "ㄇㄚˉ",
    );
  });

  it("writes the neutral tone's dot in front", () => {
    assertIdentical(written("ma5"), "˙ㄇㄚ");
    assertIdentical(written("de5"), "˙ㄉㄜ");
  });

  it("writes nothing at all for a tone that was never written", () => {
    assertIdentical(written("ma"), "ㄇㄚ");
  });

  it("adds ㄦ for 儿化, after the tone mark rather than before it", () => {
    // The mark belongs to the nucleus and the suffix is not part of what it
    // marks, so it goes between the two: see TONE_MARKS.
    assertIdentical(written("wánr"), "ㄨㄢˊㄦ");
    assertIdentical(written("gēr"), "ㄍㄜㄦ");
    // 事儿 has no rhyme to hang the ㄦ on, so the two symbols stand alone.
    assertIdentical(written("shìr"), "ㄕˋㄦ");
    // The neutral dot is in front either way.
    assertIdentical(written("der5"), "˙ㄉㄜㄦ");
  });

  it("writes the syllabic nasals with their letters doing rhyme duty", () => {
    assertIdentical(written("ń"), "ㄋˊ");
    assertIdentical(written("hm"), "ㄏㄇ");
    assertIdentical(written("hng"), "ㄏㄫ");
  });

  it("writes a word with a space between its syllables", () => {
    assertIdentical(
      writeBopomofoWord([syllable("běi"), syllable("jīng")]),
      "ㄅㄟˇ ㄐㄧㄥ",
    );
  });
});

describe("reading bopomofo", () => {
  it("reads a syllable back to pinyin", () => {
    assertIdentical(read("ㄐㄧㄡˋ"), "jiù");
    assertIdentical(read("ㄓㄨㄥ"), "zhōng");
    assertIdentical(read("ㄒㄩㄥ"), "xiōng");
  });

  it("reads ㄨㄥ as ong after an initial and ueng without one", () => {
    // The one rhyme in the system whose reading depends on what is in front of
    // it: 中 is ㄓㄨㄥ and 翁 is ㄨㄥ.
    assertObjectEquals(readBopomofo("ㄓㄨㄥ"), {
      initial: "zh",
      final: "ong",
      tone: 1,
    });
    assertObjectEquals(readBopomofo("ㄨㄥ"), {
      initial: "",
      final: "ueng",
      tone: 1,
    });
  });

  it("reads a bare initial as the empty rhyme", () => {
    assertIdentical(read("ㄓ"), "zhī");
    assertIdentical(read("ㄗˋ"), "zì");
  });

  it("reads the syllabic nasals, retrying the initial as a rhyme", () => {
    assertIdentical(read("ㄇ"), "m̄");
    assertIdentical(read("ㄏㄇˊ"), "hḿ");
    assertIdentical(read("ㄫˋ"), "ǹg");
  });

  it("reads ㄦ as a suffix except at the front of a syllable", () => {
    assertIdentical(read("ㄨㄢˊㄦ"), "wánr");
    assertIdentical(read("ㄕˋㄦ"), "shìr");
    assertIdentical(read("ㄦˊ"), "ér");
    assertIdentical(read("ㄦˋㄦ"), "èrr");
  });

  it("reads a mark written after the ㄦ, where it does not belong", () => {
    // Not what the standard writes, and it is what a text treating the suffix
    // as part of the syllable produces, so it is read rather than refused.
    assertIdentical(read("ㄨㄢㄦˊ"), "wánr");
    assertIdentical(read("ㄕㄦˋ"), "shìr");
  });

  it("takes an unmarked syllable as a first tone", () => {
    // Which is what bopomofo means by leaving the mark off, unlike a bare
    // `bei` typed as pinyin, where nothing was written either way.
    assertObjectEquals(readBopomofo("ㄇㄚ"), {
      initial: "m",
      final: "a",
      tone: 1,
    });
  });

  it("takes the tone mark on either side and the digits of neither", () => {
    assertIdentical(read("˙ㄇㄚ"), "ma");
    assertIdentical(read("ㄇㄚ˙"), "ma");
    assertIdentical(read("ㄇㄚ´"), "má");
    assertIdentical(read("ㄇㄚ`"), "mà");
    assertUndefined(readBopomofo("ㄇㄚ2"));
  });

  it("rejects a tone mark at each end", () => {
    assertUndefined(readBopomofo("˙ㄇㄚˊ"));
  });

  it("rejects what is not one well-formed syllable", () => {
    assertUndefined(readBopomofo(""));
    assertUndefined(readBopomofo("ˊ"));
    assertUndefined(readBopomofo("ㄅㄟㄐㄧㄥ"));
    assertUndefined(readBopomofo("jiù"));
    // ㄍ has no rhyme it could take, so the ㄦ cannot be a suffix.
    assertUndefined(readBopomofo("ㄍㄦ"));
    // ㄞㄞ is two rhymes.
    assertUndefined(readBopomofo("ㄞㄞ"));
  });

  it("knows bopomofo from anything else without being told", () => {
    assertTrue(isBopomofo("ㄅㄟˇ"));
    assertTrue(isBopomofo(" ㄓ "));
    assertFalse(isBopomofo("běi"));
    assertFalse(isBopomofo("pei³"));
    assertFalse(isBopomofo(""));
    assertFalse(isBopomofo("ㄅㄟ 北"));
  });
});

describe("bopomofo over the whole inventory", () => {
  it("writes every syllable and reads every one of them back", () => {
    // Exhaustive rather than sampled, and over every tone: 424 syllables in
    // six tone states, with and without 儿化.
    let checked = 0;
    for (const spelling of DICTIONARY_SYLLABLES) {
      const base = syllable(spelling);
      for (const tone of TONES) {
        for (const erhua of [false, true]) {
          const form = { ...base, tone, ...(erhua && { erhua: true }) };
          const back = readBopomofo(writeBopomofo(form));
          assertNonNullable(back, spelling);
          assertObjectEquals(back, form, spelling);
          checked += 1;
        }
      }
    }
    assertIdentical(checked, 424 * 5 * 2);
  });

  it("gives every syllable a spelling of its own", () => {
    // A bijection, which Wade-Giles is not: `lo` there is both luó and lo.
    const spellings = [...DICTIONARY_SYLLABLES].map((spelling) =>
      writeBopomofo(syllable(spelling)),
    );
    assertArrayLength(spellings, 424);
    assertSetSize(new Set(spellings), 424);
  });

  it("cannot write a tone that was never written", () => {
    // The one thing that does not round-trip, and it is the standard's doing
    // rather than this module's: bopomofo marks the first tone by omission, so
    // there is no room left to say "no tone at all".
    const toneless = { ...syllable("mā"), tone: undefined };
    assertIdentical(writeBopomofo(toneless), "ㄇㄚ");
    assertObjectEquals(readBopomofo("ㄇㄚ"), { ...toneless, tone: 1 });
  });
});
