import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { READING_RULES, VERBAL_READING } from "./reading-rules.js";

/**
 * A dictionary of its own for the nine characters, each stored with the
 * reading that is not the verb's first.
 *
 * The compounds are the ones the frames have to step around: 词汇量 and 关系
 * hold their character, 气调 and 系上 cross a commoner word, and 士量 is an
 * untagged pair reading 量 the wrong way.
 */
const verbDictionary = dictionaryOf([
  entry("量", "liàng", {
    partOfSpeech: "n",
    frequency: 20_000,
    alternates: [reading("liáng")],
  }),
  entry("数", "shù", {
    partOfSpeech: "n",
    frequency: 20_000,
    alternates: [reading("shǔ")],
  }),
  entry("调", "diào", {
    partOfSpeech: "v",
    frequency: 20_000,
    alternates: [reading("tiáo")],
  }),
  entry("系", "xì", {
    partOfSpeech: "v",
    frequency: 20_000,
    alternates: [reading("jì")],
  }),
  entry("转", "zhuǎn", {
    partOfSpeech: "v",
    frequency: 20_000,
    alternates: [reading("zhuàn")],
  }),
  entry("钉", "dīng", {
    partOfSpeech: "v",
    frequency: 5000,
    alternates: [reading("dìng")],
  }),
  entry("结", "jié", {
    partOfSpeech: "n",
    frequency: 20_000,
    alternates: [reading("jiē")],
  }),
  entry("相", "xiāng", {
    partOfSpeech: "v",
    frequency: 20_000,
    alternates: [reading("xiàng")],
  }),
  entry("冲", "chōng", {
    partOfSpeech: "v",
    frequency: 9000,
    alternates: [reading("chòng")],
  }),
  entry("我", "wǒ", { partOfSpeech: "r", frequency: 90_000 }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 90_000 }),
  entry("请", "qǐng", { partOfSpeech: "v", frequency: 30_000 }),
  entry("在", "zài", { partOfSpeech: "p", frequency: 90_000 }),
  entry("正在", "zhèng zài", { partOfSpeech: "t", frequency: 9000 }),
  entry("开始", "kāi shǐ", { partOfSpeech: "v", frequency: 9000 }),
  entry("了", "le", { partOfSpeech: "ul", frequency: 90_000 }),
  entry("过", "guo", { partOfSpeech: "ug", frequency: 40_000 }),
  entry("着", "zhe", { partOfSpeech: "uz", frequency: 40_000 }),
  entry("的", "de", { partOfSpeech: "uj", frequency: 95_000 }),
  entry("很", "hěn", { partOfSpeech: "d", frequency: 50_000 }),
  entry("太", "tài", { partOfSpeech: "d", frequency: 30_000 }),
  entry("一", "yī", { partOfSpeech: "m", frequency: 90_000 }),
  entry("三", "sān", { partOfSpeech: "m", frequency: 30_000 }),
  entry("十", "shí", { partOfSpeech: "m", frequency: 30_000 }),
  entry("张", "zhāng", { partOfSpeech: "q", frequency: 20_000 }),
  entry("一下", "yī xià", { partOfSpeech: "m", frequency: 9000 }),
  entry("到", "dào", { partOfSpeech: "v", frequency: 50_000 }),
  entry("上", "shàng", { partOfSpeech: "f", frequency: 60_000 }),
  entry("好", "hǎo", { partOfSpeech: "a", frequency: 60_000 }),
  entry("低", "dī", { partOfSpeech: "a", frequency: 9000 }),
  entry("高", "gāo", { partOfSpeech: "a", frequency: 9000 }),
  entry("满", "mǎn", { partOfSpeech: "a", frequency: 9000 }),
  entry("进", "jìn", { partOfSpeech: "v", frequency: 20_000 }),
  entry("被", "bèi", { partOfSpeech: "p", frequency: 20_000 }),
  entry("往", "wǎng", { partOfSpeech: "p", frequency: 20_000 }),
  entry("凉", "liáng", { partOfSpeech: "a", frequency: 3000 }),
  entry("地", "dì", { partOfSpeech: "n", frequency: 20_000 }),
  entry("球", "qiú", { partOfSpeech: "n", frequency: 9000 }),
  entry("地球", "dì qiú", { partOfSpeech: "n", frequency: 5000 }),
  entry("绕", "rào", { partOfSpeech: "v", frequency: 3000 }),
  entry("圈", "quān", { partOfSpeech: "q", frequency: 3000 }),
  entry("起来", "qǐ lai", { partOfSpeech: "v", frequency: 9000 }),
  entry("运", "yùn", { partOfSpeech: "v", frequency: 3000 }),
  entry("音", "yīn", { partOfSpeech: "n", frequency: 3000 }),
  entry("杯", "bēi", { partOfSpeech: "q", frequency: 3000 }),
  entry("茶", "chá", { partOfSpeech: "n", frequency: 3000 }),
  entry("体温", "tǐ wēn", { partOfSpeech: "n", frequency: 900 }),
  entry("病人", "bìng rén", { partOfSpeech: "n", frequency: 900 }),
  entry("词汇", "cí huì", { partOfSpeech: "n", frequency: 900 }),
  entry("词汇量", "cí huì liàng", { partOfSpeech: "n", frequency: 300 }),
  entry("汇量", "huì liàng", { partOfSpeech: "n", frequency: 5 }),
  entry("大", "dà", { partOfSpeech: "a", frequency: 60_000 }),
  entry("打", "dǎ", { partOfSpeech: "v", frequency: 30_000 }),
  entry("士", "shì", { partOfSpeech: "ng", frequency: 3000 }),
  entry("护士", "hù shi", { partOfSpeech: "n", frequency: 900 }),
  entry("士量", "shì liàng", { frequency: 10 }),
  entry("进地", "jìn dì", { frequency: 10 }),
  entry("紧", "jǐn", { partOfSpeech: "a", frequency: 9000 }),
  entry("系紧", "jì jǐn", { frequency: 10 }),
  entry("羊", "yáng", { partOfSpeech: "n", frequency: 3000 }),
  entry("小时", "xiǎo shí", { partOfSpeech: "n", frequency: 9000 }),
  entry("岁", "suì", { partOfSpeech: "q", frequency: 9000 }),
  entry("人", "rén", { partOfSpeech: "n", frequency: 90_000 }),
  entry("冷气", "lěng qì", { partOfSpeech: "n", frequency: 900 }),
  entry("气调", "qì diào", { partOfSpeech: "n", frequency: 20 }),
  entry("领带", "lǐng dài", { partOfSpeech: "n", frequency: 300 }),
  entry("历史", "lì shǐ", { partOfSpeech: "n", frequency: 9000 }),
  entry("关系", "guān xì", { partOfSpeech: "n", frequency: 9000 }),
  entry("系上", "jì shàng", { partOfSpeech: "v", frequency: 20 }),
  entry("联", "lián", { partOfSpeech: "v", frequency: 3000 }),
  entry("身", "shēn", { partOfSpeech: "n", frequency: 9000 }),
  entry("十字架", "shí zì jià", { partOfSpeech: "n", frequency: 300 }),
  entry("根", "gēn", { partOfSpeech: "q", frequency: 9000 }),
  entry("果实", "guǒ shí", { partOfSpeech: "n", frequency: 300 }),
  entry("桃", "táo", { partOfSpeech: "n", frequency: 300 }),
  entry("婚", "hūn", { partOfSpeech: "n", frequency: 3000 }),
  entry("果", "guǒ", { partOfSpeech: "n", frequency: 3000 }),
  entry("会", "huì", { partOfSpeech: "v", frequency: 40_000 }),
  entry("照", "zhào", { partOfSpeech: "v", frequency: 9000 }),
  entry("照相", "zhào xiàng", { partOfSpeech: "v", frequency: 900 }),
  entry("按照", "àn zhào", { partOfSpeech: "p", frequency: 9000 }),
  entry("互相", "hù xiāng", { partOfSpeech: "d", frequency: 9000 }),
  entry("帮", "bāng", { partOfSpeech: "v", frequency: 9000 }),
  entry("味道", "wèi dao", { partOfSpeech: "n", frequency: 900 }),
  entry("冲动", "chōng dòng", { partOfSpeech: "a", frequency: 900 }),
  entry("来", "lái", { partOfSpeech: "v", frequency: 60_000 }),
  entry("数儿", "shùr", { partOfSpeech: "n", frequency: 30 }),
]);

