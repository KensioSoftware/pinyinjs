/**
 * Split text into characters, keeping any outside the BMP whole.
 *
 * Matched rather than spread so that the extension-block characters Unihan
 * covers stay in one piece where `text.length` and index access would cut them
 * in half — and matched rather than `Array.from` so that neither the rule
 * against spreading strings nor the rule preferring a spread has to be argued
 * with on every word.
 */
export function toCharacters(text: string): readonly string[] {
  /* c8 ignore next -- the match only returns null for the empty string */
  return text.match(/./gsu) ?? [];
}

/**
 * How many characters a text is written with, counting by code point.
 */
export function characterCount(text: string): number {
  return toCharacters(text).length;
}

/**
 * Whether a word is written with exactly one character.
 */
export function isSingleCharacter(text: string): boolean {
  return characterCount(text) === 1;
}
