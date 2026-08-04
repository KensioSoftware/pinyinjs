import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { splitRuns } from "./runs.js";

/**
 * The runs as `text` strings, for readable expectations.
 */
function texts(text: string): readonly string[] {
  return splitRuns(text).map((run) => run.text);
}

describe("splitting text into runs", () => {
  it("keeps a run of Han together", () => {
    assertArrayEquals(texts("银行"), ["银行"]);
    assertTrue(splitRuns("银行")[0]?.isHan ?? false);
  });

  it("separates trailing punctuation", () => {
    assertArrayEquals(texts("我要去北京。"), ["我要去北京", "。"]);
  });

  it("marks which runs have a reading", () => {
    const runs = splitRuns("我要去北京。");
    assertTrue(runs[0]?.isHan ?? false);
    assertFalse(runs[1]?.isHan ?? true);
  });

  it("separates Latin and digits, which are the numerals package's job", () => {
    assertArrayEquals(texts("3D打印"), ["3D", "打印"]);
    assertArrayEquals(texts("B站"), ["B", "站"]);
  });

  it("alternates through mixed text", () => {
    assertArrayEquals(texts("我是 A，你呢?"), ["我是", " A，", "你呢", "?"]);
  });

  it("concatenates back to the input exactly", () => {
    for (const text of ["我要去北京玩儿。", "3D打印机", "", "abc", "。。。"]) {
      assertIdentical(texts(text).join(""), text);
    }
  });

  it("keeps a character outside the BMP whole", () => {
    // 𱿅 is two UTF-16 code units, and splitting it would produce a lone
    // surrogate rather than a character.
    assertArrayEquals(texts("𱿅"), ["𱿅"]);
    assertTrue(splitRuns("𱿅")[0]?.isHan ?? false);
  });

  it("returns nothing for empty text", () => {
    assertArrayLength(splitRuns(""), 0);
  });

  it("treats whitespace as non-Han", () => {
    assertArrayEquals(texts("北京 上海"), ["北京", " ", "上海"]);
  });
});
