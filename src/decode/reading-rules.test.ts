import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
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
  COUNTED_MEASURE,
  MODAL_DE,
  PLAYING_TAN,
  READING_RULES,
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
  // 越长 exactly as the artifact holds it: a `yuè cháng` reading carrying no
  // part of speech, and the only member of its paradigm — 越高 and 越好 are
  // absent here as they are there.
  entry("越长", "yuè cháng", { frequency: 400 }),
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

describe("长 as an adjective", () => {
  /** How a run of the 长 cases reads, word by word. */
  function readChang(run: string, rules = READING_RULES): readonly string[] {
    return decodeRun(changDictionary, run, rules).map((word) =>
      word.reading.map((syllable) => writeSyllable(syllable)).join(""),
    );
  }

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
});

describe("弹 where it is playing", () => {
  /** How a run of the 弹 cases reads, word by word. */
  function readTan(run: string, rules = READING_RULES): readonly string[] {
    return decodeRun(tanDictionary, run, rules).map((word) =>
      word.reading.map((syllable) => writeSyllable(syllable)).join(""),
    );
  }

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
