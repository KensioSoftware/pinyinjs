import { toCharacters } from "../script/characters.js";
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
 * Marks a colon introduces quoted speech with: 他说：“你好。”
 */
const COLONS = new Set([":", "："]);

/**
 * Quotation marks that open a quotation, in either script.
 */
const OPENING_QUOTES = new Set(["“", "‘", "「", "『"]);

/**
 * A digit either side of a full stop, which is what makes it a decimal point.
 */
const DIGIT = /\d/u;

/**
 * Whether a character ends a sentence where it stands.
 *
 * A full stop with a digit either side of it is the point of a decimal rather
 * than the end of anything: 75.5元 is a price and not two sentences, so the
 * stop in it neither makes the text a sentence nor starts a new one. Only the
 * half-width stop can be a decimal point; 。 is never one.
 */
function isEnding(
  character: string,
  characters: readonly string[],
  at: number,
): boolean {
  if (!SENTENCE_ENDINGS.has(character)) {
    return false;
  }
  return !(
    character === "." &&
    DIGIT.test(characters[at - 1] ?? "") &&
    DIGIT.test(characters[at + 1] ?? "")
  );
}

/**
 * Whether text is punctuated as a sentence rather than quoted as a word.
 */
export function isSentence(text: string): boolean {
  const characters = toCharacters(text);
  return characters.some((character, at) =>
    isEnding(character, characters, at),
  );
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
 *
 * Speech a colon introduces is a sentence of its own, so 拉胡尔说：“你好。” is
 * `Lāhú'ěr shuō: “Nǐ hǎo.”`. Only a colon before the opening mark starts one.
 * A word quoted in the middle of a sentence, as in 他说“好”字, keeps the
 * small letter it would have had without the marks.
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
  let previous = "";

  return characters.map((character, at) => {
    if (isPending && character.toLowerCase() !== character.toUpperCase()) {
      isPending = false;
      previous = character;
      return character.toUpperCase();
    }
    if (
      isEnding(character, characters, at) ||
      (OPENING_QUOTES.has(character) && COLONS.has(previous))
    ) {
      isPending = true;
    }
    if (character.trim() !== "") {
      previous = character;
    }
    return character;
  });
};
