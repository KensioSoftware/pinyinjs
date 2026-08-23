import { fileURLToPath } from "node:url";

import {
  assertArrayIncludes,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary, loadScriptTables } from "../dictionary/source.js";
import { detectScript } from "../script/script.js";
import {
  isUncertainChoice,
  type ScriptTarget,
  toScript,
  toScriptPieces,
} from "./script.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const source = fileSource(dataDirectory);
const dictionary = await loadDictionary(source, "full");
const tables = await loadScriptTables(source);

/**
 * Convert with the real dictionary, which is what these claims are about.
 */
function convert(text: string, to: ScriptTarget): string {
  return toScript(dictionary, tables, text, { to });
}

describe("the shipped script-only sets", () => {
  /** What the committed tables say a text is written in. */
  function detect(text: string): string | undefined {
    return detectScript(text, tables.hansOnly, tables.hantOnly);
  }

  it("holds the 繁體 characters a stray headword used to disqualify", () => {
    for (const character of ["幾", "衛", "卻", "徵", "襪"]) {
      assertTrue(tables.hantOnly.has(character));
      assertFalse(tables.hansOnly.has(character));
    }
  });

  it("holds the variant forms normalisation folds away before counting", () => {
    for (const character of ["裏", "衞", "麪", "羣"]) {
      assertTrue(tables.hantOnly.has(character));
    }
  });

  it("leaves a character both scripts write in neither set", () => {
    // 著 is 简体 for zhù and 繁體 for that and the aspect particle, 干 is the
    // 简体 of 幹 and a 繁體 character of its own, and 里 and 台 are both.
    for (const character of ["著", "干", "里", "台"]) {
      assertFalse(tables.hansOnly.has(character));
      assertFalse(tables.hantOnly.has(character));
    }
  });

  it("settles a sentence from the characters in it", () => {
    assertIdentical(detect("幾乎所有的工作都完成了。"), "Hant");
    assertIdentical(detect("哪裏"), "Hant");
    assertIdentical(detect("軍人所失去的自由太多了。"), "Hant");
    assertIdentical(detect("几乎所有的工作都完成了。"), "Hans");
  });

  it("leaves script-neutral text undecided", () => {
    assertIdentical(detect("看著你"), undefined);
    assertIdentical(detect("你好"), undefined);
  });
});