/** How a run reads, word by word. */
function readVerb(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(verbDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("量 where it is measuring", () => {
  it("reads liáng before aspect, a count of times or what is measured", () => {
    assertArrayEquals(readVerb("我量了体温"), ["wǒ", "liáng", "le", "tǐwēn"]);
    assertArrayEquals(readVerb("请量一下"), ["qǐng", "liáng", "yīxià"]);
    assertArrayEquals(readVerb("我量体温"), ["wǒ", "liáng", "tǐwēn"]);
  });

  it("reads liàng before aspect without the rule, which is the bug", () => {
    assertArrayEquals(readVerb("我量了体温", []), [
      "wǒ",
      "liàng",
      "le",
      "tǐwēn",
    ]);
  });

  it("reads both halves of 量量 and 量了量 as the verb", () => {
    assertArrayEquals(readVerb("我量量"), ["wǒ", "liáng", "liáng"]);
    assertArrayEquals(readVerb("他量了量"), ["tā", "liáng", "le", "liáng"]);
  });

  it("reads liáng after 正在 with a noun to measure, and not without", () => {
    assertArrayEquals(readVerb("正在量病人"), ["zhèngzài", "liáng", "bìngrén"]);
    assertArrayEquals(readVerb("正在量"), ["zhèngzài", "liàng"]);
  });

  it("leaves 量 alone where a tagged word holds it", () => {
    assertArrayEquals(readVerb("词汇量很大"), ["cíhuìliàng", "hěn", "dà"]);
  });

  it("leaves 量 alone where a character binds it into a compound", () => {
    assertArrayEquals(readVerb("打量了"), ["dǎ", "liàng", "le"]);
  });

  it("takes an untagged pair reading 量 the other way off the lattice", () => {
    assertArrayEquals(readVerb("护士量了"), ["hùshi", "liáng", "le"]);
  });
});

describe("数 where it is counting", () => {
  it("reads shǔ before 到, aspect and a count of times", () => {
    assertArrayEquals(readVerb("数到十"), ["shǔ", "dào", "shí"]);
    assertArrayEquals(readVerb("我数了"), ["wǒ", "shǔ", "le"]);
    assertArrayEquals(readVerb("数一下"), ["shǔ", "yīxià"]);
  });

  it("reads shǔ after 开始 at the end of the run or before a noun", () => {
    assertArrayEquals(readVerb("开始数"), ["kāishǐ", "shǔ"]);
    assertArrayEquals(readVerb("开始数羊"), ["kāishǐ", "shǔ", "yáng"]);
  });

  it("leaves 数 alone where it counts hours or a numeral follows", () => {
    assertArrayEquals(readVerb("开始数小时"), ["kāishǐ", "shù", "xiǎoshí"]);
    assertArrayEquals(readVerb("开始数十"), ["kāishǐ", "shù", "shí"]);
    assertArrayEquals(readVerb("数十人"), ["shù", "shí", "rén"]);
  });

  it("leaves 数 alone after a numeral or a binding character", () => {
    assertArrayEquals(readVerb("十数到"), ["shí", "shù", "dào"]);
    assertArrayEquals(readVerb("岁数了"), ["suì", "shù", "le"]);
  });

  it("leaves 数 alone where nothing before it is a modal", () => {
    assertArrayEquals(readVerb("人数"), ["rén", "shù"]);
  });

  it("keeps a word whose reading is longer than its characters", () => {
    assertArrayEquals(readVerb("数儿"), ["shùr"]);
  });
});

describe("调 where it is adjusting or mixing", () => {
  it("reads tiáo before which way and before 过音", () => {
    assertArrayEquals(readVerb("调低"), ["tiáo", "dī"]);
    assertArrayEquals(readVerb("调过音"), ["tiáo", "guo", "yīn"]);
    assertArrayEquals(readVerb("调杯茶"), ["tiáo", "bēi", "chá"]);
  });

  it("reads tiáo where a rarer word crosses a commoner one", () => {
    assertArrayEquals(readVerb("冷气调高"), ["lěngqì", "tiáo", "gāo"]);
  });

  it("leaves 调 alone where it is a transfer", () => {
    assertArrayEquals(readVerb("调往"), ["diào", "wǎng"]);
    assertArrayEquals(readVerb("调过"), ["diào", "guo"]);
  });
});

describe("系 where it is tying", () => {
  it("reads jì before a complement or what is tied", () => {
    assertArrayEquals(readVerb("系好"), ["jì", "hǎo"]);
    assertArrayEquals(readVerb("系领带"), ["jì", "lǐngdài"]);
  });

  it("leaves an untagged pair reading 系 as the verb on the lattice", () => {
    assertArrayEquals(readVerb("系紧"), ["jì", "jǐn"]);
  });

  it("leaves 系 alone as a department", () => {
    assertArrayEquals(readVerb("历史系的"), ["lìshǐ", "xì", "de"]);
  });

  it("leaves the commoner of two crossing words to hold it", () => {
    assertArrayEquals(readVerb("关系上"), ["guānxì", "shàng"]);
  });

  it("leaves 系 alone where a character binds it", () => {
    assertArrayEquals(readVerb("联系好"), ["lián", "xì", "hǎo"]);
  });
});

describe("转 where it is turning round", () => {
  it("reads zhuàn closing a clause that goes round something", () => {
    assertArrayEquals(readVerb("绕着地球转"), ["rào", "zhe", "dìqiú", "zhuàn"]);
    assertArrayEquals(readVerb("绕着地球转了"), [
      "rào",
      "zhe",
      "dìqiú",
      "zhuàn",
      "le",
    ]);
  });

  it("reads zhuàn while it is still at it", () => {
    assertArrayEquals(readVerb("在转"), ["zài", "zhuàn"]);
  });

  it("reads zhuàn before 起来 and a number of laps", () => {
    assertArrayEquals(readVerb("转起来"), ["zhuàn", "qǐlai"]);
    assertArrayEquals(readVerb("转一圈"), ["zhuàn", "yī", "quān"]);
    assertArrayEquals(readVerb("转了三圈"), ["zhuàn", "le", "sān", "quān"]);
  });

  it("reads both halves of 转了转 as the verb", () => {
    assertArrayEquals(readVerb("他转了转"), ["tā", "zhuàn", "le", "zhuàn"]);
  });

  it("leaves 转 alone where it changes", () => {
    assertArrayEquals(readVerb("转凉了"), ["zhuǎn", "liáng", "le"]);
    assertArrayEquals(readVerb("绕着地球转身"), [
      "rào",
      "zhe",
      "dìqiú",
      "zhuǎn",
      "shēn",
    ]);
    assertArrayEquals(readVerb("转"), ["zhuǎn"]);
  });

  it("leaves 转 alone where a character binds it", () => {
    assertArrayEquals(readVerb("绕地球运转"), ["rào", "dìqiú", "yùn", "zhuǎn"]);
  });
});

describe("钉 where it is nailing", () => {
  it("reads dìng before where it goes, after 被 and before 十字架", () => {
    assertArrayEquals(readVerb("钉进地"), ["dìng", "jìn", "dì"]);
    assertArrayEquals(readVerb("被钉"), ["bèi", "dìng"]);
    assertArrayEquals(readVerb("钉十字架"), ["dìng", "shízìjià"]);
  });

  it("leaves 钉 alone as a nail", () => {
    assertArrayEquals(readVerb("一根钉"), ["yī", "gēn", "dīng"]);
  });
});

describe("结 where it bears fruit", () => {
  it("reads jiē with fruit for its object", () => {
    assertArrayEquals(readVerb("结满了果实"), ["jiē", "mǎn", "le", "guǒshí"]);
    assertArrayEquals(readVerb("结上好的桃"), [
      "jiē",
      "shàng",
      "hǎo",
      "de",
      "táo",
    ]);
  });

  it("leaves 结 alone where a noun that is not fruit comes first", () => {
    assertArrayEquals(readVerb("结了婚"), ["jié", "le", "hūn"]);
  });

  it("leaves 结 alone before a lone 果, which is 结果", () => {
    assertArrayEquals(readVerb("结果"), ["jié", "guǒ"]);
  });

  it("leaves 结 alone where the run ends or the fruit is out of reach", () => {
    assertArrayEquals(readVerb("会结"), ["huì", "jié"]);
    assertArrayEquals(readVerb("结很好很好很好的桃"), [
      "jié",
      "hěn",
      "hǎo",
      "hěn",
      "hǎo",
      "hěn",
      "hǎo",
      "de",
      "táo",
    ]);
  });
});

describe("相 where it is a photograph", () => {
  it("reads xiàng where 照 stands a count or a 的 before it", () => {
    assertArrayEquals(readVerb("照了一张相"), [
      "zhào",
      "le",
      "yī",
      "zhāng",
      "xiàng",
    ]);
    assertArrayEquals(readVerb("照的相"), ["zhào", "de", "xiàng"]);
  });

  it("leaves 相 alone where no 照 takes it", () => {
    assertArrayEquals(readVerb("互相"), ["hùxiāng"]);
    assertArrayEquals(readVerb("相"), ["xiāng"]);
    assertArrayEquals(readVerb("我相"), ["wǒ", "xiāng"]);
    assertArrayEquals(readVerb("照照相"), ["zhào", "zhàoxiàng"]);
  });

  it("leaves 相 alone where a word takes the 照", () => {
    assertArrayEquals(readVerb("按照的相"), ["ànzhào", "de", "xiāng"]);
  });
});

describe("冲 where it is strong", () => {
  it("reads chòng after a degree adverb closing the clause", () => {
    assertArrayEquals(readVerb("味道很冲"), ["wèidao", "hěn", "chòng"]);
    assertArrayEquals(readVerb("太冲了"), ["tài", "chòng", "le"]);
  });

  it("leaves 冲 alone where it rushes", () => {
    assertArrayEquals(readVerb("很冲动"), ["hěn", "chōngdòng"]);
    assertArrayEquals(readVerb("冲来"), ["chōng", "lái"]);
    assertArrayEquals(readVerb("很冲来"), ["hěn", "chōng", "lái"]);
  });
});

describe("the verbal reading rule on its own", () => {
  it("applies without the other rules", () => {
    assertArrayEquals(readVerb("数到十", [VERBAL_READING]), [
      "shǔ",
      "dào",
      "shí",
    ]);
  });
});
