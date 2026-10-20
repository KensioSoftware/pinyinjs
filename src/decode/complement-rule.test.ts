import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { CALCULATING_SUAN, COMPLEMENT_DE } from "./complement-rule.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";
import type { EdgeRule } from "./rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/**
 * How each 得 of a run reads, with every rule or with every rule but one.
 */
function readingsOfDe(run: string, without?: EdgeRule): readonly string[] {
  const rules = READING_RULES.filter((rule) => rule !== without);
  const syllables = decodeRun(dictionary, run, rules).flatMap((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)),
  );
  return toCharacters(run).flatMap((character, at) =>
    character === "得" ? [syllables[at] ?? ""] : [],
  );
}

describe("得 after a verb or an adjective", () => {
  it("reads the complement particle before 直", () => {
    // Given a verb or an adjective, then 得直, which the full tier holds as an
    // untagged key read dé zhí
    const runs = [
      "他冻得直发抖真可怜",
      "他累得直喘气",
      "他冷得直发抖",
      "他笑得直不起腰",
      "她吓得直哭",
      "他冻得直哆嗦",
      "窗户都被震得直响",
    ];
    // When each is decoded
    // Then the 得 is the particle
    assertArrayEquals(
      runs.map((run) => readingsOfDe(run)),
      runs.map(() => ["de"]),
    );
    // And without the rule 得直 took it
    assertArrayEquals(readingsOfDe("他冻得直发抖真可怜", COMPLEMENT_DE), [
      "dé",
    ]);
  });

  it("reads the particle where the key is 得天", () => {
    // Given 长得天那样高, where 得天 is an untagged key
    // When it is decoded
    // Then the 得 is the particle
    assertArrayEquals(readingsOfDe("豆芽哪怕长得天那样高"), ["de"]);
    // And without the rule 得天 took it
    assertArrayEquals(readingsOfDe("豆芽哪怕长得天那样高", COMPLEMENT_DE), [
      "dé",
    ]);
  });

  it("keeps the complement it already read", () => {
    // Given complements with no untagged key over the 得
    // When each is decoded
    // Then the 得 is the particle, as it was before the rule
    assertArrayEquals(
      ["他冻得发抖", "篱笆扎得紧", "留得住人身", "走得正"].map((run) =>
        readingsOfDe(run),
      ),
      [["de"], ["de"], ["de"], ["de"]],
    );
  });

  it("keeps 得 the verb where it is", () => {
    // Given 得 meaning "to get" after a pronoun, an adverb or nothing
    const runs = ["他得了感冒", "我得了金牌", "他就得了奖", "迷而知返得道不远"];
    // When each is decoded
    // Then the 得 is dé
    assertArrayEquals(
      runs.map((run) => readingsOfDe(run)),
      runs.map(() => ["dé"]),
    );
  });

  it("leaves 得 alone where no verb or adjective stands before it", () => {
    // Given literary 得 meaning "to get", which the decode reads as the
    // particle with or without the rule
    const runs = ["有得必有失", "种禾得稻", "得智慧胜过得金子"];
    // When each is decoded with the rule and without it
    // Then the readings are the same
    assertArrayEquals(
      runs.map((run) => readingsOfDe(run)),
      runs.map((run) => readingsOfDe(run, COMPLEMENT_DE)),
    );
  });

  it("leaves a tagged word starting at the 得 alone", () => {
    // Given 得到 after a modal verb and 得体 after 表现
    // When each is decoded
    // Then the word keeps its dé
    assertArrayEquals(
      [readingsOfDe("才能得到服务"), readingsOfDe("表现得体")],
      [["dé"], ["dé"]],
    );
  });
});

describe("算得 before a complement", () => {
  it("reads 算 and the particle where a degree word follows", () => {
    // Given 算得 followed by an adverb, a degree word or a comparison
    const runs = [
      "祖冲之把圆周率算得非常准确",
      "量子计算机算得特别快",
      "她算账算得很精细",
      "我没法算得跟他一样快",
    ];
    // When each is decoded
    // Then the 得 is the particle
    assertArrayEquals(
      runs.map((run) => readingsOfDe(run)),
      runs.map(() => ["de"]),
    );
    // And without the rule 算得 took it
    assertArrayEquals(readingsOfDe("量子计算机算得特别快", CALCULATING_SUAN), [
      "dé",
    ]);
  });

  it("keeps 算得 meaning to count as", () => {
    // Given 算得 before 什么 and before 是
    // When each is decoded
    // Then the word keeps its dé
    assertArrayEquals(
      [readingsOfDe("这算得什么"), readingsOfDe("他算得是个好人")],
      [["dé"], ["dé"]],
    );
  });

  it("leaves 算得上 to the potential complement", () => {
    // Given 算得上
    // When it is decoded
    // Then the 得 is the particle, as POTENTIAL_DE already made it
    assertArrayEquals(readingsOfDe("他算得上一个作家"), ["de"]);
  });
});