describe("script conversion", () => {
  describe("简 → 繁, the ambiguous direction", () => {
    it("uses the reading to split a merged character", () => {
      // The whole argument for doing this in a pinyin package: 发 is 發 or 髮,
      // and only the reading tells them apart.
      assertIdentical(convert("头发", "zh-Hant"), "頭髮");
      assertIdentical(convert("出发", "zh-Hant"), "出發");
    });

    it("splits 干 three ways", () => {
      assertIdentical(convert("干燥", "zh-Hant"), "乾燥");
      assertIdentical(convert("干部", "zh-Hant"), "幹部");
      assertIdentical(convert("干扰", "zh-Hant"), "干擾");
    });

    it("splits 只 and 面, which the reading cannot always settle", () => {
      assertIdentical(convert("一只猫", "zh-Hant"), "一隻貓");
      assertIdentical(convert("只有", "zh-Hant"), "只有");
      assertIdentical(convert("面条", "zh-Hant"), "麵條");
      assertIdentical(convert("下面", "zh-Hant"), "下面");
    });

    it("keeps 里 apart from 裡 on word evidence", () => {
      assertIdentical(convert("这里", "zh-Hant"), "這裡");
      assertIdentical(convert("公里", "zh-Hant"), "公里");
    });

    it("does not convert a rare variant no source writes", () => {
      // Unihan knows 咊 as a variant of 和. Nobody writes it.
      assertIdentical(convert("和平", "zh-Hant"), "和平");
    });

    it("leaves text with nothing to convert alone", () => {
      assertIdentical(convert("你好，OK！123", "zh-Hant"), "你好，OK！123");
    });
  });

  describe("繁 → 简, which only looks deterministic", () => {
    it("converts the ordinary merges", () => {
      assertIdentical(convert("頭髮", "zh-Hans"), "头发");
      assertIdentical(convert("出發", "zh-Hans"), "出发");
      assertIdentical(convert("幹部", "zh-Hans"), "干部");
    });

    it("keeps 乾 where it is not 干", () => {
      // 乾燥 gānzào simplifies, 乾隆 Qiánlóng does not.
      assertIdentical(convert("乾燥", "zh-Hans"), "干燥");
      assertIdentical(convert("乾隆", "zh-Hans"), "乾隆");
    });
  });

  describe("regional 繁體 orthography", () => {
    it("writes Taiwan by default for a bare zh-Hant", () => {
      assertIdentical(
        convert("群众", "zh-Hant"),
        convert("群众", "zh-Hant-TW"),
      );
    });

    it("writes the Hong Kong forms when asked", () => {
      assertIdentical(convert("群众", "zh-Hant-HK"), "羣眾");
      assertIdentical(convert("面包", "zh-Hant-HK"), "麪包");
      assertIdentical(convert("里面", "zh-Hant-HK"), "裏面");
      assertIdentical(convert("卫生", "zh-Hant-HK"), "衞生");
    });

    it("splits 著 and 着 by the reading, which Taiwan does not", () => {
      assertIdentical(convert("看着", "zh-Hant-TW"), "看著");
      assertIdentical(convert("看着", "zh-Hant-HK"), "看着");
      assertIdentical(convert("著作", "zh-Hant-HK"), "著作");
    });

    it("writes 蔘 only for the 參 that is ginseng", () => {
      assertIdentical(convert("人参", "zh-Hant-HK"), "人蔘");
      assertIdentical(convert("参加", "zh-Hant-HK"), "參加");
      assertIdentical(convert("参差", "zh-Hant-HK"), "參差");
      // Taiwan merges the two, so it writes 參 for both.
      assertIdentical(convert("人参", "zh-Hant-TW"), "人參");
    });

    it("accepts Hong Kong input and converts it like its Taiwan spelling", () => {
      assertIdentical(convert("羣眾", "zh-Hans"), "群众");
      assertIdentical(convert("麪包", "zh-Hans"), "面包");
    });
  });

  describe("confidence", () => {
    it("locks a character with only one form", () => {
      const { choices } = toScriptPieces(dictionary, tables, "头发", {
        to: "zh-Hant",
      });
      const [tou] = choices;
      assertNonNullable(tou);
      assertIdentical(tou.evidence, "locked");
      assertFalse(isUncertainChoice(tou));
    });

    it("credits the reading where it separated the rivals", () => {
      // 干货 gānhuò is 乾貨 because 干 read gān is 乾, not because any word list
      // was consulted. That is the evidence no orthographic converter has.
      const { choices } = toScriptPieces(dictionary, tables, "干货", {
        to: "zh-Hant",
      });
      const [gan] = choices;
      assertNonNullable(gan);
      assertIdentical(gan.to, "乾");
      assertIdentical(gan.evidence, "reading");
      assertFalse(isUncertainChoice(gan));
    });

    it("credits an attested word above the characters", () => {
      const { choices } = toScriptPieces(dictionary, tables, "干扰", {
        to: "zh-Hant",
      });
      const [gan] = choices;
      assertNonNullable(gan);
      assertIdentical(gan.to, "干");
      assertIdentical(gan.evidence, "word");
      assertFalse(isUncertainChoice(gan));
    });

    it("reports an unseparated guess as uncertain, with its rivals", () => {
      // 下面 is a surface or a bowl of noodles, both read xiàmiàn. Nothing here
      // can settle it, and saying so is more use than picking silently.
      const { choices } = toScriptPieces(dictionary, tables, "下面", {
        to: "zh-Hant",
      });
      const mian = choices.at(-1);
      assertNonNullable(mian);
      assertIdentical(mian.evidence, "default");
      assertTrue(isUncertainChoice(mian));
      assertArrayIncludes(mian.alternatives, "麵");
    });

    it("does not offer the form it chose as an alternative to itself", () => {
      const { choices } = toScriptPieces(dictionary, tables, "这里", {
        to: "zh-Hant",
      });
      const offered = choices.filter((choice) =>
        choice.alternatives.includes(choice.to),
      );
      assertArrayLength(offered, 0);
    });

    it("reports one choice per character, in order", () => {
      const { text, choices } = toScriptPieces(dictionary, tables, "头发", {
        to: "zh-Hant",
      });
      assertArrayLength(choices, 2);
      assertIdentical(choices.map((choice) => choice.from).join(""), "头发");
      assertIdentical(choices.map((choice) => choice.to).join(""), text);
    });

    it("defaults to 简体 when no target is named", () => {
      assertIdentical(toScript(dictionary, tables, "頭髮"), "头发");
    });
  });

  describe("script detection sets", () => {
    it("names 发 as 简体-only and 髮 as 繁體-only", () => {
      assertTrue(tables.hansOnly.has("发"));
      assertTrue(tables.hantOnly.has("髮"));
    });

    it("leaves a character both scripts write in neither set", () => {
      for (const character of ["中", "人", "好"]) {
        assertFalse(tables.hansOnly.has(character));
        assertFalse(tables.hantOnly.has(character));
      }
    });
  });
});
