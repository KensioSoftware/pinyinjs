import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { isUncertain } from "./confidence.js";
import { decodeRun, decodeRunScored } from "./decode.js";
import {
  ADJECTIVAL_CHANG,
  ATTESTED_ERHUA,
  CONCERNING_GAN,
  COUNTED_MEASURE,
  COUNTING_ZHI,
  DOMINANT_READING,
  EXPERIENTIAL_GUO,
  MODAL_DE,
  OBTAINING_DE,
  PARTICLE_DE,
  PLAYING_TAN,
  POTENTIAL_LIAO,
  READING_RULES,
  REDUPLICATED_VERB,
  RETURNING_HUAN,
  SEPARATED_COMPOUND,
  TEACHING_JIAO,
} from "./reading-rules.js";

/**
 * A dictionary carrying every case: 得 with its three readings, a 儿化 word the
 * text can reach through its last character, and a 量词 a common noun starts
 * with.
 */
const dictionary = dictionaryOf([
  entry("我", "wǒ", { partOfSpeech: "r" }),
  entry("你", "nǐ", { partOfSpeech: "r" }),
  entry("就", "jiù", { partOfSpeech: "d" }),
  entry("走", "zǒu", { partOfSpeech: "v", frequency: 4000 }),
  entry("跑", "pǎo", { partOfSpeech: "v", frequency: 2000 }),
  entry("快", "kuài", { partOfSpeech: "a", frequency: 3000 }),
  entry("了", "le", { partOfSpeech: "ul", frequency: 90_000 }),
  entry("得", "de", {
    partOfSpeech: "ud",
    frequency: 60_000,
    alternates: [reading("dé"), reading("děi")],
  }),
  entry("那", "nà", { partOfSpeech: "r", frequency: 30_000 }),
  entry("边", "biān", { frequency: 5000 }),
  entry("儿", "ér", { frequency: 3000 }),
  entry("那边", "nà bian", { partOfSpeech: "r", frequency: 900 }),
  entry("边儿", "biānr", { partOfSpeech: "n", frequency: 60 }),
  entry("女", "nǚ"),
  entry("女儿", "nǚ ér", { frequency: 700 }),
  entry("三", "sān", { partOfSpeech: "m", frequency: 20_000 }),
  entry("第", "dì", { partOfSpeech: "m", frequency: 20_000 }),
  entry("个", "gè", { partOfSpeech: "q", frequency: 90_000 }),
  entry("人", "rén", { partOfSpeech: "n", frequency: 80_000 }),
  // The swallow itself: a common noun starting with the 量词.
  entry("个人", "gè rén", { partOfSpeech: "n", frequency: 3000 }),
  entry("第三", "dì sān", { partOfSpeech: "m", frequency: 2000 }),
  // A 量词 the dictionary does not tag as one, which is what keeps 五分钟 whole.
  entry("分", "fēn", { partOfSpeech: "v", frequency: 20_000 }),
  entry("钟", "zhōng", { frequency: 3000 }),
  entry("分钟", "fēn zhōng", { partOfSpeech: "q", frequency: 2000 }),
  entry("五", "wǔ", { partOfSpeech: "m", frequency: 20_000 }),
  // 教, stored `jiào` with the verbal `jiāo` as an alternate, as the real
  // dictionary stores it — with a word for each reading and the untagged pair
  // that carries `jiào` across two characters.
  entry("教", "jiào", {
    partOfSpeech: "v",
    frequency: 20_000,
    alternates: [reading("jiāo")],
  }),
  entry("书", "shū", { partOfSpeech: "n", frequency: 20_000 }),
  entry("育", "yù", { frequency: 5000 }),
  entry("教育", "jiào yù", { partOfSpeech: "vn", frequency: 9000 }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 80_000 }),
  entry("来教", "lái jiào", { frequency: 30_000 }),
  entry("宗", "zōng", { frequency: 2000 }),
  entry("宗教", "zōng jiào", { partOfSpeech: "n", frequency: 4000 }),
  entry("来", "lái", { partOfSpeech: "v", frequency: 40_000 }),
  // A modal in front of a 教 that governs nothing after it.
  entry("怎么", "zěn me", { partOfSpeech: "r", frequency: 50_000 }),
]);

/**
 * A dictionary of its own for 的, kept apart for the reason 长's is.
 *
 * 的 is the commonest character in the language and its frequency alone
 * rescales the quantised table, which moves decisions in the 量词 cases that
 * have nothing to do with it.
 */
const deDictionary = dictionaryOf([
  entry("的", "de", {
    partOfSpeech: "uj",
    frequency: 95_000,
    alternates: [reading("dì"), reading("dí"), reading("dī")],
  }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 80_000 }),
  entry("真", "zhēn", { partOfSpeech: "d", frequency: 300 }),
  entry("名", "míng", { partOfSpeech: "ng", frequency: 8000 }),
  entry("字", "zì", { partOfSpeech: "n", frequency: 8000 }),
  entry("名字", "míng zi", { partOfSpeech: "n", frequency: 5000 }),
  entry("确", "què", { frequency: 4000 }),
  entry("知", "zhī", { frequency: 6000 }),
  entry("道", "dào", { partOfSpeech: "n", frequency: 20_000 }),
  entry("知道", "zhī dào", { partOfSpeech: "v", frequency: 40_000 }),
  // The pair the rule is about: a reading somebody asserted, carrying no part
  // of speech, against a word jieba counted and tagged.
  entry("的真", "dí zhēn"),
  entry("的确", "dí què", { partOfSpeech: "d", frequency: 4000 }),
]);

/**
 * A dictionary of its own for the taxi 的.
 *
 * Both shapes: a key beginning with the 的 and one ending with it, each against
 * the modifier, particle and head that spell the same characters.
 */
const taxiDictionary = dictionaryOf([
  entry("的", "de", {
    partOfSpeech: "uj",
    frequency: 95_000,
    alternates: [reading("dì"), reading("dí"), reading("dī")],
  }),
  entry("我", "wǒ", { partOfSpeech: "r", frequency: 80_000 }),
  entry("哥", "gē", { partOfSpeech: "n", frequency: 3000 }),
  entry("哥哥", "gē gē", { partOfSpeech: "n", frequency: 9000 }),
  entry("士", "shì", { partOfSpeech: "n", frequency: 3000 }),
  entry("打", "dǎ", { partOfSpeech: "v", frequency: 60_000 }),
  entry("电话", "diàn huà", { partOfSpeech: "n", frequency: 20_000 }),
  entry("去", "qù", { partOfSpeech: "v", frequency: 60_000 }),
  entry("面", "miàn", { partOfSpeech: "n", frequency: 30_000 }),
  entry("上", "shàng", { partOfSpeech: "f", frequency: 70_000 }),
  entry("上面", "shàng miàn", { partOfSpeech: "f", frequency: 20_000 }),
  // The taxi vocabulary, as the dictionary carries it: a tagged key jieba
  // counted and two readings nobody counted.
  entry("的士", "dī shì", { partOfSpeech: "n", frequency: 9 }),
  entry("的哥", "dī gē", { partOfSpeech: "n", frequency: 45 }),
  entry("打的", "dǎ dī"),
  entry("面的", "miàn dī"),
]);

/**
 * A dictionary of its own for the potential complement.
 *
 * 算得 is the shape: a key jieba counted and tagged, read `suàn dé` by the
 * phrase corpus, standing where the 得 is the particle.
 */
const potentialDictionary = dictionaryOf([
  entry("算", "suàn", { partOfSpeech: "v", frequency: 20_000 }),
  entry("取", "qǔ", { partOfSpeech: "v", frequency: 20_000 }),
  entry("只", "zhǐ", { partOfSpeech: "d", frequency: 40_000 }),
  entry("得", "de", {
    partOfSpeech: "ud",
    frequency: 60_000,
    alternates: [reading("dé"), reading("děi")],
  }),
  entry("上", "shàng", { partOfSpeech: "f", frequency: 80_000 }),
  entry("是", "shì", { partOfSpeech: "v", frequency: 90_000 }),
  entry("山", "shān", { partOfSpeech: "n", frequency: 20_000 }),
  entry("级", "jí", { partOfSpeech: "n", frequency: 10_000 }),
  entry("批准", "pī zhǔn", { partOfSpeech: "v", frequency: 3000 }),
  entry("上级", "shàng jí", { partOfSpeech: "b", frequency: 2000 }),
  entry("上山", "shàng shān", { partOfSpeech: "v", frequency: 2000 }),
  entry("算得", "suàn dé", { partOfSpeech: "v", frequency: 400 }),
  entry("取得", "qǔ dé", { partOfSpeech: "v", frequency: 9000 }),
  entry("只得", "zhǐ dé", { partOfSpeech: "v", frequency: 3000 }),
]);

/**
 * A dictionary of its own for 长, kept apart from the one above.
 *
 * The costs the decode works in are quantised from the frequencies of whatever
 * entries a dictionary holds, so adding 的 and 不 to the shared fixture rescales
 * the table and moves decisions in the 量词 cases that have nothing to do with
 * 长. Separate dictionaries keep each rule's cases from paying for the others'.
 */
