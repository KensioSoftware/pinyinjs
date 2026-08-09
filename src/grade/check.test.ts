import {
  dictionaryOf,
  entry,
  SAMPLE_ENTRIES,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import {
  check,
  type CheckOptions,
  type PinyinVerdict,
  type SpacingVerdict,
} from "./check.js";

/**
 * The sample decoder dictionary, with the words these tests grade against.
 *
 * 你好 for third-tone sandhi, 的 for the neutral tone, and 干干净净 for a word
 * 分词连写 writes with a hyphen inside it.
 */
const dictionary = dictionaryOf([
  ...SAMPLE_ENTRIES,
  entry("你", "nǐ"),
  entry("我", "wǒ"),
  entry("的", "de"),
  entry("书", "shū"),
  entry("干", "gān"),
  entry("净", "jìng"),
  entry("你好", "nǐ hǎo", { frequency: 5000 }),
  entry("干干净净", "gān gān jìng jìng", { frequency: 300 }),
]);

/**
 * The verdict on each syllable of a check.
 */
function verdicts(
  text: string,
  typed: string,
  options: CheckOptions = {},
): readonly PinyinVerdict[] {
  return check(dictionary, text, typed, options).syllables.map(
    (one) => one.verdict,
  );
}

/**
 * Whether a transcription passes.
 */
function passes(
  text: string,
  typed: string,
  options: CheckOptions = {},
): boolean {
  return check(dictionary, text, typed, options).isCorrect;
}

describe("checking typed pinyin", () => {
  it("marks a correct transcription correct", () => {
    assertArrayEquals(verdicts("银行", "yínháng"), ["correct", "correct"]);
    assertIdentical(check(dictionary, "银行", "yínháng").score, 1);
  });

  it("reports the reading that was expected", () => {
    const checked = check(dictionary, "银行", "yínháng");
    assertArrayEquals(
      checked.reading.map((syllable) => writeSyllable(syllable)),
      ["yín", "háng"],
    );
  });

  it("names the characters each syllable reads, and where they are", () => {
    // What showing a learner their mistake against the text needs: the answer
    // alone cannot say which character 行 was.
    const checked = check(dictionary, "大银行", "dà yínxíng");
    assertArrayEquals(
      checked.syllables.map((one) => one.source),
      ["大", "银", "行"],
    );
    assertArrayEquals(
      checked.syllables.map((one) => one.at),
      [0, 1, 2],
    );
  });
});

describe("what a string comparison would get wrong", () => {
  it("takes either notation, mixed freely within a word", () => {
    assertTrue(passes("北京", "běijīng"));
    assertTrue(passes("北京", "bei3jing1"));
    assertTrue(passes("北京", "bei3jīng"));
  });

  it("takes a reading the decoder itself was unsure of", () => {
    // 行 alone is a guess between xíng, háng and héng: nothing but a prior
    // chose it, and the library knows that.
    assertTrue(passes("行", "xíng"));
    assertTrue(passes("行", "háng"));
    assertTrue(passes("行", "héng"));
  });

  it("does not take one the word settles", () => {
    // The same character, and no longer a guess: reading it xíng here means
    // breaking 银行 apart, which is a mistake rather than a coin toss.
    assertArrayEquals(verdicts("银行", "yínxíng"), ["correct", "wrong"]);
  });

  it("takes third-tone sandhi either way", () => {
    // 你好 is written nǐ hǎo and said ní hǎo.
    assertTrue(passes("你好", "nǐ hǎo"));
    assertTrue(passes("你好", "ní hǎo"));
    assertArrayEquals(verdicts("你好", "nì hǎo"), ["tone", "correct"]);
  });

  it("takes 一 and 不 sandhi either way", () => {
    assertTrue(passes("不是", "bú shì"));
    assertTrue(passes("不是", "bù shì"));
    assertTrue(passes("一个", "yí gè"));
    assertTrue(passes("一个", "yī gè"));
  });

  it("ignores word spacing and the 隔音符号 by default", () => {
    // Orthography rather than pronunciation. 海鸥 needs no mark at all —
    // longest-first reads it as two syllables either way — and 西安's is
    // dropped where it is written.
    for (const typed of ["Xī'ān", "xī ān", "xi1an1"]) {
      assertTrue(passes("西安", typed), typed);
    }
    assertTrue(passes("海鸥", "hǎiōu"));
    assertTrue(passes("海鸥", "hǎi'ōu"));
  });

  it("is not lenient about a 隔音符号 that changes what is spelled", () => {
    // The one place the mark is not orthography: `Xīān` is how `xiān` is
    // written, and reading it as two syllables is what 西安's mark is for.
    assertArrayEquals(verdicts("西安", "Xīān"), ["wrong", "missing"]);
  });
});

/**
 * Where each syllable of a check fell against the word boundaries.
 */
function spacings(
  text: string,
  typed: string,
  options: CheckOptions = {},
): readonly (SpacingVerdict | undefined)[] {
  return check(dictionary, text, typed, options).syllables.map(
    (one) => one.spacing,
  );
}

describe("word spacing", () => {
  it("reports a word written as two", () => {
    assertArrayEquals(spacings("银行", "yín háng"), ["correct", "split"]);
  });

  it("reports two words written as one", () => {
    assertArrayEquals(spacings("北京银行", "běijīngyínháng"), [
      "correct",
      "correct",
      "joined",
      "correct",
    ]);
  });

  it("keeps it off the syllable's own verdict", () => {
    // A separate mistake from a misreading, and reported separately: the
    // reading of 银行 here is perfect.
    assertArrayEquals(verdicts("银行", "yín háng"), ["correct", "correct"]);
  });

  it("does not count it towards the score by default", () => {
    assertTrue(passes("银行", "yín háng"));
    assertIdentical(check(dictionary, "银行", "yín háng").score, 1);
  });

  it("counts it where the caller asks for it", () => {
    const graded = { spacing: "required" } as const;
    assertFalse(passes("银行", "yín háng", graded));
    assertIdentical(check(dictionary, "银行", "yín háng", graded).score, 0.5);
  });

  it("takes either of the two conventions this package writes", () => {
    // 分词连写 attaches 市 to nothing and separates it; the words the
    // dictionary knows keep 北京市 whole. Both are written by this package,
    // under `grouping`, and a learner may have been taught either.
    const graded = { spacing: "required" } as const;
    assertTrue(passes("北京市", "běijīng shì", graded));
    assertTrue(passes("北京市", "běijīngshì", graded));
  });

  it("takes a hyphenated word joined or split", () => {
    // 干干净净 is `gāngān-jìngjìng`, one orthographic word with a boundary
    // written inside it, so a learner rendering that mark as a space has not
    // invented a boundary and one running it together has not lost one.
    const graded = { spacing: "required" } as const;
    for (const typed of [
      "gāngān-jìngjìng",
      "gāngān jìngjìng",
      "gāngānjìngjìng",
    ]) {
      assertTrue(passes("干干净净", typed, graded), typed);
    }
  });

  it("marks every boundary a run of words lost", () => {
    assertArrayEquals(spacings("我不是北京", "wǒbúshì běijīng"), [
      "correct",
      "joined",
      "joined",
      "correct",
      "correct",
    ]);
  });

  it("says nothing about a syllable only expected or only typed", () => {
    assertArrayEquals(spacings("北京市", "běi shì"), [
      "correct",
      undefined,
      "correct",
    ]);
    assertArrayEquals(spacings("北京", "běiběijīng"), [
      "correct",
      undefined,
      "correct",
    ]);
  });

  it("ignores the punctuation around a word", () => {
    assertTrue(passes("北京。", "běijīng."));
  });
});

describe("tones", () => {
  it("tells a missing tone apart from a wrong one", () => {
    assertArrayEquals(verdicts("北京", "bei jing"), ["toneless", "toneless"]);
    assertArrayEquals(verdicts("北京", "bei3jing3"), ["correct", "tone"]);
  });

  it("counts a missing tone correct by default", () => {
    assertTrue(passes("北京", "bei jing"));
  });

  it("counts it wrong where the caller asks for tones", () => {
    const checked = check(dictionary, "北京", "bei jing", {
      tones: "required",
    });
    assertFalse(checked.isCorrect);
    assertIdentical(checked.score, 0);
    assertArrayEquals(
      checked.syllables.map((one) => one.verdict),
      ["toneless", "toneless"],
    );
  });

  it("takes the neutral tone written the way pinyin writes it", () => {
    // Pinyin marks every tone but the neutral one, so 的 typed `de` has had
    // its tone written correctly rather than left off — even under `required`.
    assertArrayEquals(verdicts("我的书", "wǒ de shū"), [
      "correct",
      "correct",
      "correct",
    ]);
    assertTrue(passes("我的书", "wǒ de shū", { tones: "required" }));
    assertArrayEquals(verdicts("我的书", "wǒ de5 shū"), [
      "correct",
      "correct",
      "correct",
    ]);
    assertArrayEquals(verdicts("我的书", "wǒ dē shū"), [
      "correct",
      "tone",
      "correct",
    ]);
  });
});

describe("syllables dropped and invented", () => {
  it("reports a dropped syllable as missing, and blames only it", () => {
    // The reason the two are aligned rather than compared position by
    // position: everything after the slip is still right.
    assertArrayEquals(verdicts("北京市", "běi shì"), [
      "correct",
      "missing",
      "correct",
    ]);
  });

  it("reports an invented syllable as extra", () => {
    assertArrayEquals(verdicts("北京", "běi běi jīng"), [
      "correct",
      "extra",
      "correct",
    ]);
  });

  it("gives an extra syllable no characters to point at", () => {
    const extra = check(dictionary, "北京", "běi běi jīng").syllables[1];
    assertNonNullable(extra);
    assertUndefined(extra.expected);
    assertUndefined(extra.source);
    assertUndefined(extra.at);
    assertIdentical(extra.text, "běi");
  });

  it("gives a missing syllable no typed text", () => {
    const missing = check(dictionary, "北京市", "běi shì").syllables[1];
    assertNonNullable(missing);
    assertUndefined(missing.actual);
    assertIdentical(missing.text, "");
    assertIdentical(missing.source, "京");
  });

  it("reads a substitution as one wrong syllable rather than two slips", () => {
    // Aligning alone leaves 京 unmatched on one side and jang on the other.
    // Pairing what is left within the gap is what turns that into the one
    // mistake it is.
    assertArrayEquals(verdicts("北京", "běi jiāng"), ["correct", "wrong"]);
  });

  it("keeps what was typed even where it is not pinyin at all", () => {
    const checked = check(dictionary, "北京", "běi qqq");
    assertArrayEquals(
      checked.syllables.map((one) => one.verdict),
      ["correct", "wrong"],
    );
    const typed = checked.syllables[1];
    assertNonNullable(typed);
    assertIdentical(typed.text, "qqq");
    assertUndefined(typed.actual);
  });
});

describe("the score", () => {
  it("is the share of the reported syllables that were right", () => {
    assertIdentical(check(dictionary, "银行", "yínxíng").score, 0.5);
    assertIdentical(check(dictionary, "北京市", "běi shì").score, 2 / 3);
  });

  it("charges an invented syllable as much as a dropped one", () => {
    // Scoring against the expected reading alone would let a learner pad an
    // answer with syllables for free.
    assertIdentical(check(dictionary, "北京", "běi běi jīng").score, 2 / 3);
  });

  it("passes a text with nothing to read", () => {
    const checked = check(dictionary, "。", "");
    assertArrayLength(checked.syllables, 0);
    assertTrue(checked.isCorrect);
    assertIdentical(checked.score, 1);
  });
});

describe("conversion options", () => {
  it("grades against the locale's reading", () => {
    assertTrue(passes("垃圾", "lājī"));
    assertFalse(passes("垃圾", "lèsè"));
    assertTrue(passes("垃圾", "lèsè", { locale: "zh-TW" }));
  });

  it("grades against a reading the caller asserts", () => {
    assertFalse(passes("长大", "cháng dà"));
    assertTrue(passes("长大", "cháng dà", { readings: { 长大: "cháng dà" } }));
  });

  it("still takes both sandhi forms when the caller asks for the spoken one", () => {
    // The two conversions are opposite corners of the sandhi square whichever
    // corner the caller starts from, so both forms are accepted either way.
    const spoken = { sandhi: { thirdTone: true } } as const;
    assertTrue(passes("你好", "ní hǎo", spoken));
    assertTrue(passes("你好", "nǐ hǎo", spoken));
  });
});

describe("readings that are not one syllable per character", () => {
  it("names the characters a 儿化 syllable reads, together", () => {
    const checked = check(dictionary, "玩儿", "wánr");
    assertArrayEquals(
      checked.syllables.map((one) => one.source),
      ["玩儿"],
    );
    assertTrue(checked.isCorrect);
  });

  it("does not take a rejected reading of some other characters", () => {
    // 玩儿 read as wánr competes with 玩 wán and 儿 ér, and those are claims
    // about different stretches: neither is an alternative reading of 玩儿.
    assertArrayEquals(verdicts("玩儿", "wán ér"), ["wrong", "extra"]);
  });

  it("grades a number the text writes in digits", () => {
    assertTrue(passes("一个", "yí gè"));
    const checked = check(dictionary, "3个", "sān gè");
    assertTrue(checked.isCorrect);
    assertArrayEquals(
      checked.syllables.map((one) => one.source),
      ["3", "个"],
    );
  });
});
