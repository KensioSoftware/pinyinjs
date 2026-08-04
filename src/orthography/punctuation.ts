import { type RewriteCharacters, rewriteParts } from "./parts.js";

/**
 * Whether Chinese punctuation is rewritten in the Latin script.
 *
 * On by default: pinyin is written in the Latin alphabet, so `。` reading as a
 * full stop is the same choice as `běi` reading as běi. Turn it off to leave
 * the source's punctuation exactly as it was.
 */
export type PunctuationStyle = "latin" | "keep";

/**
 * How each full-width mark is written in the Latin script.
 *
 * Only marks with an exact Latin equivalent are here. Brackets and quotation
 * marks are left alone deliberately: 《》 marks a title, which English sets in
 * italics rather than with a bracket, and the quotation styles do not
 * correspond one to one either.
 */
const LATIN_PUNCTUATION = new Map<string, string>([
  ["。", "."],
  ["，", ","],
  ["、", ","],
  ["；", ";"],
  ["：", ":"],
  ["？", "?"],
  ["！", "!"],
]);

/**
 * Marks that take a space after them but not before.
 */
const SPACE_AFTER = new Set([".", ",", ";", ":", "?", "!"]);

/**
 * Rewrite Chinese punctuation in the Latin script.
 *
 * Spacing changes with the script and not only the character: full-width marks
 * carry their own trailing space in the glyph, so `你好，世界` is `Nǐ hǎo,
 * shìjiè` and not `Nǐ hǎo,shìjiè`. A space is added after a mark only when
 * something follows it, so a sentence does not gain a trailing space.
 */
export function toLatinPunctuation(text: string): string {
  /* c8 ignore next -- rewriteParts returns one part for each it was given */
  return rewriteParts([text], latinCharacters)[0] ?? text;
}

/**
 * The same, over parts that are kept separate rather than joined into a string.
 *
 * Whether a mark takes a space depends on what follows it, which may well be
 * the next part rather than the rest of this one.
 */
export function toLatinPunctuationParts(
  parts: readonly string[],
): readonly string[] {
  return rewriteParts(parts, latinCharacters);
}

/**
 * Rewrite each Chinese mark in the Latin script, character by character.
 */
const latinCharacters: RewriteCharacters = (characters) =>
  characters.map((character, at) => {
    const latin = LATIN_PUNCTUATION.get(character);
    if (latin === undefined) {
      return character;
    }
    const next = characters[at + 1];
    return SPACE_AFTER.has(latin) && next !== undefined && next !== " "
      ? `${latin} `
      : latin;
  });
