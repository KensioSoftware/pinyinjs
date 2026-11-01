import { fileURLToPath } from "node:url";

import { assertArrayEquals, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { convert } from "./convert.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";
import { LANGUAGE_WENSHU } from "./wenshu-rule.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** The words a run decodes into, with every rule or with every rule but this. */
function wordsOf(run: string, withRule = true): readonly string[] {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== LANGUAGE_WENSHU);
  return decodeRun(dictionary, run, rules).map((word) => word.text);
}

describe("文书 after a language name", () => {
  it("leaves the 文 to the language and the 书 to itself", () => {
    // Given books in a language, in both scripts
    // When the run is decoded
    // Then the language is one word and the book another
    assertArrayEquals(wordsOf("有很多中文书"), [
      "有",
      "很",
      "多",
      "中文",
      "书",
    ]);
    assertArrayEquals(wordsOf("看中文書"), ["看", "中文", "書"]);
    assertArrayEquals(wordsOf("外文书"), ["外文", "书"]);
  });

  it("is what takes 文书 out of a language name", () => {
    // Given the same run decoded without the rule
    // Then 中 stands alone and 文书 is the document
    assertArrayEquals(wordsOf("有很多中文书", false), [
      "有",
      "很",
      "多",
      "中",
      "文书",
    ]);
  });

  it("gives 中文 the capital a language name takes", () => {
    // Given 中文书 in a sentence
    // When it is converted
    // Then 中文 is capitalised as 汉语 is
    assertIdentical(
      convert(dictionary, "对面的书店很大，有很多中文书。"),
      "Duìmiàn de shūdiàn hěn dà, yǒu hěn duō Zhōngwén shū.",
    );
    assertIdentical(convert(dictionary, "我学汉语。"), "Wǒ xué Hànyǔ.");
  });

  it("leaves 文书 a document where no language name ends at its 文", () => {
    assertArrayEquals(wordsOf("法律文书"), ["法律", "文书"]);
    assertArrayEquals(wordsOf("文书"), ["文书"]);
    assertArrayEquals(wordsOf("他写了一份文书"), [
      "他",
      "写",
      "了",
      "一份",
      "文书",
    ]);
  });
});
