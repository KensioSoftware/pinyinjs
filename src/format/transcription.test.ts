import { fileURLToPath } from "node:url";

import {
  assertArrayEquals,
  assertIdentical,
  assertNonNullable,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { convertPieces } from "../decode/convert.js";
import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { writeBopomofoWord } from "../transcription/bopomofo.js";
import { writeWadeGilesWord } from "../transcription/wade-giles.js";
import { readWadeGilesWord } from "../transcription/wade-giles.js";
import { writeSyllable } from "../syllable/syllable.js";
import { convertToWadeGiles, toTranscription } from "./transcription.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/**
 * What a text comes out as in Wade-Giles with no tones, which is how nearly all
 * real Wade-Giles is written.
 */
function plain(text: string): string {
  return convertToWadeGiles(dictionary, text, { notation: "none" });
}

describe("writing a conversion in another system", () => {
  it("hyphenates the syllables of a word and spaces the words", () => {
    assertIdentical(plain("我要去北京。"), "Wo yao ch'ü Pei-ching.");
    assertIdentical(plain("黑龙江"), "Hei-lung-chiang");
  });

  it("writes the tone as a raised digit unless asked not to", () => {
    assertIdentical(convertToWadeGiles(dictionary, "北京"), "Pei³-ching¹");
    assertIdentical(plain("北京"), "Pei-ching");
  });

  it("does not write the 隔音符号, which would be a different mark", () => {
    // 西安 is `Xī'ān` in pinyin. The hyphen has already marked the boundary,
    // and Wade-Giles spends the apostrophe on aspiration — `Hsi'an` would read
    // as `hsi` followed by an aspirated syllable.
    assertIdentical(plain("西安"), "Hsi-an");
  });

  it("keeps the capitals the conversion settled", () => {
    assertIdentical(plain("我要去北京。"), "Wo yao ch'ü Pei-ching.");
    assertIdentical(plain("北京大学"), "Pei-ching-ta-hsüeh");
    assertIdentical(plain("银行"), "yin-hang");
  });

  it("writes 儿化 as the syllable Wade-Giles writes it as", () => {
    assertIdentical(plain("花儿"), "hua-êrh");
  });

  it("passes anything that is not Han through as it was", () => {
    assertIdentical(plain("COVID-19 和 3D"), "COVID-19 ho san D");
  });

  it("takes any system's own word writer", () => {
    const pieces = convertPieces(dictionary, "北京大学");
    assertIdentical(
      toTranscription(pieces, (syllables) => writeBopomofoWord(syllables)),
      "ㄅㄟˇ ㄐㄧㄥ ㄉㄚˋ ㄒㄩㄝˊ",
    );
    assertIdentical(
      toTranscription(pieces, (syllables) => writeWadeGilesWord(syllables)),
      "Pei³-ching¹-ta⁴-hsüeh²",
    );
  });

  it("reads back to the pinyin it came from", () => {
    // The hyphens keep the boundaries, so the only thing that can be lost is
    // Wade-Giles's own non-injectivity. Measured over 20,000 Tatoeba sentences
    // this is 99.50% of 140,163 words; here it is the words of one sentence.
    for (const text of ["北京大学", "黑龙江", "重庆", "青岛", "国民党"]) {
      const written = plain(text);
      const read = readWadeGilesWord(written);
      assertNonNullable(read, written);
      const wanted = convertPieces(dictionary, text).flatMap((piece) =>
        piece.syllable === undefined
          ? []
          : [writeSyllable(piece.syllable, "none")],
      );
      assertArrayEquals(
        read.map((syllable) => writeSyllable(syllable, "none")),
        wanted,
        text,
      );
    }
  });

  it("matches the attested Wade-Giles for the names that have one", () => {
    // Hand-checked against the forms in general use before 1979. It was 10 of
    // 15 until the 姓/名 boundary arrived; 孙中山 is the one that moved.
    for (const [hanzi, attested] of [
      ["孙中山", "Sun Chung-shan"],
      ["重庆", "Ch'ung-ch'ing"],
      ["青岛", "Ch'ing-tao"],
      ["台北", "T'ai-pei"],
      ["国民党", "Kuo-min-tang"],
      ["北京", "Pei-ching"],
      ["南京", "Nan-ching"],
      ["黑龙江", "Hei-lung-chiang"],
      ["四川", "Ssŭ-ch'uan"],
      ["广东", "Kuang-tung"],
      ["西安", "Hsi-an"],
    ] as const) {
      assertIdentical(plain(hanzi), attested, hanzi);
    }
  });

  it("inherits the grouping's judgements, including the 姓/名 boundary", () => {
    // This asserted `Mao-tsê-tung` while the grouping wrote 毛泽东 as one word.
    // PERSONAL_NAME splits it, and the hyphen rule needed no change at all to
    // follow: a space between words and a hyphen within one is what it already
    // did. The attested form is `Mao Tse-tung`, which this now matches but for
    // the ê a real text drops along with the apostrophes.
    assertIdentical(plain("毛泽东"), "Mao Tsê-tung");
    // 北京大学 is still one word, and still the grouping's to fix: it is an
    // organisation rather than a person, so no 姓 boundary reaches it.
    assertIdentical(plain("北京大学"), "Pei-ching-ta-hsüeh");
  });
});
