/**
 * The symbol tables inverted, for reading bopomofo back.
 *
 * Every one of these is derived from the write-side table it mirrors rather
 * than written out again, so the two cannot disagree.
 */
import { toCharacters } from "../script/characters.js";
import type { Final, Initial } from "../syllable/phonology.js";
import {
  FINAL_PARTS,
  INITIAL_SYMBOLS,
  type Medial,
  MEDIAL_SYMBOLS,
  type Rhyme,
  RHYME_SYMBOLS,
  TONES_BY_MARK,
} from "./bopomofo-tables.js";

/**
 * The final each medial and rhyme pair spells, keyed as `medial|rhyme`.
 */
export const FINALS_BY_PARTS = new Map<string, Final>(
  Object.entries(FINAL_PARTS).map(([final, [medial, rhyme]]) => [
    `${medial}|${rhyme}`,
    final as Final,
  ]),
);

/**
 * The initial each symbol stands for.
 */
export const INITIALS_BY_SYMBOL = new Map<string, Initial>(
  [...INITIAL_SYMBOLS].map(([initial, symbol]) => [symbol, initial]),
);

/**
 * The medial each symbol stands for.
 */
export const MEDIALS_BY_SYMBOL = new Map<string, Medial>(
  [...MEDIAL_SYMBOLS].map(([medial, symbol]) => [symbol, medial]),
);

/**
 * The rhyme each symbol stands for.
 */
export const RHYMES_BY_SYMBOL = new Map<string, Rhyme>(
  [...RHYME_SYMBOLS].map(([rhyme, symbol]) => [symbol, rhyme]),
);

/**
 * Whether one character is a bopomofo letter or tone mark.
 */
export function isSymbol(symbol: string): boolean {
  return (
    INITIALS_BY_SYMBOL.has(symbol) ||
    MEDIALS_BY_SYMBOL.has(symbol) ||
    RHYMES_BY_SYMBOL.has(symbol) ||
    TONES_BY_MARK.has(symbol)
  );
}

/**
 * Whether a string is written in bopomofo at all.
 *
 * This is the one thing bopomofo makes easy that Wade-Giles cannot: it has a
 * script of its own, so it is never mistaken for pinyin and a caller never has
 * to be told which system its input is in.
 */
export function isBopomofo(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed !== "" && toCharacters(trimmed).every((symbol) => isSymbol(symbol))
  );
}
