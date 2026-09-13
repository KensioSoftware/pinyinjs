import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { toCharacters } from "../script/characters.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  applySandhi,
  type SandhiGrouping,
  type SandhiOptions,
} from "./sandhi.js";

/**
 * Read a reading the way the dictionary stores one: fully toned.
 */
function reading(text: string): readonly Syllable[] {
  return text.split(" ").map((token) => {
    const syllable = readSyllable(token);
    if (syllable === undefined) {
      throw new Error(`not a syllable: ${token}`);
    }
    return { ...syllable, tone: syllable.tone ?? NEUTRAL_TONE };
  });
}

/**
 * Apply sandhi and write the result back out.
 */
function sandhied(
  text: string,
  options?: SandhiOptions,
  grouping?: SandhiGrouping,
): readonly string[] {
  return applySandhi(reading(text), options, grouping).map((syllable) =>
    writeSyllable(syllable),
  );
}

/**
 * Apply sandhi to a reading whose 汉字 the caller knows, the way `convert` does.
 *
 * The characters are written as one string, one per syllable, and the words as
 * the syllable counts a {@link SandhiGrouping} holds.
 */
function converted(
  text: string,
  hanzi: string,
  grouping?: SandhiGrouping,
): readonly string[] {
  return applySandhi(
    reading(text),
    undefined,
    grouping,
    toCharacters(hanzi),
  ).map((syllable) => writeSyllable(syllable));
}

/**
 * The third-tone sandhi of a grouped reading, which is what it is stated over.
 */
function said(text: string, grouping?: SandhiGrouping): readonly string[] {
  return sandhied(text, { thirdTone: true }, grouping);
}

