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
import { NEUTRAL_TONE, type Tone, TONES } from "../tone/tone.js";
import { readIpa, writeIpa, writeIpaSymbols, writeIpaWord } from "./ipa.js";

/**
 * The four tones that have a contour, which are the ones IPA can write.
 */
const CONTOUR_TONES: ReadonlySet<Tone> = new Set(
  TONES.filter((tone) => tone !== NEUTRAL_TONE),
);

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
 * How a pinyin syllable is transcribed, without its tone.
 */
function symbols(pinyin: string): string {
  return writeIpaSymbols(syllable(pinyin));
}

/**
 * What a transcription reads back as, in pinyin.
 */
function read(text: string): readonly string[] {
  return readIpa(text).map((found) => writeSyllable(found));
}

describe("transcribing in IPA", () => {
  it("transcribes the aspiration series, where pinyin's letters mislead", () => {
    assertIdentical(symbols("bā"), "pa");
    assertIdentical(symbols("pà"), "pʰa");
    assertIdentical(symbols("dà"), "ta");
    assertIdentical(symbols("tài"), "tʰai");
    assertIdentical(symbols("gāo"), "kau");
    assertIdentical(symbols("kǒu"), "kʰou");
  });

  it("separates the three sibilant series", () => {
    assertIdentical(symbols("jī"), "tɕi");
    assertIdentical(symbols("qī"), "tɕʰi");
    assertIdentical(symbols("xī"), "ɕi");
    assertIdentical(symbols("zhī"), "ʈʂɨ");
    assertIdentical(symbols("chī"), "ʈʂʰɨ");
    assertIdentical(symbols("shī"), "ʂɨ");
    assertIdentical(symbols("rì"), "ʐɨ");
    assertIdentical(symbols("zì"), "tsɨ");
    assertIdentical(symbols("sì"), "sɨ");
    // And h, which is not the English one.
    assertIdentical(symbols("hǎo"), "xau");
  });

  it("writes the vowels pinyin spells with one letter", () => {
    // One pinyin e for three vowels.
    assertIdentical(symbols("è"), "ɤ");
    assertIdentical(symbols("ēn"), "ən");
    assertIdentical(symbols("ê"), "ɛ");
    assertIdentical(symbols("tiān"), "tʰiɛn");
    // And one pinyin i for two.
    assertIdentical(symbols("yī"), "i");
    assertIdentical(symbols("zhī"), "ʈʂɨ");
    // ü is [y] wherever pinyin writes it as a u.
    assertIdentical(symbols("yú"), "y");
    assertIdentical(symbols("jū"), "tɕy");
    assertIdentical(symbols("xué"), "ɕye");
  });

  it("needs no zero-initial forms at all, because y and w are spellings", () => {
    assertIdentical(symbols("yī"), "i");
    assertIdentical(symbols("wū"), "u");
    assertIdentical(symbols("yā"), "ia");
    assertIdentical(symbols("wǒ"), "uo");
    assertIdentical(symbols("wèi"), "uei");
    // 文 and 敦 share their final, which pinyin's spelling hides.
    assertIdentical(symbols("wén"), "uən");
    assertIdentical(symbols("dūn"), "tuən");
  });

  it("transcribes -o after a labial as [uo], as Yale spells it", () => {
    assertIdentical(symbols("bō"), "puo");
    assertIdentical(symbols("mò"), "muo");
    assertIdentical(symbols("lo"), "lɔ");
    assertIdentical(symbols("ó"), "ɔ");
  });

  it("writes the tone as a Chao letter, or as his pitch numerals", () => {
    assertIdentical(writeIpa(syllable("jiù")), "tɕiou˥˩");
    assertIdentical(writeIpa(syllable("mā")), "ma˥");
    assertIdentical(writeIpa(syllable("má")), "ma˧˥");
    assertIdentical(writeIpa(syllable("mǎ")), "ma˨˩˦");
    assertIdentical(writeIpa(syllable("mǎ"), { tones: "numbers" }), "ma214");
    assertIdentical(writeIpa(syllable("mǎ"), { tones: "none" }), "ma");
    // The neutral tone has no contour of its own, and no letter.
    assertIdentical(writeIpa(syllable("ma5")), "ma");
    assertIdentical(writeIpa(syllable("ma")), "ma");
  });

  it("adds [ɚ] for 儿化, which is an approximation and not a fusion", () => {
    assertIdentical(writeIpa(syllable("wánr")), "uanɚ˧˥");
    assertIdentical(symbols("gēr"), "kɤɚ");
    // 兒 itself is the same vowel written as a rhyme.
    assertIdentical(symbols("ér"), "aɚ");
  });

  it("runs the syllables of a word together", () => {
    assertIdentical(
      writeIpaWord([syllable("zhōng"), syllable("guó")]),
      "ʈʂʊŋ˥kuo˧˥",
    );
  });
});

describe("reading IPA", () => {
  it("reads a transcription back to pinyin, tone and all", () => {
    assertArrayEquals(read("tɕiou˥˩"), ["jiù"]);
    assertArrayEquals(read("ma˨˩˦"), ["mǎ"]);
    assertArrayEquals(read("ma214"), ["mǎ"]);
    assertArrayEquals(read("ma3"), ["mǎ"]);
    assertArrayEquals(read("ʈʂɨ˥"), ["zhī"]);
    assertArrayEquals(read("ɕye˧˥"), ["xué"]);
  });

  it("reads [ɚ] as the suffix and as 兒 itself", () => {
    assertArrayEquals(read("uanɚ˧˥"), ["wánr"]);
    // `aɚ` is 兒 ér, and it is also 啊 a with the suffix on it.
    assertArrayEquals(read("aɚ"), ["er", "ar"]);
  });

  it("reads nothing for what is not a Mandarin syllable", () => {
    assertArrayLength(read(""), 0);
    assertArrayLength(read("zhi"), 0);
    assertArrayLength(read("ㄓ"), 0);
    // Regular symbols in a combination Mandarin does not have.
    assertArrayLength(read("ʂʊŋ"), 0);
    assertArrayLength(read("ki"), 0);
  });
});

describe("IPA over the whole inventory", () => {
  it("transcribes every syllable and reads every one of them back", () => {
    // Over the tones each syllable is written in, since reading narrows on
    // the tone: `aɚ˥` is 啊儿 ār, there being no 兒 in a first tone.
    let checked = 0;
    for (const [spelling, tones] of SYLLABLE_TONES) {
      const base = syllable(spelling);
      const contour = tones.filter((one) => CONTOUR_TONES.has(one));
      for (const tone of contour) {
        for (const erhua of [false, true]) {
          const form = { ...base, tone, ...(erhua && { erhua: true }) };
          const back = readIpa(writeIpa(form));
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
    assertIdentical(checked, 1403 * 2);
  });

  it("cannot say that a tone is neutral, and so loses it", () => {
    // The one thing the transcription cannot represent, and the exact mirror
    // of bopomofo's inability to say "no tone at all". 848 of the 5,088 forms
    // `pnpm transcription` measures come back this way.
    const read = readIpa(writeIpa({ ...syllable("de"), tone: NEUTRAL_TONE }));
    assertUndefined(read[0]?.tone);
  });

  it("gives all 424 syllables a distinct transcription", () => {
    // The only one of the four systems that does: bopomofo manages it too, but
    // Wade-Giles merges 羅 and 咯 and Yale merges 額 and 誒.
    const written = [...DICTIONARY_SYLLABLES].map((pinyin) =>
      writeIpaSymbols(syllable(pinyin)),
    );
    assertArrayLength(written, 424);
    assertSetSize(new Set(written), 424);
  });
});
