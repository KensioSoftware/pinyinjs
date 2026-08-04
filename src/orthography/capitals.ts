import { type RewriteCharacters, rewriteParts } from "./parts.js";

/**
 * Which capitals are written.
 *
 * `auto` capitalises proper nouns always, and the first word of a sentence only
 * where the source is punctuated as one — see {@link capitaliseSentences} for
 * why that condition is there. `proper` writes proper nouns and nothing else,
 * `none` writes neither.
 */
export type CapitalStyle = "auto" | "proper" | "none";

/**
 * Punctuation a sentence ends with, in either script.
 */
const SENTENCE_ENDINGS = new Set([".", "!", "?", "。", "！", "？"]);

/**
 * Whether text is punctuated as a sentence rather than quoted as a word.
 */
export function isSentence(text: string): boolean {
  for (const character of text) {
    if (SENTENCE_ENDINGS.has(character)) {
      return true;
    }
  }
  return false;
}

/**
 * Capitalise the first letter of a word.
 */
export function capitaliseWord(text: string): string {
  return text.slice(0, 1).toUpperCase() + text.slice(1);
}

/**
 * Capitalise the first letter of each sentence.
 *
 * Applied only when the source text is punctuated as a sentence, which is the
 * one signal available for telling a sentence from a word quoted on its own.
 * 学生 converts to `xuésheng` rather than `Xuésheng` because it is a word being
 * looked up; 这是我的书。 converts to `Zhè shì wǒ de shū.` because it is not.
 * Without that condition every single-word conversion would come back
 * capitalised, which is wrong far more often than it is right.
 *
 * Anything that is not a letter — an opening bracket, a quotation mark, a space
 * — is passed over rather than ending the search, so a sentence inside brackets
 * still capitalises.
 */
export function capitaliseSentences(text: string): string {
  /* c8 ignore next -- rewriteParts returns one part for each it was given */
  return rewriteParts([text], capitaliseCharacters)[0] ?? text;
}

/**
 * The same, over parts that are kept separate rather than joined into a string.
 *
 * A sentence capital belongs to whichever syllable starts the sentence, and an
 * output format that wraps each syllable separately still has to find it.
 */
export function capitaliseSentenceParts(
  parts: readonly string[],
): readonly string[] {
  return rewriteParts(parts, capitaliseCharacters);
}

/**
 * Capitalise the first letter of each sentence, character by character.
 */
const capitaliseCharacters: RewriteCharacters = (characters) => {
  let isPending = true;

  return characters.map((character) => {
    if (isPending && character.toLowerCase() !== character.toUpperCase()) {
      isPending = false;
      return character.toUpperCase();
    }
    if (SENTENCE_ENDINGS.has(character)) {
      isPending = true;
    }
    return character;
  });
};
