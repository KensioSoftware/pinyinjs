import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertObjectEquals,
  assertSetSize,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { DICTIONARY_SYLLABLES, SYLLABLE_TONES } from "../syllable/inventory.js";
import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE, type Tone, TONES } from "../tone/tone.js";
import { readGwoyeu, writeGwoyeu, writeGwoyeuWord } from "./gwoyeu.js";

/**
 * The four tones GR spells, which is every tone but the neutral one.
 */
const CONTOUR_TONES: readonly Tone[] = TONES.filter(
  (tone) => tone !== NEUTRAL_TONE,
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
 * What a pinyin syllable is spelled as in Gwoyeu Romatzyh.
 */
function spelt(pinyin: string): string {
  return writeGwoyeu(syllable(pinyin));
}

/**
 * The four tonal spellings of one syllable, which is what GR has instead of a
 * spelling and a mark.
 */
function tones(pinyin: string): readonly string[] {
  const base = syllable(pinyin);
  return CONTOUR_TONES.map((tone) => writeGwoyeu({ ...base, tone }));
}

/**
 * What a GR spelling reads back as, in pinyin.
 */
function read(spelling: string): readonly string[] {
  return readGwoyeu(spelling).map((found) => writeSyllable(found));
}

describe("writing Gwoyeu Romatzyh", () => {
  it("spells the initials, with one letter doing two series", () => {
    // j, ch and sh are both the retroflexes and the palatals, and it is the
    // following i that says which — so pinyin zhu, ju and jiu come out as ju,
    // jiu and jiou.
    assertIdentical(spelt("zhū"), "ju");
    assertIdentical(spelt("jū"), "jiu");
    assertIdentical(spelt("jiū"), "jiou");
    assertIdentical(spelt("xī"), "shi");
    assertIdentical(spelt("qī"), "chi");
    // The affricates are the other pair that differs from pinyin.
    assertIdentical(spelt("zī"), "tzy");
    assertIdentical(spelt("cī"), "tsy");
  });

  it("writes the empty rhyme as -y, and it behaves as a vowel", () => {
    assertArrayEquals(tones("shi"), ["shy", "shyr", "shyy", "shyh"]);
    assertArrayEquals(tones("zhi"), ["jy", "jyr", "jyy", "jyh"]);
    assertArrayEquals(tones("si"), ["sy", "syr", "syy", "syh"]);
  });

  it("swaps what the first two tones do after a sonorant initial", () => {
    // 媽 mā is `mha` and 麻 má is `ma`: the -h- goes in for the first tone and
    // the second is left as the basic form.
    assertArrayEquals(tones("ma"), ["mha", "ma", "maa", "mah"]);
    assertArrayEquals(tones("nei"), ["nhei", "nei", "neei", "ney"]);
    assertArrayEquals(tones("ri"), ["rhy", "ry", "ryy", "ryh"]);
    // And leaves everything else alone.
    assertArrayEquals(tones("ba"), ["ba", "bar", "baa", "bah"]);
  });

  it("writes the second tone as a glide, or as an -r", () => {
    // NiV → NyV and NuV → NwV...
    assertIdentical(spelt("qíng"), "chyng");
    assertIdentical(spelt("chuán"), "chwan");
    assertIdentical(spelt("huó"), "hwo");
    // ...with the -i kept where the medial is the whole rime.
    assertIdentical(spelt("jí"), "jyi");
    assertIdentical(spelt("fú"), "fwu");
    // Otherwise an r after the vowels.
    assertIdentical(spelt("cháng"), "charng");
    assertIdentical(spelt("bái"), "bair");
    assertIdentical(spelt("hé"), "her");
  });

  it("writes the third tone as a swap, or as a doubled main vowel", () => {
    // Vi/iV → Ve/eV and Vu/uV → Vo/oV.
    assertIdentical(spelt("qiǎn"), "chean");
    assertIdentical(spelt("bǎi"), "bae");
    assertIdentical(spelt("xiǎo"), "sheau");
    assertIdentical(spelt("duǎn"), "doan");
    assertIdentical(spelt("dǎo"), "dao");
    assertIdentical(spelt("shuǐ"), "shoei");
    // Where both are there it is the first that changes: 交 is jeau, not jiao.
    assertIdentical(spelt("jiǎo"), "jeau");
    assertIdentical(spelt("guǎi"), "goai");
    assertIdentical(spelt("xǔ"), "sheu");
    // The swap is abandoned where it would make ee or oo, and the main vowel
    // — the one a pinyin tone mark sits on — doubles instead.
    assertIdentical(spelt("qǐng"), "chiing");
    assertIdentical(spelt("dǎ"), "daa");
    assertIdentical(spelt("gěi"), "geei");
    assertIdentical(spelt("huǒ"), "huoo");
    assertIdentical(spelt("gǒu"), "goou");
    assertIdentical(spelt("jiě"), "jiee");
  });

  it("writes the fourth tone on the last letter, or as an -h", () => {
    assertIdentical(spelt("dài"), "day");
    assertIdentical(spelt("suì"), "suey");
    assertIdentical(spelt("dào"), "daw");
    assertIdentical(spelt("gòu"), "gow");
    assertIdentical(spelt("duàn"), "duann");
    assertIdentical(spelt("èr"), "ell");
    assertIdentical(spelt("bìng"), "binq");
    assertIdentical(spelt("dà"), "dah");
    assertIdentical(spelt("dì"), "dih");
    // ⇏iw: the u of ü is not the second half of a diphthong, so 去 is chiuh.
    assertIdentical(spelt("qù"), "chiuh");
  });

  it("puts y- or w- on a syllable with no initial, in tones 2 to 4", () => {
    // The basic form has neither, which is why 一 yī is `i` and 屋 wū is `u`.
    assertArrayEquals(tones("yi"), ["i", "yi", "yii", "yih"]);
    assertArrayEquals(tones("wu"), ["u", "wu", "wuu", "wuh"]);
    assertArrayEquals(tones("yin"), ["in", "yn", "yiin", "yinn"]);
    assertArrayEquals(tones("ying"), ["ing", "yng", "yiing", "yinq"]);
    // Where the i or u is a medial it is replaced rather than kept.
    assertArrayEquals(tones("yu"), ["iu", "yu", "yeu", "yuh"]);
    assertArrayEquals(tones("wo"), ["uo", "wo", "woo", "woh"]);
    assertArrayEquals(tones("ye"), ["ie", "ye", "yee", "yeh"]);
    assertArrayEquals(tones("weng"), ["ueng", "weng", "woeng", "wenq"]);
    assertArrayEquals(tones("yong"), ["iong", "yong", "yeong", "yonq"]);
    // And a rime starting with neither takes no glide at all.
    assertArrayEquals(tones("ai"), ["ai", "air", "ae", "ay"]);
    assertArrayEquals(tones("er"), ["el", "erl", "eel", "ell"]);
  });

  it("writes an unwritten tone as the basic form, as it must", () => {
    // GR has no toneless spelling: the basic form is the first tone, so this
    // is the same shortfall bopomofo has with its unmarked first tone.
    assertIdentical(spelt("shan"), "shan");
    assertIdentical(spelt("shān"), "shan");
  });

  it("writes the neutral tone as a dot in front of the original tone", () => {
    // 没有 méiyou is `mei.yeou`: the dot says the tone is neutral and the
    // spelling behind it is still 有 yǒu's third.
    assertIdentical(
      writeGwoyeu({ ...syllable("you5"), originalTone: 3 }),
      ".yeou",
    );
    assertIdentical(
      writeGwoyeu({ ...syllable("le5"), originalTone: 4 }),
      ".leh",
    );
  });

  it("writes the basic form where there is no original tone to keep", () => {
    // Which is what a syllable that is neutral in its own right takes: 什么
    // shénme is `shern.me`. The basic form is the second tone for a sonorant
    // initial, not the first, so this is `.me` and never `.mhe`.
    assertIdentical(spelt("de5"), ".de");
    assertIdentical(spelt("me5"), ".me");
    assertIdentical(spelt("ma5"), ".ma");
    assertIdentical(spelt("you5"), ".iou");
  });

  it("fuses 儿化 into the rime rather than suffixing it", () => {
    // The rules of *Spelling in Gwoyeu Romatzyh*, rime by rime: the -n goes,
    // the empty rhyme becomes e, and the tone is spelled onto what is left.
    assertIdentical(spelt("huār"), "hual");
    assertIdentical(spelt("wánr"), "wal");
    assertIdentical(spelt("shìr"), "shell");
    assertIdentical(spelt("nàr"), "nall");
    assertIdentical(spelt("nǎr"), "naal");
    assertIdentical(spelt("háir"), "harl");
    assertIdentical(spelt("ménr"), "mel");
    assertIdentical(spelt("jīnr"), "jiel");
    assertIdentical(spelt("wèir"), "well");
    assertIdentical(spelt("diǎnr"), "deal");
  });

  it("writes the apostrophe the fused rimes need to stay apart", () => {
    // `e` rhotacised would otherwise be the `el` that en, ei and the empty
    // rhyme already give, and 这儿 zhèr would be 郑儿 zhèngr.
    assertIdentical(spelt("gēr"), "ge'l");
    assertIdentical(spelt("zhèr"), "jehl");
    assertIdentical(spelt("gēnr"), "gel");
    // ie and iue take one in the first two tones only.
    assertIdentical(spelt("xiér"), "shye'l");
    assertIdentical(spelt("xiěr"), "shieel");
  });

  it("spells the fourth tone by doubling the l, or not", () => {
    // `-l` doubles, except where the rime has a fourth tone of its own to
    // spell and the l goes on the end of that.
    assertIdentical(spelt("huàr"), "huall");
    assertIdentical(spelt("dàor"), "dawl");
    assertIdentical(spelt("dòur"), "dowl");
    assertIdentical(spelt("bàngr"), "banql");
    assertIdentical(spelt("dòngr"), "donql");
  });

  it("writes a word solid, as GR does", () => {
    assertIdentical(
      writeGwoyeuWord([syllable("běi"), syllable("jīng")]),
      "beeijing",
    );
    assertIdentical(
      writeGwoyeuWord([syllable("zhōng"), syllable("guó")]),
      "jonggwo",
    );
  });

  it("applies the rules mechanically to the syllabic nasals", () => {
    // GR has no attested spelling for any of these, and the source syllabary
    // does not list them; what they get is the general rules over the letters
    // they have. 唔 is the one syllable where two tones collide.
    assertArrayEquals(tones("m"), ["m", "mr", "mm", "mh"]);
    assertArrayEquals(tones("n"), ["n", "nr", "nn", "nn"]);
    assertArrayEquals(tones("ng"), ["ng", "ngr", "ngg", "nq"]);
    assertArrayEquals(tones("hng"), ["hng", "hngr", "hngg", "hnq"]);
  });
});

describe("reading Gwoyeu Romatzyh", () => {
  it("reads a spelling back to pinyin, tone and all", () => {
    assertArrayEquals(read("jiow"), ["jiù"]);
    assertArrayEquals(read("shaan"), ["shǎn"]);
    assertArrayEquals(read("mha"), ["mā"]);
    assertArrayEquals(read("ma"), ["má"]);
    assertArrayEquals(read("Beei"), ["běi"]);
    assertArrayEquals(read("  jinq  "), ["jìng"]);
  });

  it("reads a leading dot as the neutral tone, whatever the spelling says", () => {
    // This is the one place where reading is less limited than writing: GR
    // writes the etymological tone behind the dot, and the tone that comes
    // back is the neutral one regardless.
    assertArrayEquals(read(".yeou"), ["you"]);
    assertIdentical(readGwoyeu(".yeou")[0]?.tone, NEUTRAL_TONE);
    assertIdentical(readGwoyeu(".de")[0]?.tone, NEUTRAL_TONE);
  });

  it("reads the fused rimes, and everything they collapsed together", () => {
    assertArrayEquals(read("shell"), ["shènr", "shìr"]);
    assertArrayEquals(read("deal"), ["diǎr", "diǎnr"]);
    // The fusion is many-to-one and this is the cost of it: 花儿 huār and
    // 欢儿 huānr are the same spelling, since the -n is not there to hear.
    assertArrayEquals(read("hual"), ["huār", "huānr"]);
    assertArrayEquals(read("jiel"), ["jīr", "jīnr"]);
    // `ell` is 二 èr itself, and also en, ei and the empty rhyme rhotacised in
    // the fourth tone, all three of which fuse to the same `el`.
    assertArrayEquals(read("ell"), ["èir", "ènr", "èr"]);
  });

  it("gives back both syllables where the spellings collide", () => {
    // The syllabic nasal doubles to `nn` in the third tone and takes the
    // fourth tone's -n → -nn as well.
    assertArrayEquals(read("nn"), ["ň", "ǹ"]);
  });

  it("reads nothing for what is not Gwoyeu Romatzyh", () => {
    assertArrayLength(read(""), 0);
    assertArrayLength(read("ㄓ"), 0);
    assertArrayLength(read("jiù"), 0);
    // A regular GR spelling of a syllable Mandarin does not have, with and
    // without the suffix that would otherwise be tried.
    assertArrayLength(read("shong"), 0);
    assertArrayLength(read("shongl"), 0);
    assertArrayLength(read("l"), 0);
  });
});

describe("Gwoyeu Romatzyh over the whole inventory", () => {
  it("writes every syllable in every tone and reads it back", () => {
    // Over the tones each syllable is written in, since reading narrows on
    // the tone: `ell` is 二 èr and 诶儿 êir, and neither is a first tone.
    //
    // The neutral tone carries an original tone through, because that is what
    // GR spells behind the dot; without one the basic form is written, and it
    // reads back as the tone that form means. So the round trip is exact only
    // where there was an original tone to keep, and the tone written in is the
    // one asserted below.
    let checked = 0;
    for (const [spelling, tones] of SYLLABLE_TONES) {
      const base = syllable(spelling);
      for (const tone of tones) {
        for (const erhua of [false, true]) {
          const form = {
            ...base,
            tone,
            ...(erhua && { erhua: true }),
            ...(tone === NEUTRAL_TONE && { originalTone: 4 as const }),
          };
          const back = readGwoyeu(writeGwoyeu(form));
          // 儿化 is matched too, because one fused spelling is several
          // syllables — `hual` is 花儿 huār and 欢儿 huānr alike.
          const found = back.find(
            (candidate) =>
              candidate.initial === form.initial &&
              candidate.final === form.final &&
              candidate.tone === form.tone &&
              candidate.originalTone === form.originalTone &&
              (candidate.erhua === true) === erhua,
          );
          assertObjectEquals(found, form, spelling);
          checked += 1;
        }
      }
    }
    assertIdentical(checked, 1708 * 2);
  });

  it("gives every one of the 424 syllables its own basic form", () => {
    const basic = [...DICTIONARY_SYLLABLES].map((pinyin) =>
      writeGwoyeu({ ...syllable(pinyin), tone: 1 }),
    );
    assertArrayLength(basic, 424);
    assertSetSize(new Set(basic), 424);
  });

  it("gives 1,695 spellings to 424 syllables in four tones", () => {
    const spellings = [...DICTIONARY_SYLLABLES].flatMap((pinyin) =>
      CONTOUR_TONES.map((tone) => writeGwoyeu({ ...syllable(pinyin), tone })),
    );
    assertArrayLength(spellings, 1696);
    assertSetSize(new Set(spellings), 1695);
  });
});
