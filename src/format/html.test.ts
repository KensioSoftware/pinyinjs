import { sampleDictionary } from "#test/fixtures/decoder-dictionary.js";
import {
  assertIdentical,
  assertStringIncludes,
  assertStringNotIncludes,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { convertToHtml, type HtmlOptions, toHtml } from "./html.js";

const dictionary = sampleDictionary();

/**
 * Mark up a conversion with the shared test dictionary.
 */
function html(text: string, options?: HtmlOptions): string {
  return convertToHtml(dictionary, text, options);
}

describe("converting to HTML", () => {
  it("wraps each syllable in its own element", () => {
    assertIdentical(
      html("银行"),
      '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span>' +
        '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>',
    );
  });

  it("declares each syllable to be pinyin rather than the page's language", () => {
    assertStringIncludes(html("北京"), 'lang="zh-Latn-CN-pinyin"');
  });

  it("declares the reading standard the conversion was asked for", () => {
    assertStringIncludes(
      html("垃圾", { locale: "zh-TW" }),
      'lang="zh-Latn-TW-pinyin"',
    );
    assertStringNotIncludes(html("垃圾", { locale: "zh-TW" }), "zh-Latn-CN");
  });

  it("declares pinyin however its tones are written", () => {
    assertStringIncludes(
      html("银行", { notation: "numbers" }),
      'lang="zh-Latn-CN-pinyin"',
    );
  });

  it("leaves the language to a wrapper when asked", () => {
    assertIdentical(
      html("银行", { lang: false }),
      '<span class="py-syllable py-tone-2">yín</span>' +
        '<span class="py-syllable py-tone-2">háng</span>',
    );
  });

  it("declares nothing on the text that was never Han", () => {
    // Not pinyin, and not marked up at all, so it has nothing to declare on.
    assertIdentical(
      toHtml([{ text: " and ", syllable: undefined, confidence: undefined }]),
      " and ",
    );
  });

  it("writes the tone as a class", () => {
    assertStringIncludes(html("北京"), 'class="py-syllable py-tone-3"');
    assertStringIncludes(html("北京"), 'class="py-syllable py-tone-1"');
  });

  it("leaves the tone off where none is written", () => {
    assertIdentical(
      toHtml([
        {
          text: "bei",
          syllable: { initial: "b", final: "ei", tone: undefined },
          confidence: undefined,
        },
      ]),
      '<span class="py-syllable" lang="zh-Latn-CN-pinyin">bei</span>',
    );
  });

  it("marks a reading the decode was guessing at", () => {
    // 行 on its own is read xíng on the strength of a prior and nothing else.
    assertStringIncludes(html("行"), "py-uncertain");
    assertStringIncludes(html("行"), 'data-alternatives="háng héng"');
  });

  it("does not mark a reading a dictionary word backs", () => {
    // The same character, in a word: taking háng any other way means breaking
    // 银行 apart, so it is not a guess.
    assertStringNotIncludes(html("银行"), "py-uncertain");
  });

  it("does not mark a locked reading", () => {
    assertStringNotIncludes(html("北京"), "py-uncertain");
  });

  it("writes the alternatives in the notation the conversion uses", () => {
    assertStringIncludes(
      html("行", { notation: "numbers" }),
      'data-alternatives="hang2 heng2"',
    );
  });

  it("keeps the spaces and marks between the syllables", () => {
    assertStringIncludes(html("北京银行"), "</span> <span");
    assertStringIncludes(html("北京。"), "</span>.");
  });

  it("keeps the 隔音符号 inside the syllable it belongs to", () => {
    assertStringIncludes(html("西安"), ">'ān</span>");
  });

  it("escapes the source's own text rather than passing markup through", () => {
    assertStringIncludes(html("<b>银行"), "&lt;b&gt;");
    assertStringNotIncludes(html("<b>银行"), "<b>");
  });

  it("can be asked for no tone classes", () => {
    assertIdentical(
      html("银行", { toneClasses: false }),
      '<span class="py-syllable" lang="zh-Latn-CN-pinyin">yín</span>' +
        '<span class="py-syllable" lang="zh-Latn-CN-pinyin">háng</span>',
    );
  });

  it("can be asked not to mark uncertainty", () => {
    assertStringNotIncludes(
      html("行", { markUncertain: false }),
      "py-uncertain",
    );
  });

  it("takes the conversion's own options", () => {
    assertStringIncludes(html("垃圾", { locale: "zh-TW" }), ">lè</span>");
    assertStringIncludes(
      html("银行", { notation: "superscript" }),
      ">yin²</span>",
    );
  });

  it("marks up nothing at all as nothing at all", () => {
    assertIdentical(html(""), "");
  });
});