const changDictionary = dictionaryOf([
  // 长 as the real dictionary stores it: `zhǎng` with the adjectival `cháng` as
  // an alternate, tagged `a`.
  entry("长", "zhǎng", {
    partOfSpeech: "a",
    frequency: 20_000,
    alternates: [reading("cháng")],
  }),
  entry("很", "hěn", { partOfSpeech: "zg", frequency: 40_000 }),
  entry("太", "tài", { partOfSpeech: "d", frequency: 30_000 }),
  entry("不", "bù", { partOfSpeech: "d", frequency: 90_000 }),
  entry("真", "zhēn", { partOfSpeech: "d", frequency: 20_000 }),
  entry("越", "yuè", { partOfSpeech: "d", frequency: 10_000 }),
  entry("非常", "fēi cháng", { partOfSpeech: "d", frequency: 9000 }),
  entry("大", "dà", { partOfSpeech: "a", frequency: 60_000 }),
  entry("快", "kuài", { partOfSpeech: "a", frequency: 30_000 }),
  entry("得", "de", {
    partOfSpeech: "ud",
    frequency: 60_000,
    alternates: [reading("dé"), reading("děi")],
  }),
  entry("了", "le", { partOfSpeech: "ul", frequency: 90_000 }),
  entry("的", "de", { partOfSpeech: "uj", frequency: 95_000 }),
  entry("路", "lù", { partOfSpeech: "n", frequency: 8000 }),
  // A title the rule must not reach, since the stored default is what carries
  // 署长, 团长 and 局长.
  entry("署", "shǔ", { partOfSpeech: "ng", frequency: 900 }),
  entry("高", "gāo", { partOfSpeech: "a", frequency: 50_000 }),
  // The predicative and attributive cases: a 量词, 有, a noun to modify, and a
  // verb's object for the shape the rule has to leave alone.
  entry("有", "yǒu", { partOfSpeech: "v", frequency: 80_000 }),
  entry("位", "wèi", { partOfSpeech: "q", frequency: 20_000 }),
  entry("头发", "tóu fa", { partOfSpeech: "n", frequency: 3000 }),
  entry("胡子", "hú zi", { partOfSpeech: "n", frequency: 2000 }),
  entry("在", "zài", { partOfSpeech: "p", frequency: 90_000 }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 90_000 }),
  entry("好", "hǎo", { partOfSpeech: "a", frequency: 70_000 }),
  // The contexts that need the far side: a comparison, a conjunction, a
  // measurement and the 量词 an ordinal makes adverbial.
  entry("一点", "yī diǎn", { partOfSpeech: "m", frequency: 20_000 }),
  entry("极了", "jí le", { frequency: 2000 }),
  entry("而", "ér", { partOfSpeech: "c", frequency: 50_000 }),
  entry("美丽", "měi lì", { partOfSpeech: "a", frequency: 8000 }),
  entry("三百", "sān bǎi", { partOfSpeech: "m", frequency: 3000 }),
  entry("公里", "gōng lǐ", { partOfSpeech: "q", frequency: 6000 }),
  entry("第一次", "dì yī cì", { partOfSpeech: "m", frequency: 9000 }),
  entry("次", "cì", { partOfSpeech: "q", frequency: 40_000 }),
  entry("一", "yī", { partOfSpeech: "m", frequency: 90_000 }),
  entry("一个", "yī gè", { partOfSpeech: "m", frequency: 80_000 }),
  entry("个", "gè", { partOfSpeech: "q", frequency: 90_000 }),
  entry("得很", "de hěn", { frequency: 1000 }),
  entry("胡子", "hú zi", { partOfSpeech: "n", frequency: 3000 }),
  // 越长 exactly as the artifact holds it: a `yuè cháng` reading carrying no
  // part of speech, and the only member of its paradigm — 越高 and 越好 are
  // absent here as they are there.
  entry("越长", "yuè cháng", { frequency: 400 }),
  // The span contexts: a span after the 长, a 又…又 around it, a verb of
  // becoming in front, a span or a time word as its subject, and a 比 that
  // compares where 比作 does not.
  entry("时间", "shí jiān", { partOfSpeech: "n", frequency: 30_000 }),
  entry("看", "kàn", { partOfSpeech: "v", frequency: 60_000 }),
  entry("又", "yòu", { partOfSpeech: "d", frequency: 40_000 }),
  entry("冷", "lěng", { partOfSpeech: "a", frequency: 9000 }),
  entry("变", "biàn", { partOfSpeech: "v", frequency: 20_000 }),
  entry("出", "chū", { partOfSpeech: "v", frequency: 50_000 }),
  entry("冬天", "dōng tiān", { partOfSpeech: "t", frequency: 3000 }),
  entry("比", "bǐ", { partOfSpeech: "p", frequency: 40_000 }),
  entry("比作", "bǐ zuò", { partOfSpeech: "v", frequency: 600 }),
  entry("我", "wǒ", { partOfSpeech: "r", frequency: 90_000 }),
  entry("树", "shù", { partOfSpeech: "n", frequency: 9000 }),
  entry("外套", "wài tào", { partOfSpeech: "n", frequency: 2000 }),
]);

/**
 * A dictionary of its own for 弹, kept apart for the reason 长's is: the costs
 * are quantised from whatever entries a dictionary holds, so the 量词 cases
 * should not pay for an instrument being added.
 */
const tanDictionary = dictionaryOf([
  // 弹 as the real dictionary stores it: `dàn` with the verbal `tán` as an
  // alternate, and tagged `v` for the verb the character mostly is.
  entry("弹", "dàn", {
    partOfSpeech: "v",
    frequency: 4000,
    alternates: [reading("tán")],
  }),
  entry("吉他", "jí tā", { partOfSpeech: "ns", frequency: 500 }),
  entry("吉", "jí", { frequency: 800 }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 80_000 }),
  entry("得", "de", {
    partOfSpeech: "ud",
    frequency: 60_000,
    alternates: [reading("dé"), reading("děi")],
  }),
  entry("的", "de", { partOfSpeech: "uj", frequency: 95_000 }),
  entry("好", "hǎo", { partOfSpeech: "a", frequency: 70_000 }),
  entry("和", "hé", { partOfSpeech: "c", frequency: 50_000 }),
  // 和弹 exactly as the artifact holds it: a `hé dàn` reading carrying no part
  // of speech, which is how the `dàn` reached 开车和弹吉他 from outside the
  // character's own edges.
  entry("和弹", "hé dàn", { frequency: 400 }),
  // A tagged word ending in 弹, which the rule must leave whole.
  entry("子", "zǐ", { frequency: 9000 }),
  entry("子弹", "zǐ dàn", { partOfSpeech: "n", frequency: 2000 }),
  // A bound morpheme with a noun's tag, which is what 弹洞, 掷弹兵 and 供弹爪
  // put where an object would go.
  entry("洞", "dòng", { partOfSpeech: "n", frequency: 5000 }),
  // The 繁體 character, which is a different one and has to be named as such.
  entry("彈", "dàn", {
    partOfSpeech: "v",
    frequency: 4000,
    alternates: [reading("tán")],
  }),
]);

/**
 * A dictionary of its own for 过, kept apart for the reason 长's is.
 *
 * 过 is stored the way the real dictionary stores it, with the toneless marker
 * and 过 the pot as alternates of the verb, and with the three shapes that
 * decide the rule around it. 见过 is a pair carrying no part of speech, 走过 is
 * a word jieba counted, and 睡过头 is a word of three characters.
 */
const guoDictionary = dictionaryOf([
  entry("我", "wǒ", { partOfSpeech: "r", frequency: 80_000 }),
  entry("不", "bù", { partOfSpeech: "d", frequency: 70_000 }),
  // The negator jieba tags a verb, as it tags the real one.
  entry("没", "méi", { hant: "沒", partOfSpeech: "v", frequency: 50_000 }),
  entry("过", "guò", {
    hant: "過",
    partOfSpeech: "ug",
    frequency: 60_000,
    alternates: [reading("guo"), reading("guō")],
  }),
  entry("去", "qù", { partOfSpeech: "v", frequency: 40_000 }),
  entry("见", "jiàn", { partOfSpeech: "v", frequency: 30_000 }),
  entry("走", "zǒu", { partOfSpeech: "v", frequency: 20_000 }),
  entry("睡", "shuì", { partOfSpeech: "v", frequency: 8000 }),
  entry("头", "tóu", { partOfSpeech: "n", frequency: 20_000 }),
  entry("前", "qián", { partOfSpeech: "f", frequency: 30_000 }),
  // A time word with the verb inside it, which is what hides a 去 from the
  // longest match.
  entry("前去", "qián qù", { partOfSpeech: "t", frequency: 900 }),
  // A reading somebody recorded, against a word anybody counted.
  entry("见过", "jiàn guò", { frequency: 3000 }),
  entry("走过", "zǒu guò", { partOfSpeech: "v", frequency: 3000 }),
  entry("睡过头", "shuì guò tóu", { partOfSpeech: "v", frequency: 400 }),
]);

/**
 * How a run reads, word by word.
 */
