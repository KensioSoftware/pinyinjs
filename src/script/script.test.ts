import {
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  DEFAULT_LOCALE,
  detectScript,
  isLocale,
  isScript,
  LOCALES,
  SCRIPTS,
} from "./script.js";

// Characters that exist in only one script, as the real detector will be given
// them from the Unihan variant tables.
const HANS_ONLY = new Set(["发", "万", "银", "长", "国", "头"]);
const HANT_ONLY = new Set(["發", "髮", "萬", "銀", "長", "國", "頭"]);

describe("script", () => {
  describe("SCRIPTS and LOCALES", () => {
    it("has both scripts", () => {
      assertArrayLength(SCRIPTS, 2);
    });

    it("has both reading standards", () => {
      assertArrayLength(LOCALES, 2);
    });

    it("defaults to 普通话", () => {
      assertIdentical(DEFAULT_LOCALE, "zh-CN");
    });
  });

  describe("isScript", () => {
    it("accepts both scripts", () => {
      assertTrue(isScript("Hans"));
      assertTrue(isScript("Hant"));
    });

    it("rejects other strings, including the locale codes", () => {
      assertFalse(isScript("zh-CN"));
      assertFalse(isScript("simplified"));
      assertFalse(isScript(""));
    });
  });

  describe("isLocale", () => {
    it("accepts both reading standards", () => {
      assertTrue(isLocale("zh-CN"));
      assertTrue(isLocale("zh-TW"));
    });

    it("rejects other strings, including the script codes", () => {
      assertFalse(isLocale("Hant"));
      assertFalse(isLocale("zh"));
      assertFalse(isLocale(""));
    });
  });

  describe("detectScript", () => {
    it("identifies text written in simplified characters", () => {
      assertIdentical(detectScript("头发", HANS_ONLY, HANT_ONLY), "Hans");
      assertIdentical(detectScript("中国银行", HANS_ONLY, HANT_ONLY), "Hans");
    });

    it("identifies text written in traditional characters", () => {
      assertIdentical(detectScript("頭髮", HANS_ONLY, HANT_ONLY), "Hant");
      assertIdentical(detectScript("中國銀行", HANS_ONLY, HANT_ONLY), "Hant");
    });

    it("reports script-neutral text as neither, since it converts the same either way", () => {
      assertUndefined(detectScript("我要去北京", HANS_ONLY, HANT_ONLY));
      assertUndefined(detectScript("", HANS_ONLY, HANT_ONLY));
      assertUndefined(detectScript("hello", HANS_ONLY, HANT_ONLY));
    });

    it("goes with the majority when a text mixes both scripts", () => {
      assertIdentical(detectScript("國国国", HANS_ONLY, HANT_ONLY), "Hans");
      assertIdentical(detectScript("国國國", HANS_ONLY, HANT_ONLY), "Hant");
    });

    it("reports an even mix as neither rather than guessing", () => {
      assertUndefined(detectScript("国國", HANS_ONLY, HANT_ONLY));
    });
  });
});
