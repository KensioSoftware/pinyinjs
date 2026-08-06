import {
  dictionaryOf,
  entry,
  reading,
} from "#test/fixtures/decoder-dictionary.js";
import { assertArrayEquals, assertArrayLength } from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import {
  ATTESTED_ERHUA,
  COUNTED_MEASURE,
  MODAL_DE,
  READING_RULES,
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
