import { sampleDictionary } from "#test/fixtures/decoder-dictionary.js";
import {
  assertIdentical,
  assertStringIncludes,
  assertStringNotIncludes,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  convertToAnnotatedHtml,
  convertToHtml,
  type HtmlOptions,
  toHtml,
} from "./html.js";

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
      toHtml([
        {
          text: " and ",
          syllable: undefined,
          confidence: undefined,
          source: undefined,
        },
      ]),
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
          source: "北",
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

/**
 * Annotate a conversion with the shared test dictionary.
 */
function annotated(text: string, options?: HtmlOptions): string {
  return convertToAnnotatedHtml(dictionary, text, options);
}

describe("annotating hanzi with its reading", () => {
  it("puts each syllable over the character it reads", () => {
    assertIdentical(
      annotated("银行"),
      '<ruby lang="zh">银<rp>(</rp><rt>' +
        '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span>' +
        "</rt><rp>)</rp></ruby>" +
        '<ruby lang="zh">行<rp>(</rp><rt>' +
        '<span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>' +
        "</rt><rp>)</rp></ruby>",
    );
  });

  it("keeps 儿化 whole, since one syllable reads two characters", () => {
    // The case every naive per-character annotation gets wrong: 玩儿 is `wánr`,
    // and there is no syllable to put over 儿 on its own.
    assertStringIncludes(annotated("玩儿"), '<ruby lang="zh">玩儿<rp>(</rp>');
    assertStringIncludes(annotated("玩儿"), ">wánr</span>");
  });

  it("annotates a read number once, over all of it", () => {
    // 95% is bǎifēnzhījiǔshíwǔ: six syllables over three written characters,
    // in the other order, so none of them belongs to any one character.
    const html = annotated("95%");
    assertStringIncludes(html, '<ruby lang="zh">95%<rp>(</rp>');
    assertStringIncludes(html, ">bǎi</span>");
    assertStringIncludes(html, ">wǔ</span>");
    assertIdentical(html.match(/<ruby/gu)?.length, 1);
  });

  it("declares the base Chinese and the reading pinyin", () => {
    // Two different languages inside one element: without both, a screen
    // reader on an English page says the pinyin as English.
    assertStringIncludes(annotated("银行"), '<ruby lang="zh">');
    assertStringIncludes(annotated("银行"), 'lang="zh-Latn-CN-pinyin"');
  });

  it("falls back to parentheses where ruby is not supported", () => {
    assertStringIncludes(annotated("银行"), "<rp>(</rp>");
    assertStringIncludes(annotated("银行"), "<rp>)</rp>");
  });

  it("leaves the language to a wrapper when asked", () => {
    assertStringIncludes(annotated("银行", { lang: false }), "<ruby>银<rp>");
    assertStringNotIncludes(annotated("银行", { lang: false }), "lang=");
  });

  it("keeps the source punctuation the conversion rewrote", () => {
    // The base is what the author wrote. A conversion writes 。 as a full stop
    // because that is the pinyin orthography, and putting that in the hanzi
    // would annotate a text nobody typed.
    const html = annotated("银行。");
    assertStringIncludes(html, "。");
    assertStringNotIncludes(html, ".");
  });

  it("leaves the space between two words out of the hanzi", () => {
    // 分词连写 spaces the pinyin; Chinese is not written with spaces, and each
    // base is its own group on the page already.
    assertStringNotIncludes(annotated("银行"), "</ruby> <ruby");
  });

  it("marks up text that was never Han as text", () => {
    assertStringIncludes(annotated("hello 银行"), "hello ");
    assertStringNotIncludes(annotated("hello 银行"), '<ruby lang="zh">hello');
  });

  it("escapes what it annotates", () => {
    assertStringNotIncludes(annotated("<script>银行"), "<script>");
    assertStringIncludes(annotated("<script>银行"), "&lt;script&gt;");
  });

  it("marks a reading it was guessing at, inside the annotation", () => {
    assertStringIncludes(annotated("行"), "py-uncertain");
    assertStringIncludes(annotated("行"), 'data-alternatives="háng');
  });

  it("takes the conversion's own options", () => {
    assertStringIncludes(annotated("银行", { notation: "numbers" }), ">yin2<");
  });

  it("annotates nothing at all as nothing at all", () => {
    assertIdentical(annotated(""), "");
  });
});
