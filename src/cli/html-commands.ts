/**
 * The conversions that hand back markup rather than text.
 *
 * `html` writes one element per syllable and `annotate` puts the reading above
 * the hanzi as ruby. They sit together because they take the same options and
 * are both uncoloured for the same reason: the classes are the hook, and a
 * terminal escape code inside markup would be pasted into a page.
 */
import { convertToAnnotatedHtml, convertToHtml } from "../format/html.js";
import { CONVERT_FLAGS, htmlOptions } from "./arguments.js";
import { type Command, dictionaryOf } from "./command.js";

/**
 * Convert each text to HTML, one element per syllable.
 */
export const HTML: Command = {
  name: "html",
  summary: "hanzi to pinyin as HTML, one element per syllable",
  argument: "[text...]",
  flags: [
    ...CONVERT_FLAGS,
    "no-tone-classes",
    "no-uncertain",
    "no-lang",
    "system",
  ],
  needsDictionary: true,
  run: (input) => {
    const options = htmlOptions(input.flags);
    return input.texts.map((text) => {
      const html = convertToHtml(dictionaryOf(input), text, options);
      return { lines: [html], data: { text, html } };
    });
  },
};

/**
 * Annotate each text: the hanzi, with its reading above.
 *
 * Uncoloured for the same reason `html` is — the classes are the hook, and a
 * terminal escape code inside markup would be pasted into a page.
 */
export const ANNOTATE: Command = {
  name: "annotate",
  summary: "hanzi with its reading above, as ruby HTML",
  argument: "[text...]",
  flags: [
    ...CONVERT_FLAGS,
    "no-tone-classes",
    "no-uncertain",
    "no-lang",
    "system",
  ],
  needsDictionary: true,
  run: (input) => {
    const options = htmlOptions(input.flags);
    return input.texts.map((text) => {
      const html = convertToAnnotatedHtml(dictionaryOf(input), text, options);
      return { lines: [html], data: { text, html } };
    });
  },
};