function read(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(dictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

/**
 * The words a run decodes to, which is what the 量词 rule moves.
 */
function words(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

describe("得 as a modal", () => {
  it("reads 得 as děi after a pronoun and before a verb", () => {
    assertArrayEquals(read("我得走"), ["wǒ", "děi", "zǒu"]);
  });

  it("reads it as děi after an adverb too", () => {
    assertArrayEquals(read("你就得走"), ["nǐ", "jiù", "děi", "zǒu"]);
  });

  it("leaves the particle alone after a verb", () => {
    // 跑得快 is `pǎo de kuài`: the particle attaches to the verb in front of it,
    // which is the half of the context that carries the information.
    assertArrayEquals(read("跑得快"), ["pǎo", "de", "kuài"]);
  });

  it("leaves it alone where no verb phrase follows", () => {
    // 得了 is `dé le`, a different reading again, and not this rule's business.
    assertArrayEquals(read("我得了"), ["wǒ", "de", "le"]);
  });

  it("does nothing at all when the rule is not applied", () => {
    assertArrayEquals(read("我得走", []), ["wǒ", "de", "zǒu"]);
  });

  it("is the only rule needed for the reading, not the spacing", () => {
    // The rule settles which reading the character takes and says nothing about
    // where the word boundaries fall.
    assertArrayLength(decodeRun(dictionary, "我得走", [MODAL_DE]), 3);
  });
});

describe("儿 where the 儿化 is attested", () => {
  it("absorbs 儿 into the word the dictionary reads with it", () => {
    // 那边儿 is not a key; 边儿 is, so 儿 has somewhere to go and does not
    // surface as `ér`.
    assertArrayEquals(read("那边儿"), ["nà", "biānr"]);
  });

  it("leaves 儿 alone where no 儿化 is attested behind it", () => {
    assertArrayEquals(read("女儿"), ["nǚér"]);
  });

  it("leaves a run-initial 儿 alone, having nothing to attach to", () => {
    assertArrayEquals(read("儿"), ["ér"]);
  });

  it("does nothing at all when the rule is not applied", () => {
    assertArrayEquals(read("那边儿", []), ["nàbian", "ér"]);
  });

  it("applies on its own as well as beside the other rule", () => {
    assertArrayEquals(read("那边儿", [ATTESTED_ERHUA]), ["nà", "biānr"]);
  });
});

describe("教 where it is teaching", () => {
  it("reads it jiāo in front of the thing taught", () => {
    assertArrayEquals(read("我教你"), ["wǒ", "jiāo", "nǐ"]);
  });

  it("reads it jiāo across an aspect particle", () => {
    // 他教了三年书: the object is on the far side of the 了, and 教书 being a
    // word carries nothing over it.
    assertArrayEquals(read("他教了"), ["tā", "jiāo", "le"]);
  });

  it("leaves the reading the words carry alone", () => {
    assertArrayEquals(read("教育"), ["jiàoyù"]);
    assertArrayEquals(read("宗教"), ["zōngjiào"]);
  });

  it("does nothing at all when the rule is not applied", () => {
    assertArrayEquals(read("我教你", []), ["wǒ", "jiào", "nǐ"]);
  });

  it("reads it jiāo after a modal, where nothing follows to look at", () => {
    // 他怎么教: the object is what usually says a 教 is teaching, and here
    // there is none, so the near side has to.
    assertArrayEquals(read("他怎么教"), ["tā", "zěnme", "jiāo"]);
  });

  it("takes the jiào a two-character reading would carry in", () => {
    // 来教 is a pair the dictionary holds with no part of speech, and its
    // `jiào` reached the position from outside the character's own edges.
    assertArrayEquals(read("来教我", [TEACHING_JIAO]), ["lái", "jiāo", "wǒ"]);
    assertArrayEquals(read("来教我", []), ["láijiào", "wǒ"]);
  });
});

/** How a run of the 的 cases reads, word by word. */
function readDe(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(deDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("的 where it is the structural particle", () => {
  it("forbids an untagged word beginning at the particle", () => {
    assertArrayEquals(readDe("他的真名字"), ["tā", "de", "zhēn", "míngzi"]);
  });

  it("reads the particle as dí without the rule, which is the bug", () => {
    // The 的真 edge loses the spacing and wins the reading, which is the whole
    // shape of the defect: 他的真名字 came out `tā dí zhēn míngzi`.
    assertArrayEquals(readDe("他的真名字", []), ["tā", "dí", "zhēn", "míngzi"]);
  });

  it("leaves a word jieba counted and tagged alone", () => {
    assertArrayEquals(readDe("他的确知道"), ["tā", "díquè", "zhīdào"]);
  });

  it("says nothing where no modifier stands in front", () => {
    assertArrayEquals(readDe("的真", [PARTICLE_DE]), ["dí", "zhēn"]);
  });
});

/** How a run of the taxi cases reads, word by word. */
function readTaxi(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(taxiDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("的 in the taxi vocabulary", () => {
  it("keeps the taxi word whole where it stands", () => {
    assertArrayEquals(readTaxi("的士"), ["dīshì"]);
    assertArrayEquals(readTaxi("打的去"), ["dǎdī", "qù"]);
  });

  it("splits the taxi word without the rule, which is the bug", () => {
    // The reading was right all along and the spacing was not: 的士 costs more
    // than a 的 and a 士 do together, since 的 sits in the cheapest band there
    // is.
    assertArrayEquals(readTaxi("的士", []), ["dī", "shì"]);
  });

  it("gives the head back where a longer word claims it", () => {
    assertArrayEquals(readTaxi("我的哥哥"), ["wǒ", "de", "gēgē"]);
  });

  it("keeps the key where nothing else claims the head", () => {
    assertArrayEquals(readTaxi("我的哥"), ["wǒ", "dīgē"]);
  });

  it("gives the 的 back where a head follows it", () => {
    assertArrayEquals(readTaxi("打的电话"), ["dǎ", "de", "diànhuà"]);
  });

  it("leaves the character in front of the 的 to the word holding it", () => {
    assertArrayEquals(readTaxi("上面的"), ["shàngmiàn", "de"]);
  });
});

/** How a run of the complement cases reads, word by word. */
function readPotential(run: string): readonly string[] {
  return decodeRun(potentialDictionary, run, READING_RULES).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("得 marking a potential complement", () => {
  it("reads the 得 of a potential complement as the particle", () => {
    assertArrayEquals(readPotential("算得上是"), [
      "suàn",
      "de",
      "shàng",
      "shì",
    ]);
  });

  it("keeps the word where the complement is swallowed by a noun", () => {
    // 上级 is the object of 取得 rather than a complement, and nothing after it
    // starts a word of its own.
    assertArrayEquals(readPotential("取得上级批准"), [
      "qǔdé",
      "shàngjí",
      "pīzhǔn",
    ]);
  });

  it("keeps the word where an adverb rather than a verb precedes the 得", () => {
    assertArrayEquals(readPotential("只得上山"), ["zhǐdé", "shàngshān"]);
  });

  it("does nothing at all when the rule is not applied", () => {
    assertArrayEquals(
      decodeRun(potentialDictionary, "算得上是", []).map((word) =>
        word.reading.map((syllable) => writeSyllable(syllable)).join(""),
      ),
      ["suàndé", "shàng", "shì"],
    );
  });
});

describe("a 量词 the number in front of it counts", () => {
  it("keeps the 量词 out of the word after it", () => {
    assertArrayEquals(words("三个人"), ["三", "个", "人"]);
  });

  it("swallows it without the rule, which is the bug", () => {
    assertArrayEquals(words("三个人", []), ["三", "个人"]);
  });

  it("says nothing about the same word with no number in front", () => {
    assertArrayEquals(words("个人"), ["个人"]);
  });

  it("leaves a word the dictionary does not tag as a 量词 alone", () => {
    // 分 is a verb in the dictionary and 分钟 is a unit, so 五分钟 is untouched
    // — which is what a rule firing on every character after a number would
    // break.
    assertArrayEquals(words("五分钟"), ["五", "分钟"]);
  });

  it("leaves an ordinal alone, since it counts nothing", () => {
    assertArrayEquals(words("第三个人"), ["第三", "个人"]);
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(words("三个人", [COUNTED_MEASURE]), ["三", "个", "人"]);
  });
});

/** How a run of the 长 cases reads, word by word. */
function readChang(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(changDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("长 as an adjective", () => {
  it("reads 长 as cháng after a degree adverb", () => {
    assertArrayEquals(readChang("很长"), ["hěn", "cháng"]);
  });

  it("reads it as cháng after 太, which is the reported case", () => {
    assertArrayEquals(readChang("不太长"), ["bù", "tài", "cháng"]);
  });

  it("takes a multi-character adverb as readily as a single one", () => {
    assertArrayEquals(readChang("非常长"), ["fēicháng", "cháng"]);
  });

  it("keeps the default zhǎng where nothing measures it", () => {
    // The bare 长 at the end of a title is what the stored ranking is for, and
    // this rule must not reach it: 校长 through the word, 署长 through neither.
    assertArrayEquals(readChang("署长"), ["shǔ", "zhǎng"]);
  });

  it("leaves the growing 长 alone before the complement marker", () => {
    // 真 is a degree adverb and 长得 is the verb regardless, so this is the
    // case both halves of the context are needed for.
    assertArrayEquals(readChang("真长得快"), ["zhēn", "zhǎng", "de", "kuài"]);
  });

  it("leaves it alone in the 越…越 correlative", () => {
    assertArrayEquals(readChang("越长越大"), ["yuè", "zhǎng", "yuè", "dà"]);
  });

  it("reads the sentence particle after it as a particle, not aspect", () => {
    // 了 after a bare 长 suggests the verb, but after an adverb and a 长 it
    // closes the sentence: 太长了 is `cháng`.
    assertArrayEquals(readChang("太长了"), ["tài", "cháng", "le"]);
  });

  it("reads the attributive 的 after it the same way", () => {
    assertArrayEquals(readChang("很长的路"), ["hěn", "cháng", "de", "lù"]);
  });

  it("reads a negated 长 closing its clause as cháng", () => {
    // 不 is deliberately outside the degree set, so this is the far side of
    // the context doing the work: nothing follows for a verb to govern.
    assertArrayEquals(readChang("不长"), ["bù", "cháng"]);
  });

  it("keeps the negated 长 as the verb where it governs something", () => {
    assertArrayEquals(readChang("不长在"), ["bù", "zhǎng", "zài"]);
  });

  it("reads an attributive 长 in front of its noun as cháng", () => {
    assertArrayEquals(readChang("有长头发"), ["yǒu", "cháng", "tóufa"]);
  });

  it("takes a 量词 in front of the 长 as readily as 有", () => {
    assertArrayEquals(readChang("位长胡子"), ["wèi", "cháng", "húzi"]);
  });

  it("keeps the verb where the noun after it is an object", () => {
    // 他长头发 is a subject and a verb, and the only thing separating it from
    // 有长头发 is what stands in front.
    assertArrayEquals(readChang("他长头发"), ["tā", "zhǎng", "tóufa"]);
  });

  it("looks past a longer word to the degree adverb inside it", () => {
    // 得很 is a word and the longest one ending in front of the 长, so the 很
    // that settles it was hidden: 留得很长 read `zhǎng`.
    assertArrayEquals(readChang("得很长"), ["dehěn", "cháng"]);
  });

  it("takes the 量词 inside a longer numeral the same way", () => {
    assertArrayEquals(readChang("一个长胡子"), ["yīgè", "cháng", "húzi"]);
  });

  it("keeps the verb where the 量词 is counting an ordinal", () => {
    // 第一次 is when the growing happened rather than what is counted.
    assertArrayEquals(readChang("第一次长胡子"), ["dìyīcì", "zhǎng", "húzi"]);
  });

  it("reads a compared or intensified 长 as cháng", () => {
    assertArrayEquals(readChang("长一点"), ["cháng", "yīdiǎn"]);
    assertArrayEquals(readChang("长极了"), ["cháng", "jíle"]);
  });

  it("reads a 长 conjoined with another adjective as cháng", () => {
    assertArrayEquals(readChang("长而美丽"), ["cháng", "ér", "měilì"]);
  });

  it("reads a 长 given a length as cháng", () => {
    assertArrayEquals(readChang("长三百公里"), ["cháng", "sānbǎi", "gōnglǐ"]);
  });

  it("keeps the verb where the number counts something else", () => {
    // 长两个校区 counts campuses, which is not a length. Only a distance or a
    // stretch of time settles it.
    assertArrayEquals(readChang("长一个"), ["zhǎng", "yīgè"]);
  });

  it("does nothing at all when the rule is not applied", () => {
    assertArrayEquals(readChang("很长", []), ["hěn", "zhǎng"]);
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readChang("很长", [ADJECTIVAL_CHANG]), ["hěn", "cháng"]);
  });

  it("settles the reading and not the spacing", () => {
    assertArrayLength(
      decodeRun(changDictionary, "很长", [ADJECTIVAL_CHANG]),
      2,
    );
  });

  it("reads 越长越高 as growing, against the 越长 the sources assert", () => {
    assertArrayEquals(readChang("越长越高"), ["yuè", "zhǎng", "yuè", "gāo"]);
  });

  it("leaves the correlative alone where nothing grew", () => {
    // 好 is not something growing produces, so 时间越长越好 keeps `cháng`.
    assertArrayEquals(readChang("越长越好"), ["yuècháng", "yuè", "hǎo"]);
  });

  it("takes the 越长 reading without the rule, which is the bug", () => {
    assertArrayEquals(readChang("越长越高", []), ["yuècháng", "yuè", "gāo"]);
  });

  it("leaves the rival standing rather than forcing the reading", () => {
    // The point of forbidding the edge rather than forcing one: 越长越X is
    // genuinely ambiguous, so the decode should still report itself guessing.
    const scored = decodeRunScored(changDictionary, "越长越高", READING_RULES);
    const grown = scored.find(({ word }) => word.text === "长");
    assertNonNullable(grown, "长 decodes as a word of its own");
    const settled = grown.confidence[0];
    assertNonNullable(settled, "with a confidence for its one syllable");
    assertTrue(isUncertain(settled));
  });

  it("reads cháng in front of a span of time", () => {
    assertArrayEquals(readChang("长时间看"), ["cháng", "shíjiān", "kàn"]);
    assertArrayEquals(readChang("长时间看", []), ["zhǎng", "shíjiān", "kàn"]);
  });

  it("reads cháng between the two halves of 又…又", () => {
    assertArrayEquals(readChang("又长又冷"), ["yòu", "cháng", "yòu", "lěng"]);
  });

  it("reads cháng for what something became, at the end of the clause", () => {
    assertArrayEquals(readChang("变长了"), ["biàn", "cháng", "le"]);
    assertArrayEquals(readChang("变长出"), ["biàn", "zhǎng", "chū"]);
  });

  it("reads cháng after a span or a time word that ends the clause", () => {
    assertArrayEquals(readChang("时间长了"), ["shíjiān", "cháng", "le"]);
    assertArrayEquals(readChang("冬天长"), ["dōngtiān", "cháng"]);
    assertArrayEquals(readChang("头发长了"), ["tóufa", "zhǎng", "le"]);
  });

  it("reads cháng at the end of a comparison a 比 sets up", () => {
    assertArrayEquals(readChang("时间比我长"), [
      "shíjiān",
      "bǐ",
      "wǒ",
      "cháng",
    ]);
  });

  it("leaves the 长 after a 比 that opens a longer word", () => {
    assertArrayEquals(readChang("比作树长"), ["bǐzuò", "shù", "zhǎng"]);
  });

  it("reads cháng between a 的 and the noun it describes", () => {
    assertArrayEquals(readChang("他的长外套"), ["tā", "de", "cháng", "wàitào"]);
  });
});

/** How a run of the 弹 cases reads, word by word. */
function readTan(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(tanDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("弹 where it is playing", () => {
  it("reads 弹 as tán in front of the instrument", () => {
    assertArrayEquals(readTan("弹吉他"), ["tán", "jítā"]);
  });

  it("reads it as tán before the complement marker", () => {
    // 弹得好: no object, and the 得 says it is a verb anyway.
    assertArrayEquals(readTan("弹得好"), ["tán", "de", "hǎo"]);
  });

  it("keeps the default dàn where nothing is governed", () => {
    // 毛瑟弹的 and 南部弹是 are the shape: a cartridge named after its maker,
    // with a particle rather than an object behind it.
    assertArrayEquals(readTan("弹的"), ["dàn", "de"]);
  });

  it("leaves the reading a tagged word carries alone", () => {
    assertArrayEquals(readTan("子弹"), ["zǐdàn"]);
  });

  it("takes a single character after it for a compound, not an object", () => {
    // 弹洞, 掷弹兵 and 供弹爪 are nouns 弹 is a morpheme of, and each puts one
    // tagged character where an instrument would go.
    assertArrayEquals(readTan("弹洞"), ["dàn", "dòng"]);
  });

  it("keeps the default where nothing follows at all", () => {
    assertArrayEquals(readTan("弹"), ["dàn"]);
  });

  it("reads the 繁體 character the same way", () => {
    assertArrayEquals(readTan("彈吉他"), ["tán", "jítā"]);
  });

  it("does nothing at all when the rule is not applied", () => {
    assertArrayEquals(readTan("弹吉他", []), ["dàn", "jítā"]);
  });

  it("takes the dàn a two-character reading would carry in", () => {
    // 和弹 is a pair the dictionary holds with no part of speech, and its `dàn`
    // reached 我的爱好是开车和弹吉他 from outside the character's own edges.
    assertArrayEquals(readTan("和弹吉他", [PLAYING_TAN]), [
      "hé",
      "tán",
      "jítā",
    ]);
    assertArrayEquals(readTan("和弹吉他", []), ["hédàn", "jítā"]);
  });

  it("leaves a verb alone after a particle, which one cannot follow", () => {
    assertArrayEquals(readTan("的弹吉他"), ["de", "dàn", "jítā"]);
  });

  it("settles the reading and not the spacing", () => {
    assertArrayLength(decodeRun(tanDictionary, "弹吉他", [PLAYING_TAN]), 2);
  });
});

/** How a run of the 过 cases reads, word by word. */
function readGuo(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(guoDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("过 where it marks experiential aspect", () => {
  it("reads 过 toneless after a verb", () => {
    assertArrayEquals(readGuo("我去过"), ["wǒ", "qù", "guo"]);
  });

  it("keeps guò where the word in front is not a verb", () => {
    // 不过 is an adverb and a 过, and neither of them takes aspect.
    assertArrayEquals(readGuo("不过"), ["bù", "guò"]);
  });

  it("keeps guò after 没, which negates a verb rather than being one", () => {
    assertArrayEquals(readGuo("我没过"), ["wǒ", "méi", "guò"]);
    assertArrayEquals(readGuo("我沒過"), ["wǒ", "méi", "guò"]);
    assertArrayEquals(readGuo("我没去过"), ["wǒ", "méi", "qù", "guo"]);
  });

  it("sees a verb a longer word has swallowed", () => {
    // 前去 is a time word and the 去 inside it is the verb, which is why every
    // word ending at the position is asked rather than the longest.
    assertArrayEquals(readGuo("前去过"), ["qiánqù", "guo"]);
  });

  it("takes the guò a pair would carry in", () => {
    // 见过 is a pair the dictionary holds with no part of speech, and its `guò`
    // reached the position from outside the character's own edges.
    assertArrayEquals(readGuo("我见过", [EXPERIENTIAL_GUO]), [
      "wǒ",
      "jiàn",
      "guo",
    ]);
    assertArrayEquals(readGuo("我见过", []), ["wǒ", "jiànguò"]);
  });

  it("leaves the reading a tagged word carries alone", () => {
    assertArrayEquals(readGuo("走过"), ["zǒuguò"]);
  });

  it("leaves a word of three characters whole", () => {
    // 睡过头 is a word in its own right, where 见过 is a recorded reading.
    assertArrayEquals(readGuo("睡过头"), ["shuìguòtóu"]);
  });

  it("reads the 繁體 character the same way", () => {
    assertArrayEquals(readGuo("我去過"), ["wǒ", "qù", "guo"]);
  });

  it("does nothing at all when the rule is not applied", () => {
    assertArrayEquals(readGuo("我去过", []), ["wǒ", "qù", "guò"]);
  });

  it("settles the reading and not the spacing", () => {
    assertArrayLength(
      decodeRun(guoDictionary, "我去过", [EXPERIENTIAL_GUO]),
      3,
    );
  });
});

/**
 * A dictionary of its own for the separated compounds, kept apart for the
 * reason 长's is.
 *
 * Every shape the rule turns on: a 离合词 whose tail is the polyphone (请假),
 * one whose head is (弹琴), an untagged pair behind a verb (瞅空), a pair behind
 * a numeral (一长), a tail that opens a tagged word (有奇 against 奇怪), and the
 * untagged pair that carries a reading across two characters (折么).
 */
const splitDictionary = dictionaryOf([
  entry("个", "gè", { partOfSpeech: "q", frequency: 90_000 }),
  entry("個", "gè", { partOfSpeech: "q", frequency: 90_000 }),
  // 假, stored `jiǎ` with `jià` as an alternate, as the real dictionary stores
  // it, and the 离合词 that states the second reading.
  entry("假", "jiǎ", {
    partOfSpeech: "n",
    frequency: 9000,
    alternates: [reading("jià")],
  }),
  entry("请", "qǐng", { partOfSpeech: "v", frequency: 20_000 }),
  entry("请假", "qǐng jià", { partOfSpeech: "v", frequency: 900 }),
  // The mirror case, where the polyphone is the head rather than the tail.
  entry("弹", "dàn", {
    partOfSpeech: "v",
    frequency: 4000,
    alternates: [reading("tán")],
  }),
  entry("琴", "qín", { partOfSpeech: "n", frequency: 3000 }),
  entry("弹琴", "tán qín", { partOfSpeech: "n", frequency: 400 }),
  // An untagged pair behind a verb: a reading somebody recorded rather than a
  // word anybody counted, which is what 是个甚么 finds behind it.
  entry("瞅", "chǒu", { partOfSpeech: "v", frequency: 900 }),
  entry("空", "kōng", {
    partOfSpeech: "n",
    frequency: 9000,
    alternates: [reading("kòng")],
  }),
  entry("瞅空", "chǒu kòng", { frequency: 100 }),
  // A tagged pair behind a numeral, where the 个 is counting rather than
  // separating. Tagged, so that it is the verb condition being tested and not
  // the one above it.
  entry("一", "yī", { partOfSpeech: "m", frequency: 90_000 }),
  entry("只", "zhǐ", {
    partOfSpeech: "n",
    frequency: 9000,
    alternates: [reading("zhī")],
  }),
  entry("一只", "yī zhī", { partOfSpeech: "m", frequency: 3000 }),
  // A tail that opens a tagged word of its own, which is 有个奇怪的女人.
  entry("有", "yǒu", { partOfSpeech: "v", frequency: 80_000 }),
  entry("奇", "qí", {
    partOfSpeech: "a",
    frequency: 5000,
    alternates: [reading("jī")],
  }),
  entry("有奇", "yǒu jī", { partOfSpeech: "v", frequency: 100 }),
  entry("怪", "guài", { partOfSpeech: "a", frequency: 5000 }),
  entry("奇怪", "qí guài", { partOfSpeech: "v", frequency: 4000 }),
  // The pair that carries a reading in from outside the character's own edges,
  // the way 和弹 does for 弹: 打个折么 read its 折 as `shé` off 折么.
  entry("打", "dǎ", { partOfSpeech: "v", frequency: 40_000 }),
  entry("折", "zhé", {
    partOfSpeech: "v",
    frequency: 6000,
    alternates: [reading("shé"), reading("zhē")],
  }),
  entry("打折", "dǎ zhé", { partOfSpeech: "v", frequency: 500 }),
  entry("么", "me", { partOfSpeech: "y", frequency: 30_000 }),
  entry("折么", "shé mǒ", { frequency: 100 }),
]);

/** How a run of the separated cases reads, word by word. */
function readSplit(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(splitDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("a 离合词 a 量词 has been pushed into", () => {
  it("carries the compound's reading over the 量词 to the tail", () => {
    assertArrayEquals(readSplit("请个假"), ["qǐng", "gè", "jià"]);
  });

  it("reads the default jiǎ without the rule, which is the bug", () => {
    assertArrayEquals(readSplit("请个假", []), ["qǐng", "gè", "jiǎ"]);
  });

  it("carries it to the head as well, where the head is the polyphone", () => {
    assertArrayEquals(readSplit("弹个琴"), ["tán", "gè", "qín"]);
    assertArrayEquals(readSplit("弹个琴", []), ["dàn", "gè", "qín"]);
  });

  it("says nothing about the compound written whole", () => {
    assertArrayEquals(readSplit("请假"), ["qǐngjià"]);
  });

  it("declines a pair the dictionary does not tag as a word", () => {
    // 瞅空 is a reading somebody recorded rather than a word anybody counted,
    // and admitting those opens the rule to the whole of the phrase tail.
    assertArrayEquals(readSplit("瞅个空"), ["chǒu", "gè", "kōng"]);
  });

  it("declines a 个 that is counting the numeral in front of it", () => {
    // 一个只 has 一只 behind it and no verb, which is the shape that separates
    // a classifier from an infix.
    assertArrayEquals(readSplit("一个只"), ["yī", "gè", "zhǐ"]);
  });

  it("declines where the far half opens a tagged word of its own", () => {
    // 有个奇怪 has 有奇 behind it, and the 奇 belongs to 奇怪.
    assertArrayEquals(readSplit("有个奇怪"), ["yǒu", "gè", "qíguài"]);
  });

  it("takes the reading an untagged pair would carry in", () => {
    // 折么 is a pair the dictionary holds with no part of speech, and its `shé`
    // reached 能给我打个折么 from outside the character's own edges.
    assertArrayEquals(readSplit("打个折么"), ["dǎ", "gè", "zhé", "me"]);
    assertArrayEquals(readSplit("打个折么", []), ["dǎ", "gè", "shémǒ"]);
  });

  it("reads the 繁體 classifier the same way", () => {
    assertArrayEquals(readSplit("请個假"), ["qǐng", "gè", "jià"]);
  });

  it("settles the reading and not the spacing", () => {
    assertArrayLength(
      decodeRun(splitDictionary, "请个假", [SEPARATED_COMPOUND]),
      3,
    );
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readSplit("请个假", [SEPARATED_COMPOUND]), [
      "qǐng",
      "gè",
      "jià",
    ]);
  });
});

/**
 * A dictionary for the 离合词 parted by more than a 个.
 *
 * 觉 and 假 stored with their 离合词 readings as alternates, the way the real
 * dictionary stores them, and the words that have to keep the rule away: 觉得
 * claiming its 觉, 坐下, 拿来 and 干吗 tagged verbs with no object in them, the
 * noun 打场, and 还钱 behind an adverb the tags could call a verb.
 */
const partedDictionary = dictionaryOf([
  entry("我", "wǒ", { partOfSpeech: "r", frequency: 80_000 }),
  entry("了", "le", { partOfSpeech: "ul", frequency: 90_000 }),
  entry("的", "de", { partOfSpeech: "uj", frequency: 90_000 }),
  entry("不", "bù", { partOfSpeech: "d", frequency: 80_000 }),
  entry("着", "zhe", {
    partOfSpeech: "uz",
    frequency: 40_000,
    alternates: [reading("zháo")],
  }),
  entry("个", "gè", { partOfSpeech: "q", frequency: 90_000 }),
  entry("好", "hǎo", { partOfSpeech: "a", frequency: 50_000 }),
  entry("三", "sān", { partOfSpeech: "m", frequency: 30_000 }),
  entry("百", "bǎi", { partOfSpeech: "m", frequency: 9000 }),
  entry("天", "tiān", { partOfSpeech: "q", frequency: 30_000 }),
  entry("小时", "xiǎo shí", { partOfSpeech: "n", frequency: 9000 }),
  entry("下", "xià", {
    partOfSpeech: "f",
    frequency: 40_000,
    alternates: [reading("xia")],
  }),
  entry("睡", "shuì", { partOfSpeech: "v", frequency: 9000 }),
  entry("觉", "jué", {
    partOfSpeech: "v",
    frequency: 9000,
    alternates: [reading("jiào")],
  }),
  entry("睡觉", "shuì jiào", { partOfSpeech: "v", frequency: 9000 }),
  entry("觉得", "jué de", { partOfSpeech: "v", frequency: 30_000 }),
  entry("请", "qǐng", { partOfSpeech: "v", frequency: 20_000 }),
  entry("假", "jiǎ", {
    partOfSpeech: "n",
    frequency: 9000,
    alternates: [reading("jià")],
  }),
  entry("请假", "qǐng jià", { partOfSpeech: "v", frequency: 900 }),
  entry("钱", "qián", { partOfSpeech: "n", frequency: 9000 }),
  entry("拿", "ná", { partOfSpeech: "v", frequency: 9000 }),
  entry("来", "lái", {
    partOfSpeech: "v",
    frequency: 90_000,
    alternates: [reading("lai")],
  }),
  entry("拿来", "ná lai", { partOfSpeech: "v", frequency: 900 }),
  // The threshing floor, a noun, where the 场 behind it is a noun as well.
  entry("打", "dǎ", { partOfSpeech: "v", frequency: 40_000 }),
  entry("场", "chǎng", {
    partOfSpeech: "n",
    frequency: 9000,
    alternates: [reading("cháng")],
  }),
  entry("打场", "dǎ cháng", { partOfSpeech: "n", frequency: 100 }),
  entry("坐", "zuò", { partOfSpeech: "v", frequency: 9000 }),
  entry("坐下", "zuò xia", { partOfSpeech: "v", frequency: 900 }),
  entry("干", "gàn", {
    partOfSpeech: "v",
    frequency: 9000,
    alternates: [reading("gān")],
  }),
  entry("吗", "ma", {
    partOfSpeech: "y",
    frequency: 40_000,
    alternates: [reading("má")],
  }),
  entry("干吗", "gàn má", { partOfSpeech: "v", frequency: 900 }),
  entry("还", "hái", {
    partOfSpeech: "v",
    frequency: 40_000,
    alternates: [reading("huán")],
  }),
  entry("够", "gòu", { partOfSpeech: "v", frequency: 9000 }),
  entry("还钱", "huán qián", { partOfSpeech: "v", frequency: 900 }),
]);

/** How a run of the parted cases reads, word by word. */
function readParted(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(partedDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

/** How the last character of a run of the parted cases reads. */
function lastOf(run: string, rules = READING_RULES): string | undefined {
  return decodeRun(partedDictionary, run, rules)
    .at(-1)
    ?.reading.map((syllable) => writeSyllable(syllable))
    .at(-1);
}

describe("a 离合词 parted by more than a 个", () => {
  it("carries the reading across a potential complement", () => {
    assertIdentical(lastOf("我睡不着觉"), "jiào");
  });

  it("reads the default jué without the rule, which is the bug", () => {
    assertIdentical(lastOf("我睡不着觉", []), "jué");
  });

  it("carries it across aspect and a count of time", () => {
    assertIdentical(lastOf("睡了三个小时觉"), "jiào");
    assertIdentical(lastOf("请了三天假"), "jià");
  });

  it("carries it across aspect alone", () => {
    assertIdentical(lastOf("请了假"), "jià");
  });

  it("carries it across a 个 with the 好 the sleep was", () => {
    assertIdentical(lastOf("睡了个好觉"), "jiào");
  });

  it("carries it across a bare 天", () => {
    assertIdentical(lastOf("请了天假"), "jià");
  });

  it("declines an infix the pattern does not admit", () => {
    // 下 counts only behind a numeral, since a bare 下 is a direction.
    assertIdentical(lastOf("睡下觉"), "jué");
  });

  it("declines a head further back than the widest infix", () => {
    assertIdentical(lastOf("睡了三百三十三个小时觉"), "jué");
  });

  it("leaves a word starting at the tail to the decode", () => {
    assertArrayEquals(readParted("我睡了觉得"), ["wǒ", "shuì", "le", "juéde"]);
  });

  it("declines a pair that is not tagged as a verb", () => {
    assertIdentical(lastOf("打了场"), "chǎng");
  });

  it("declines a tail that is a direction tagged as a verb", () => {
    assertIdentical(lastOf("拿了来"), "lái");
  });

  it("declines where the tail runs on into a noun", () => {
    assertIdentical(readParted("请了假钱").at(-2), "jiǎ");
  });

  it("declines where the tail runs on into an attributive 的", () => {
    assertIdentical(readParted("请了假的").at(-2), "jiǎ");
  });

  it("declines a tail that is a direction rather than an object", () => {
    assertIdentical(lastOf("坐了下"), "xià");
  });

  it("declines a tail that is a particle rather than an object", () => {
    assertIdentical(lastOf("干了吗"), "ma");
  });

  it("settles the tail and never the head", () => {
    // 还钱 is a tagged verb behind 不够, and the 还 is still.
    assertIdentical(readParted("还不够钱")[0], "hái");
  });

  it("applies on its own as well as beside the other rules", () => {
    assertIdentical(lastOf("我睡不着觉", [SEPARATED_COMPOUND]), "jiào");
  });
});

/**
 * A dictionary of its own for the reduplicated verbs.
 *
 * 数 is stored `shù` with `shǔ` as an alternate, and 数字 is the tagged word
 * that has to keep its own reading. 卷 carries the 一卷 that reached into
 * 卷一卷, and 查 the literary 查查 that the rule must not read 查一查 off.
 */
const reduplicationDictionary = dictionaryOf([
  entry("他", "tā", { partOfSpeech: "r", frequency: 80_000 }),
  entry("了", "le", {
    partOfSpeech: "ul",
    frequency: 90_000,
    alternates: [reading("liǎo")],
  }),
  entry("一", "yī", { partOfSpeech: "m", frequency: 80_000 }),
  entry("数", "shù", {
    partOfSpeech: "n",
    frequency: 20_000,
    alternates: [reading("shǔ")],
  }),
  entry("數", "shù", {
    partOfSpeech: "n",
    frequency: 8000,
    alternates: [reading("shǔ")],
  }),
  entry("字", "zì", { partOfSpeech: "n", frequency: 8000 }),
  entry("数字", "shù zì", { partOfSpeech: "n", frequency: 9000 }),
  entry("数数", "shǔ shù", { partOfSpeech: "n", frequency: 30 }),
  entry("卷", "juǎn", {
    partOfSpeech: "v",
    frequency: 6000,
    alternates: [reading("juàn")],
  }),
  entry("一卷", "yī juàn", { partOfSpeech: "m", frequency: 900 }),
  entry("查", "chá", {
    partOfSpeech: "v",
    frequency: 9000,
    alternates: [reading("zhā")],
  }),
  entry("查查", "zhā zhā", { partOfSpeech: "v", frequency: 20 }),
]);

/** How a run of the reduplicated cases reads, word by word. */
function readTwice(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(reduplicationDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("a verb said twice around 了 or 一", () => {
  it("reads both halves of 数了数 as the verb", () => {
    assertArrayEquals(readTwice("他数了数"), ["tā", "shǔ", "le", "shǔ"]);
  });

  it("reads the default shù without the rule, which is the bug", () => {
    assertArrayEquals(readTwice("他数了数", []), ["tā", "shù", "le", "shù"]);
  });

  it("reads the tentative 数一数 the same way", () => {
    assertArrayEquals(readTwice("数一数"), ["shǔ", "yī", "shǔ"]);
  });

  it("reads the 繁體 character the same way", () => {
    assertArrayEquals(readTwice("數了數"), ["shǔ", "le", "shǔ"]);
  });

  it("leaves a tagged word starting at the second half alone", () => {
    // 数了数字 counted the digits, and 数字 is `shùzì`. The first 数 is
    // VERBAL_READING's, which reads it `shǔ` before its 了.
    assertArrayEquals(readTwice("数了数字"), ["shǔ", "le", "shùzì"]);
  });

  it("takes the reading a word over the infix would carry in", () => {
    assertArrayEquals(readTwice("卷一卷"), ["juǎn", "yī", "juǎn"]);
    assertArrayEquals(readTwice("卷一卷", []), ["juǎn", "yījuàn"]);
  });

  it("declines a count said twice", () => {
    // 一卷一卷 is one roll after another, and the numeral in front says so.
    assertArrayEquals(readTwice("一卷一卷"), ["yījuàn", "yījuàn"]);
  });

  it("leaves a character outside the table to the decode", () => {
    // 查查 is a literary `zhāzhā`, and 查一查 is `chá`.
    assertArrayEquals(readTwice("查一查"), ["chá", "yī", "chá"]);
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readTwice("数了数", [REDUPLICATED_VERB]), [
      "shǔ",
      "le",
      "shǔ",
    ]);
  });
});

/**
 * A dictionary of its own for 还, which is stored `hái` with `huán` as an
 * alternate.
 *
 * 书法 is the tagged word that keeps a 还 in front of it the adverb, and 倒还
 * the untagged pair that would carry `hái` into the position.
 */
const huanDictionary = dictionaryOf([
  entry("我", "wǒ", { partOfSpeech: "r", frequency: 80_000 }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 80_000 }),
  entry("还", "hái", {
    partOfSpeech: "d",
    frequency: 60_000,
    alternates: [reading("huán")],
  }),
  entry("還", "hái", {
    partOfSpeech: "d",
    frequency: 20_000,
    alternates: [reading("huán")],
  }),
  entry("钱", "qián", { partOfSpeech: "n", frequency: 20_000 }),
  entry("錢", "qián", { partOfSpeech: "n", frequency: 8000 }),
  entry("书", "shū", { partOfSpeech: "n", frequency: 20_000 }),
  entry("法", "fǎ", { partOfSpeech: "n", frequency: 20_000 }),
  entry("书法", "shū fǎ", { partOfSpeech: "n", frequency: 3000 }),
  entry("有", "yǒu", { partOfSpeech: "v", frequency: 80_000 }),
  entry("倒", "dǎo", { partOfSpeech: "v", frequency: 9000 }),
  entry("倒还", "dǎo hái", { frequency: 10_000 }),
]);

/** How a run of the 还 cases reads, word by word. */
function readHuan(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(huanDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("还 where it gives something back", () => {
  it("reads it huán in front of the money given back", () => {
    assertArrayEquals(readHuan("我还钱"), ["wǒ", "huán", "qián"]);
  });

  it("reads the default hái without the rule, which is the bug", () => {
    assertArrayEquals(readHuan("我还钱", []), ["wǒ", "hái", "qián"]);
  });

  it("reads it huán in front of a book, in either script", () => {
    assertArrayEquals(readHuan("还书"), ["huán", "shū"]);
    assertArrayEquals(readHuan("還錢"), ["huán", "qián"]);
  });

  it("leaves the adverb in front of a tagged word of its own", () => {
    assertArrayEquals(readHuan("他还书法"), ["tā", "hái", "shūfǎ"]);
  });

  it("leaves a 还 closing the run as the adverb", () => {
    assertArrayEquals(readHuan("他还"), ["tā", "hái"]);
  });

  it("leaves the adverb in front of a verb", () => {
    assertArrayEquals(readHuan("还有钱"), ["hái", "yǒu", "qián"]);
  });

  it("takes the reading an untagged pair would carry in", () => {
    assertArrayEquals(readHuan("倒还钱"), ["dǎo", "huán", "qián"]);
    assertArrayEquals(readHuan("倒还钱", []), ["dǎohái", "qián"]);
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readHuan("我还钱", [RETURNING_HUAN]), [
      "wǒ",
      "huán",
      "qián",
    ]);
  });
});

/**
 * A dictionary of its own for 干, which is stored `gàn` with `gān` as an
 * alternate.
 *
 * 不干 is the untagged key reading `bù gàn` that would carry the verb into the
 * frame, and 干部 the tagged word that keeps a 干 after 无 its own.
 */
const ganDictionary = dictionaryOf([
  entry("这", "zhè", { partOfSpeech: "r", frequency: 60_000 }),
  entry("你", "nǐ", { partOfSpeech: "r", frequency: 80_000 }),
  entry("我", "wǒ", { partOfSpeech: "r", frequency: 80_000 }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 80_000 }),
  entry("们", "men", { partOfSpeech: "k", frequency: 40_000 }),
  entry("他们", "tā men", { partOfSpeech: "r", frequency: 60_000 }),
  entry("不", "bù", { partOfSpeech: "d", frequency: 80_000 }),
  entry("了", "le", { partOfSpeech: "ul", frequency: 90_000 }),
  entry("的", "de", { partOfSpeech: "uj", frequency: 95_000 }),
  entry("事", "shì", { partOfSpeech: "n", frequency: 40_000 }),
  entry("在", "zài", { partOfSpeech: "p", frequency: 80_000 }),
  entry("什么", "shén me", { partOfSpeech: "r", frequency: 40_000 }),
  entry("与", "yǔ", { partOfSpeech: "p", frequency: 40_000 }),
  entry("无", "wú", { partOfSpeech: "v", frequency: 20_000 }),
  entry("卿", "qīng", { partOfSpeech: "n", frequency: 300 }),
  entry("何", "hé", { partOfSpeech: "r", frequency: 9000 }),
  entry("干", "gàn", {
    partOfSpeech: "v",
    frequency: 20_000,
    alternates: [reading("gān")],
  }),
  entry("不干", "bù gàn", { frequency: 9000 }),
  entry("部", "bù", { partOfSpeech: "n", frequency: 20_000 }),
  entry("干部", "gàn bù", { partOfSpeech: "n", frequency: 9000 }),
]);

/** How a run of the 干 cases reads, word by word. */
function readGan(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(ganDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("干 where it means to concern", () => {
  it("reads 不干你的事 as gān", () => {
    assertArrayEquals(readGan("这不干你的事"), [
      "zhè",
      "bù",
      "gān",
      "nǐ",
      "de",
      "shì",
    ]);
  });

  it("reads gàn through 不干 without the rule, which is the bug", () => {
    assertArrayEquals(readGan("这不干你的事", []), [
      "zhè",
      "bùgàn",
      "nǐ",
      "de",
      "shì",
    ]);
  });

  it("reads it gān with a plural pronoun and no 的", () => {
    assertArrayEquals(readGan("不干他们事"), ["bù", "gān", "tāmen", "shì"]);
  });

  it("reads it gān in a question about the pronoun", () => {
    assertArrayEquals(readGan("干你什么事"), ["gān", "nǐ", "shénme", "shì"]);
  });

  it("reads it gān in 干卿何事 and after 无", () => {
    assertArrayEquals(readGan("干卿何事"), ["gān", "qīng", "hé", "shì"]);
    assertArrayEquals(readGan("与你无干"), ["yǔ", "nǐ", "wú", "gān"]);
  });

  it("leaves the verb where no 不 or question frames it", () => {
    // 你干你的事 tells someone to get on with their own work.
    assertArrayEquals(readGan("你干你的事"), ["nǐ", "gàn", "nǐ", "de", "shì"]);
    assertArrayEquals(readGan("你在干什么事"), [
      "nǐ",
      "zài",
      "gàn",
      "shénme",
      "shì",
    ]);
  });

  it("leaves 不干 the verb where no pronoun follows", () => {
    assertArrayEquals(readGan("我不干了"), ["wǒ", "bùgàn", "le"]);
  });

  it("leaves a tagged word after 无 to read itself", () => {
    assertArrayEquals(readGan("无干部"), ["wú", "gànbù"]);
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readGan("干你什么事", [CONCERNING_GAN]), [
      "gān",
      "nǐ",
      "shénme",
      "shì",
    ]);
  });
});

/**
 * A dictionary of its own for 只, which is stored `zhǐ` with `zhī` as an
 * alternate.
 *
 * 只是, 只有 and 只会 are the tagged words that keep the adverb after 这, and
 * 唯一, 一半 and 第三 the words that can hold a numeral in front of a 只.
 */
const zhiDictionary = dictionaryOf([
  entry("只", "zhǐ", {
    partOfSpeech: "d",
    frequency: 40_000,
    alternates: [reading("zhī")],
  }),
  entry("一", "yī", { partOfSpeech: "m", frequency: 90_000 }),
  entry("二", "èr", { partOfSpeech: "m", frequency: 30_000 }),
  entry("三", "sān", { partOfSpeech: "m", frequency: 30_000 }),
  entry("十", "shí", { partOfSpeech: "m", frequency: 30_000 }),
  entry("两", "liǎng", { partOfSpeech: "m", frequency: 40_000 }),
  entry("几", "jǐ", { partOfSpeech: "m", frequency: 30_000 }),
  entry("半", "bàn", { partOfSpeech: "m", frequency: 20_000 }),
  entry("多", "duō", { partOfSpeech: "m", frequency: 50_000 }),
  entry("少", "shǎo", { partOfSpeech: "a", frequency: 20_000 }),
  entry("多少", "duō shǎo", { partOfSpeech: "m", frequency: 9000 }),
  entry("每", "měi", { partOfSpeech: "r", frequency: 20_000 }),
  entry("第", "dì", { partOfSpeech: "m", frequency: 20_000 }),
  entry("第三", "dì sān", { partOfSpeech: "m", frequency: 3000 }),
  entry("唯", "wéi", { partOfSpeech: "d", frequency: 2000 }),
  entry("唯一", "wéi yī", { partOfSpeech: "b", frequency: 9000 }),
  entry("一半", "yī bàn", { partOfSpeech: "m", frequency: 9000 }),
  entry("这", "zhè", { partOfSpeech: "r", frequency: 60_000 }),
  entry("那", "nà", { partOfSpeech: "r", frequency: 40_000 }),
  entry("哪", "nǎ", { partOfSpeech: "r", frequency: 20_000 }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 80_000 }),
  entry("不", "bù", { partOfSpeech: "d", frequency: 80_000 }),
  entry("是", "shì", { partOfSpeech: "v", frequency: 90_000 }),
  entry("有", "yǒu", { partOfSpeech: "v", frequency: 80_000 }),
  entry("会", "huì", { partOfSpeech: "v", frequency: 40_000 }),
  entry("想", "xiǎng", { partOfSpeech: "v", frequency: 40_000 }),
  entry("吃", "chī", { partOfSpeech: "v", frequency: 20_000 }),
  entry("的", "de", { partOfSpeech: "uj", frequency: 95_000 }),
  entry("个", "gè", { partOfSpeech: "q", frequency: 90_000 }),
  entry("只是", "zhǐ shì", { partOfSpeech: "c", frequency: 9000 }),
  entry("只有", "zhǐ yǒu", { partOfSpeech: "c", frequency: 9000 }),
  entry("只会", "zhǐ huì", { partOfSpeech: "d", frequency: 900 }),
  entry("猫", "māo", { partOfSpeech: "n", frequency: 9000 }),
  entry("狗", "gǒu", { partOfSpeech: "n", frequency: 9000 }),
  entry("鸡", "jī", { partOfSpeech: "n", frequency: 9000 }),
  entry("黑", "hēi", { partOfSpeech: "a", frequency: 9000 }),
  entry("胖", "pàng", { partOfSpeech: "a", frequency: 3000 }),
  entry("母", "mǔ", { partOfSpeech: "ng", frequency: 3000 }),
]);

/** How a run of the 只 cases reads, word by word. */
function readZhi(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(zhiDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("只 where it is a measure word", () => {
  it("reads 只 as zhī after a numeral", () => {
    assertArrayEquals(readZhi("三只猫"), ["sān", "zhī", "māo"]);
    assertArrayEquals(readZhi("两只狗"), ["liǎng", "zhī", "gǒu"]);
    assertArrayEquals(readZhi("十只鸡"), ["shí", "zhī", "jī"]);
  });

  it("reads zhǐ after a numeral without the rule, which is the bug", () => {
    assertArrayEquals(readZhi("三只猫", []), ["sān", "zhǐ", "māo"]);
  });

  it("reads it zhī after a number of several characters", () => {
    assertArrayEquals(readZhi("二十三只猫"), [
      "èr",
      "shí",
      "sān",
      "zhī",
      "māo",
    ]);
    assertArrayEquals(readZhi("十几只狗"), ["shí", "jǐ", "zhī", "gǒu"]);
  });

  it("reads it zhī after 几, 多少, 半 and 每", () => {
    assertArrayEquals(readZhi("几只狗"), ["jǐ", "zhī", "gǒu"]);
    assertArrayEquals(readZhi("多少只鸡"), ["duōshǎo", "zhī", "jī"]);
    assertArrayEquals(readZhi("半只鸡"), ["bàn", "zhī", "jī"]);
    assertArrayEquals(readZhi("每只狗"), ["měi", "zhī", "gǒu"]);
  });

  it("reads it zhī after an approximate number", () => {
    assertArrayEquals(readZhi("十多只鸡"), ["shí", "duō", "zhī", "jī"]);
  });

  it("reads it zhī after an ordinal", () => {
    assertArrayEquals(readZhi("第三只猫"), ["dìsān", "zhī", "māo"]);
  });

  it("takes 只是 apart where a numeral counts the 只", () => {
    // 两只是母的 is "two of them are female".
    assertArrayEquals(readZhi("两只是母的"), [
      "liǎng",
      "zhī",
      "shì",
      "mǔ",
      "de",
    ]);
  });

  it("reads it zhī after a demonstrative with a noun to count", () => {
    assertArrayEquals(readZhi("这只猫"), ["zhè", "zhī", "māo"]);
    assertArrayEquals(readZhi("那只黑狗"), ["nà", "zhī", "hēi", "gǒu"]);
    assertArrayEquals(readZhi("哪只狗"), ["nǎ", "zhī", "gǒu"]);
  });

  it("reads it zhī after a demonstrative closing the run", () => {
    assertArrayEquals(readZhi("他是那只"), ["tā", "shì", "nà", "zhī"]);
  });

  it("leaves the adverb after a demonstrative where a word claims the 只", () => {
    assertArrayEquals(readZhi("这只是猫"), ["zhè", "zhǐshì", "māo"]);
    assertArrayEquals(readZhi("那只有猫"), ["nà", "zhǐyǒu", "māo"]);
    assertArrayEquals(readZhi("这只会"), ["zhè", "zhǐhuì"]);
  });

  it("leaves the adverb after a demonstrative with a verb after it", () => {
    // 这只想吃 is "this only wants to eat", and no word holds 只想.
    assertArrayEquals(readZhi("这只想吃"), ["zhè", "zhǐ", "xiǎng", "chī"]);
  });

  it("leaves the adverb where nothing counts the 只", () => {
    assertArrayEquals(readZhi("他只有一个"), ["tā", "zhǐyǒu", "yī", "gè"]);
    assertArrayEquals(readZhi("不只"), ["bù", "zhǐ"]);
    assertArrayEquals(readZhi("只是"), ["zhǐshì"]);
  });

  it("leaves the adverb where a word holds the numeral", () => {
    assertArrayEquals(readZhi("唯一只有"), ["wéiyī", "zhǐyǒu"]);
    assertArrayEquals(readZhi("一半只是"), ["yībàn", "zhǐshì"]);
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readZhi("两只猫", [COUNTING_ZHI]), [
      "liǎng",
      "zhī",
      "māo",
    ]);
  });
});

/**
 * A dictionary of its own for 了, which is stored `le` with `liǎo` and `liào`
 * as alternates.
 *
 * 得了 and 了了 are the words a potential complement has to be taken out of,
 * and 受得了 is one that holds the whole complement.
 * 来得 and 获得 are verb-and-得 words, and 赢 is a verb with no 赢得 entry, as
 * in the core tier.
 */
const liaoDictionary = dictionaryOf([
  entry("了", "le", {
    partOfSpeech: "ul",
    frequency: 90_000,
    alternates: [reading("liǎo"), reading("liào")],
  }),
  entry("得", "de", {
    partOfSpeech: "ud",
    frequency: 60_000,
    alternates: [reading("dé"), reading("děi")],
  }),
  entry("得了", "dé le", { partOfSpeech: "l", frequency: 3000 }),
  entry("了了", "liǎo liǎo", { partOfSpeech: "v", frequency: 300 }),
  entry("他", "tā", { partOfSpeech: "r", frequency: 80_000 }),
  entry("吃", "chī", { partOfSpeech: "v", frequency: 20_000 }),
  entry("来", "lái", { partOfSpeech: "v", frequency: 60_000 }),
  entry("穿", "chuān", { partOfSpeech: "zg", frequency: 5000 }),
  entry("获", "huò", { partOfSpeech: "v", frequency: 5000 }),
  entry("赢", "yíng", { partOfSpeech: "v", frequency: 5000 }),
  entry("能", "néng", { partOfSpeech: "v", frequency: 40_000 }),
  entry("可", "kě", { partOfSpeech: "c", frequency: 30_000 }),
  entry("可能", "kě néng", { partOfSpeech: "v", frequency: 20_000 }),
  entry("考", "kǎo", { partOfSpeech: "v", frequency: 5000 }),
  entry("试", "shì", { partOfSpeech: "v", frequency: 5000 }),
  entry("考试", "kǎo shì", { partOfSpeech: "vn", frequency: 9000 }),
  entry("来得", "lái de", { partOfSpeech: "v", frequency: 3000 }),
  entry("受", "shòu", { partOfSpeech: "v", frequency: 9000 }),
  entry("受得了", "shòu de liǎo", { partOfSpeech: "v", frequency: 900 }),
  entry("获得", "huò dé", { partOfSpeech: "v", frequency: 9000 }),
  entry("病", "bìng", { partOfSpeech: "n", frequency: 9000 }),
  entry("病人", "bìng rén", { partOfSpeech: "n", frequency: 9000 }),
  entry("人", "rén", { partOfSpeech: "n", frequency: 90_000 }),
  entry("确", "què", { partOfSpeech: "d", frequency: 5000 }),
  entry("诊", "zhěn", { partOfSpeech: "v", frequency: 2000 }),
  entry("确诊", "què zhěn", { partOfSpeech: "v", frequency: 2000 }),
  entry("肺", "fèi", { partOfSpeech: "n", frequency: 2000 }),
  entry("炎", "yán", { partOfSpeech: "ng", frequency: 2000 }),
  entry("肺炎", "fèi yán", { partOfSpeech: "n", frequency: 2000 }),
  entry("感", "gǎn", { partOfSpeech: "v", frequency: 9000 }),
  entry("冒", "mào", { partOfSpeech: "v", frequency: 3000 }),
  entry("感冒", "gǎn mào", { partOfSpeech: "v", frequency: 3000 }),
  entry("治", "zhì", { partOfSpeech: "v", frequency: 5000 }),
  entry("帮", "bāng", { partOfSpeech: "v", frequency: 9000 }),
  entry("几", "jǐ", { partOfSpeech: "m", frequency: 20_000 }),
  entry("分", "fēn", { partOfSpeech: "q", frequency: 20_000 }),
  entry("部", "bù", { partOfSpeech: "q", frequency: 20_000 }),
  entry("部分", "bù fen", { partOfSpeech: "n", frequency: 20_000 }),
  entry("拿", "ná", { partOfSpeech: "v", frequency: 9000 }),
  entry("冠", "guàn", { partOfSpeech: "ng", frequency: 2000 }),
  entry("军", "jūn", { partOfSpeech: "n", frequency: 9000 }),
  entry("冠军", "guàn jūn", { partOfSpeech: "n", frequency: 5000 }),
  entry("奖", "jiǎng", { partOfSpeech: "n", frequency: 5000 }),
  entry("吧", "ba", { partOfSpeech: "y", frequency: 20_000 }),
  entry("吗", "ma", { partOfSpeech: "y", frequency: 20_000 }),
]);

/** How a run of the 了 cases reads, word by word. */
function readLiao(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(liaoDictionary, run, rules).map((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
}

describe("了 closing a potential complement", () => {
  it("reads it liǎo after a verb and 得", () => {
    assertArrayEquals(readLiao("吃得了吗"), ["chī", "de", "liǎo", "ma"]);
  });

  it("reads it le where the rule is not applied", () => {
    assertArrayEquals(readLiao("吃得了吗", []), ["chī", "déle", "ma"]);
  });

  it("keeps a word that holds the whole complement", () => {
    assertArrayEquals(readLiao("受得了吗"), ["shòudeliǎo", "ma"]);
  });

  it("takes 来得 apart", () => {
    assertArrayEquals(readLiao("来得了"), ["lái", "de", "liǎo"]);
  });

  it("takes 了了 apart and leaves the second 了 as aspect", () => {
    assertArrayEquals(readLiao("穿得了了"), ["chuān", "de", "liǎo", "le"]);
  });

  it("leaves 得了 alone where no verb stands before it", () => {
    assertArrayEquals(readLiao("得了吧"), readLiao("得了吧", []));
    assertArrayEquals(readLiao("他得了病"), readLiao("他得了病", []));
  });

  it("leaves 得了 alone after a modal or a noun made from a verb", () => {
    assertArrayEquals(readLiao("可能得了病"), readLiao("可能得了病", []));
    assertArrayEquals(readLiao("能得了病"), readLiao("能得了病", []));
    assertArrayEquals(readLiao("考试得了"), readLiao("考试得了", []));
  });

  it("leaves the aspect 了 after a verb that makes a word with 得", () => {
    assertArrayEquals(readLiao("获得了"), readLiao("获得了", []));
    assertArrayEquals(readLiao("赢得了"), readLiao("赢得了", []));
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readLiao("吃得了", [POTENTIAL_LIAO]), [
      "chī",
      "de",
      "liǎo",
    ]);
  });
});

describe("得 obtaining an illness, a score or a prize", () => {
  it("reads 得了 dé le before an illness after a verb", () => {
    assertArrayEquals(readLiao("确诊得了肺炎"), ["quèzhěn", "déle", "fèiyán"]);
  });

  it("reads it dé le before an illness with no verb in front", () => {
    assertArrayEquals(readLiao("他得了感冒"), ["tā", "déle", "gǎnmào"]);
    assertArrayEquals(readLiao("他得了病"), ["tā", "déle", "bìng"]);
  });

  it("reads it dé le before a score or a prize", () => {
    assertArrayEquals(readLiao("他得了几分"), ["tā", "déle", "jǐ", "fēn"]);
    assertArrayEquals(readLiao("他得了冠军"), ["tā", "déle", "guànjūn"]);
    assertArrayEquals(readLiao("他得了奖"), ["tā", "déle", "jiǎng"]);
  });

  it("leaves the potential complement after a verb that treats or wins", () => {
    assertArrayEquals(readLiao("治得了病"), ["zhì", "de", "liǎo", "bìng"]);
    assertArrayEquals(readLiao("拿得了冠军"), ["ná", "de", "liǎo", "guànjūn"]);
  });

  it("leaves the potential complement before what is not an illness or a score", () => {
    assertArrayEquals(readLiao("帮得了病人"), [
      "bāng",
      "de",
      "liǎo",
      "bìngrén",
    ]);
    assertArrayEquals(readLiao("吃得了部分"), ["chī", "de", "liǎo", "bùfen"]);
  });

  it("keeps the potential complement rule out of the frame", () => {
    assertArrayEquals(
      readLiao("确诊得了肺炎", [POTENTIAL_LIAO]),
      readLiao("确诊得了肺炎", []),
    );
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readLiao("他得了感冒", [OBTAINING_DE]), [
      "tā",
      "déle",
      "gǎnmào",
    ]);
  });
});

/**
 * A dictionary of its own for the pairs nobody counted.
 *
 * Each function word is stored with its usual reading first and its rare one
 * as an alternate, and each pair carries the rare one at a count of zero, the
 * way a pair only `large_pinyin.txt` or CC-CEDICT holds arrives. 目的 is the
 * counted word that keeps its `dì`, and 魔都 and 停更 the pairs whose rare
 * reading stands on the side it belongs.
 */
const dominantDictionary = dictionaryOf([
  entry("会", "huì", { partOfSpeech: "v", frequency: 60_000 }),
  // Rare enough that 破 and 的 together cost more than the pair, as they do in
  // the real dictionary.
  entry("破", "pò", { partOfSpeech: "v", frequency: 500 }),
  entry("的", "de", {
    partOfSpeech: "uj",
    frequency: 95_000,
    alternates: [reading("dì"), reading("dí")],
  }),
  entry("破的", "pò dì"),
  entry("目", "mù", { partOfSpeech: "n", frequency: 5000 }),
  entry("目的", "mù dì", { partOfSpeech: "n", frequency: 9000 }),
  entry("书", "shū", { partOfSpeech: "n", frequency: 20_000 }),
  entry("上", "shàng", { partOfSpeech: "f", frequency: 80_000 }),
  entry("都", "dōu", {
    partOfSpeech: "d",
    frequency: 60_000,
    alternates: [reading("dū")],
  }),
  entry("是", "shì", { partOfSpeech: "v", frequency: 90_000 }),
  entry("上都", "shàng dū", { isProperNoun: true, frequency: 3 }),
  entry("魔", "mó", { partOfSpeech: "n", frequency: 3000 }),
  entry("魔都", "mó dū", { isProperNoun: true, frequency: 3 }),
  entry("更", "gèng", {
    partOfSpeech: "d",
    frequency: 30_000,
    alternates: [reading("gēng")],
  }),
  entry("香", "xiāng", { partOfSpeech: "a", frequency: 5000 }),
  entry("更香", "gēng xiāng"),
  entry("停", "tíng", { partOfSpeech: "v", frequency: 9000 }),
  entry("停更", "tíng gēng"),
  entry("赚", "zhuàn", {
    hant: "賺",
    partOfSpeech: "v",
    frequency: 3000,
    alternates: [reading("zuàn")],
  }),
  entry("得", "de", { partOfSpeech: "ud", frequency: 60_000 }),
  entry("赚得", "zuàn de", { hant: "賺得" }),
]);

/**
 * How a run of the uncounted pairs reads, syllable by syllable.
 *
 * Syllables rather than words, since what the rule settles is the reading. The
 * spacing decode prices a pair nobody counted dearly and splits 魔都 whether
 * the rule runs or not.
 */
function readDominant(run: string, rules = READING_RULES): readonly string[] {
  return decodeRun(dominantDictionary, run, rules).flatMap((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)),
  );
}

describe("a pair nobody counted reading a function word its rare way", () => {
  it("reads 的 de after a verb a pair would have taken", () => {
    assertArrayEquals(readDominant("会破的"), ["huì", "pò", "de"]);
  });

  it("reads the pair without the rule, which is the bug", () => {
    assertArrayEquals(readDominant("会破的", []), ["huì", "pò", "dì"]);
  });

  it("reads 都 dōu after a 方位词 a name would have taken", () => {
    assertArrayEquals(readDominant("书上都是书"), [
      "shū",
      "shàng",
      "dōu",
      "shì",
      "shū",
    ]);
  });

  it("reads 更 gèng in front of what it raises", () => {
    assertArrayEquals(readDominant("会更香"), ["huì", "gèng", "xiāng"]);
  });

  it("reads 赚 zhuàn, in either script", () => {
    assertArrayEquals(readDominant("赚得"), ["zhuàn", "de"]);
    assertArrayEquals(readDominant("賺得"), ["zhuàn", "de"]);
  });

  it("leaves a counted word its rare reading", () => {
    assertArrayEquals(readDominant("目的"), ["mù", "dì"]);
  });

  it("leaves a name ending in 都 at the end of the run", () => {
    assertArrayEquals(readDominant("魔都"), ["mó", "dū"]);
  });

  it("leaves a pair 更 closes its gēng", () => {
    assertArrayEquals(readDominant("停更"), ["tíng", "gēng"]);
  });

  it("applies on its own as well as beside the other rules", () => {
    assertArrayEquals(readDominant("会更香", [DOMINANT_READING]), [
      "huì",
      "gèng",
      "xiāng",
    ]);
  });
});