describe("tone sandhi", () => {
  describe("一", () => {
    it("flattens to second tone before a fourth", () => {
      assertArrayEquals(sandhied("yī gè"), ["yí", "gè"]);
      assertArrayEquals(sandhied("yī yàng"), ["yí", "yàng"]);
    });

    it("raises to fourth tone before first, second and third", () => {
      assertArrayEquals(sandhied("yī tiān"), ["yì", "tiān"]);
      assertArrayEquals(sandhied("yī nián"), ["yì", "nián"]);
      assertArrayEquals(sandhied("yī qǐ"), ["yì", "qǐ"]);
    });

    it("keeps its citation tone with nothing to assimilate to", () => {
      // 第一 is dìyī: nothing follows, so nothing changes it.
      assertArrayEquals(sandhied("dì yī"), ["dì", "yī"]);
    });

    it("keeps its citation tone before a neutral syllable", () => {
      assertArrayEquals(sandhied("yī ge"), ["yī", "ge"]);
    });

    it("leaves a 一 that is not first tone alone", () => {
      // Anything already retoned came from a source that baked sandhi in, and
      // the dictionary is supposed to have normalised that out.
      assertArrayEquals(sandhied("yì tiān"), ["yì", "tiān"]);
    });

    it("keeps its citation tone as the last digit of a number", () => {
      // 一 sandhi is about the 一 that counts. 十一月 is `shíyīyuè` and
      // 二十一岁 is `èrshíyī suì`: the 一 is a digit rather than a quantity.
      assertArrayEquals(sandhied("shí yī yuè"), ["shí", "yī", "yuè"]);
      assertArrayEquals(sandhied("èr shí yī suì"), ["èr", "shí", "yī", "suì"]);
      assertArrayEquals(sandhied("wǔ shí yī běn"), ["wǔ", "shí", "yī", "běn"]);
      // 万一 is the same shape and wants the same answer.
      assertArrayEquals(sandhied("wàn yī nǐ"), ["wàn", "yī", "nǐ"]);
    });

    it("still counts where a number carries on past it", () => {
      // 一百一十's second 一 counts the ten after it, so it assimilates as
      // usual; only a 一 with nothing numeric after it is a last digit.
      assertArrayEquals(sandhied("yī bǎi yī shí"), ["yì", "bǎi", "yì", "shí"]);
      assertArrayEquals(sandhied("yī qiān yī bǎi"), [
        "yì",
        "qiān",
        "yì",
        "bǎi",
      ]);
    });

    it("keeps its citation tone as an ordinal after 第", () => {
      assertArrayEquals(sandhied("dì yī gè"), ["dì", "yī", "gè"]);
      assertArrayEquals(sandhied("dì yī cì"), ["dì", "yī", "cì"]);
    });

    it("still assimilates where nothing says it is not counting", () => {
      assertArrayEquals(sandhied("yī gè"), ["yí", "gè"]);
      assertArrayEquals(sandhied("yī bǎi"), ["yì", "bǎi"]);
      assertArrayEquals(sandhied("mǎi yī gè"), ["mǎi", "yí", "gè"]);
    });

    it("cannot tell 十 from 时, and says so", () => {
      // The pass sees readings and never characters, so 当时一个人 loses a
      // sandhi it should keep. `docs/sandhi/` carries what that costs over
      // real text — 41 conversions against 520 put right.
      assertArrayEquals(sandhied("dāng shí yī gè"), [
        "dāng",
        "shí",
        "yī",
        "gè",
      ]);
    });

    it("does not touch another syllable spelled yi", () => {
      assertArrayEquals(sandhied("yí dòng"), ["yí", "dòng"]);
    });

    it("leaves a first-tone yi that is not 一 alone", () => {
      // The rule is about one character, not about a spelling. 医, 依, 衣 and
      // 伊 are all `yī` and none of them retones for what follows it.
      assertArrayEquals(converted("yī shēng", "医生"), ["yī", "shēng"]);
      assertArrayEquals(converted("yī yuàn", "医院"), ["yī", "yuàn"]);
      assertArrayEquals(converted("yī rán", "依然"), ["yī", "rán"]);
      assertArrayEquals(converted("yī kào", "依靠"), ["yī", "kào"]);
      // The real 一 still assimilates beside them.
      assertArrayEquals(converted("yī gè", "一个"), ["yí", "gè"]);
      assertArrayEquals(converted("yī tiān", "一天"), ["yì", "tiān"]);
    });

    it("cannot tell 一 from 医 without the characters, and says so", () => {
      // What bare pinyin costs: `pinyinjs sandhi yīshēng` is handed a spelling
      // and nothing else, and the spelling is not the morpheme.
      assertArrayEquals(sandhied("yī shēng"), ["yì", "shēng"]);
    });

    it("keeps a 一 that closes a longer word", () => {
      // 唯一 is `wéiyī` in front of anything: its 一 counts nothing, because
      // what follows it is outside the word. 之一, 统一 and 星期一 likewise.
      assertArrayEquals(converted("wéi yī bàn fǎ", "唯一办法", [2, 2]), [
        "wéi",
        "yī",
        "bàn",
        "fǎ",
      ]);
      assertArrayEquals(converted("tǒng yī zhōng guó", "统一中国", [2, 2]), [
        "tǒng",
        "yī",
        "zhōng",
        "guó",
      ]);
      assertArrayEquals(converted("xīng qī yī qù", "星期一去", [3, 1]), [
        "xīng",
        "qī",
        "yī",
        "qù",
      ]);
    });

    it("still assimilates where the 一 is a word of its own", () => {
      // Which is the whole difference: 一 counting 个 is one word leaning on
      // the next, where the 一 of 唯一 is the tail of the word it is in.
      assertArrayEquals(converted("yī gè", "一个", [1, 1]), ["yí", "gè"]);
      assertArrayEquals(converted("mǎi yī gè", "买一个", [1, 1, 1]), [
        "mǎi",
        "yí",
        "gè",
      ]);
    });

    it("reads no word ends out of a grouping that does not fit", () => {
      // Same judgement third-tone sandhi makes: a grouping that does not
      // account for exactly these syllables is describing some other text.
      assertArrayEquals(converted("wéi yī bàn fǎ", "唯一办法", [2]), [
        "wéi",
        "yí",
        "bàn",
        "fǎ",
      ]);
    });
  });

  describe("不", () => {
    it("flattens to second tone before a fourth", () => {
      assertArrayEquals(sandhied("bù shì"), ["bú", "shì"]);
      assertArrayEquals(sandhied("bù duì"), ["bú", "duì"]);
    });

    it("stays fourth tone before anything else", () => {
      assertArrayEquals(sandhied("bù hǎo"), ["bù", "hǎo"]);
      assertArrayEquals(sandhied("bù duō"), ["bù", "duō"]);
    });

    it("stays fourth tone at the end", () => {
      assertArrayEquals(sandhied("hǎo bù"), ["hǎo", "bù"]);
    });

    it("leaves a fourth-tone bu that is not 不 alone", () => {
      // 部, 布, 步 and 埠 are all `bù` and none of them flattens, inside a word
      // or across the boundary after one.
      assertArrayEquals(converted("bù duì", "部队"), ["bù", "duì"]);
      assertArrayEquals(converted("bù fèn", "部分"), ["bù", "fèn"]);
      assertArrayEquals(converted("quán bù shì", "全部是"), [
        "quán",
        "bù",
        "shì",
      ]);
      // The real 不 still flattens beside them.
      assertArrayEquals(converted("bù shì", "不是"), ["bú", "shì"]);
    });

    it("keeps assimilating at the end of a word, unlike 一", () => {
      // What 不 negates is regularly in the next word, so a word-final 不 is
      // still facing the tone it assimilates to.
      assertArrayEquals(converted("jué bù huì", "决不会", [2, 1]), [
        "jué",
        "bú",
        "huì",
      ]);
    });

    it("assimilates across a word boundary", () => {
      // The whole reason sandhi is a pass over the syllable array rather than
      // something baked into an entry: 不 and 客气 are separate words, and the
      // 客 that retones the 不 is in the second of them.
      assertArrayEquals(sandhied("bù kè qi"), ["bú", "kè", "qi"]);
      assertArrayEquals(sandhied("bù shì wǒ"), ["bú", "shì", "wǒ"]);
    });
  });

  describe("third tone", () => {
    it("is not written by default, since orthography writes underlying tones", () => {
      assertArrayEquals(sandhied("nǐ hǎo"), ["nǐ", "hǎo"]);
    });

    it("is written when the caller asks for it", () => {
      assertArrayEquals(sandhied("nǐ hǎo", { thirdTone: true }), ["ní", "hǎo"]);
    });

    it("reads left to right off the underlying tones", () => {
      // Not `ní ní hǎo`: the middle syllable is judged against the third tone
      // that follows it, not against what it was just rewritten to.
      assertArrayEquals(sandhied("wǒ hěn hǎo", { thirdTone: true }), [
        "wó",
        "hén",
        "hǎo",
      ]);
    });

    it("takes the whole reading for one word where no grouping is given", () => {
      // What a caller holding nothing but a reading has, and the only thing
      // that can be assumed from one.
      assertArrayEquals(said("zhǎn lǎn guǎn"), ["zhán", "lán", "guǎn"]);
    });

    describe("inside a word", () => {
      it("lowers every third tone but the last", () => {
        assertArrayEquals(said("zhǎn lǎn guǎn", [3]), ["zhán", "lán", "guǎn"]);
      });

      it("settles a division before the junction around it", () => {
        // 展覽館 divides as 展覽 + 館, so 覽 lowers against 館; 紙老虎 divides as
        // 紙 + 老虎, so 老 lowers against 虎 first and 紙 is left facing a second
        // tone. Same rule, opposite results, decided by where the word divides.
        assertArrayEquals(said("zhǎn lǎn guǎn", [[2, 1]]), [
          "zhán",
          "lán",
          "guǎn",
        ]);
        assertArrayEquals(said("zhǐ lǎo hǔ", [[1, 2]]), ["zhǐ", "láo", "hǔ"]);
      });
    });

    describe("across a word boundary", () => {
      it("lowers a monosyllabic word, which leans on the word after it", () => {
        assertArrayEquals(said("wǒ yě hěn hǎo", [1, 1, 1, 1]), [
          "wó",
          "yé",
          "hén",
          "hǎo",
        ]);
        assertArrayEquals(said("hěn xǐ huan", [1, 2]), ["hén", "xǐ", "huan"]);
      });

      it("leaves a word that ends in a third tone alone", () => {
        // 行長 and 很喜歡 are two feet, not one: `hángzhǎng hén xǐhuan`, where a
        // scan blind to the boundary lowers the 長 as well.
        assertArrayEquals(said("háng zhǎng hěn xǐ huan", [2, 1, 2]), [
          "háng",
          "zhǎng",
          "hén",
          "xǐ",
          "huan",
        ]);
        assertArrayEquals(said("lǎo bǎn hěn hǎo", [2, 1, 1]), [
          "láo",
          "bǎn",
          "hén",
          "hǎo",
        ]);
      });

      it("leaves a monosyllable facing a word that lowered its own first", () => {
        // 老保管 is `lǎo báoguǎn`: 保 lowered against 管 inside 保管, so there is
        // no third tone left for 老 to lower against.
        assertArrayEquals(said("lǎo bǎo guǎn", [1, 2]), ["lǎo", "báo", "guǎn"]);
      });
    });

    it("ignores a grouping that does not account for the syllables", () => {
      assertArrayEquals(said("nǐ hǎo hǎo", [1, 1]), ["ní", "háo", "hǎo"]);
    });
  });

  describe("switching it off", () => {
    it("leaves 一 and 不 alone", () => {
      assertArrayEquals(sandhied("yī gè", { yiBu: false }), ["yī", "gè"]);
      assertArrayEquals(sandhied("bù shì", { yiBu: false }), ["bù", "shì"]);
    });
  });

  it("does not modify the reading it was given", () => {
    const original = reading("yī gè");
    applySandhi(original);
    assertArrayEquals(
      original.map((syllable) => writeSyllable(syllable)),
      ["yī", "gè"],
    );
  });

  it("passes an empty reading through", () => {
    assertArrayEquals(applySandhi([]), []);
  });
});
