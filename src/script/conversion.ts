/**
 * The script conversion tables, and what a conversion does with them.
 *
 * How the tables are stored is a separate question, and lives in the
 * `conversion-format`, `-write` and `-read` modules: everything here is about
 * the mapping itself, so that a caller converting text never meets the file
 * format, and changing the format never touches the conversion.
 */
import type { Syllable } from "../syllable/syllable.js";
import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { toCharacters } from "./characters.js";

export { readScriptTables } from "./conversion-read.js";
export { writeScriptTables } from "./conversion-write.js";

/**
 * How one character converts into the other script.
 *
 * A default, plus the readings that take a different form. The readings are
 * what make this more than a lookup table: 发 is 發 by default and 髮 when read
 * `fà`, and no table without the reading can tell 头发 from 出发.
 */
export interface CharacterConversion {
  /** The form taken when no reading is known, or none of them applies. */
  readonly to: string;
  /** Forms taken at particular readings, keyed by numbered pinyin. */
  readonly byReading?: ReadonlyMap<string, string>;
  /**
   * Other forms this character is commonly written as, with no reading to tell
   * them apart.
   *
   * These never change what a conversion *does* — the default or a reading
   * decides that — but they are what makes it honest. 面 and 麵 read alike, so
   * only a word settles which is meant; without these the conversion would
   * report 面粉 as locked while 下面 came out differently, claiming certainty it
   * does not have. Rare variants are excluded, or every 和 would be doubtful on
   * account of 咊.
   */
  readonly also?: readonly string[];
}

/**
 * Everything needed to convert between the scripts, in either direction.
 *
 * Words come before characters. A word the table names is converted as a whole,
 * because the evidence for a whole word is direct — some source wrote it that
 * way — whereas a character conversion is an inference from how that character
 * behaved elsewhere. Only words the character tables get *wrong* are stored, so
 * the word tables are exception lists rather than dictionaries.
 */
export interface ScriptTables {
  readonly toTraditional: ReadonlyMap<string, CharacterConversion>;
  readonly toSimplified: ReadonlyMap<string, CharacterConversion>;
  /** 简体 words whose 繁體 form the characters would get wrong. */
  readonly traditionalWords: ReadonlyMap<string, string>;
  /** 繁體 words whose 简体 form the characters would get wrong. */
  readonly simplifiedWords: ReadonlyMap<string, string>;
  /** Characters written only in 简体, for `detectScript`. */
  readonly hansOnly: ReadonlySet<string>;
  /** Characters written only in 繁體, for `detectScript`. */
  readonly hantOnly: ReadonlySet<string>;
}

/**
 * The key a reading is stored under: numbered pinyin, or the empty string.
 *
 * 儿化 is dropped because the r suffix never bears on which variant is meant,
 * and a toneless syllable keys separately from a toned one rather than matching
 * it, since a source that wrote no tone is not evidence about a particular one.
 */
export function conversionKey(syllable: Syllable | undefined): string {
  if (syllable === undefined) {
    return "";
  }
  // 儿化 is dropped by writing the syllable without it.
  return writeSyllable({ ...syllable, erhua: false }, "numbers");
}

/**
 * The form a character takes, given the syllable it is read as.
 */
export function convertCharacter(
  table: ReadonlyMap<string, CharacterConversion>,
  character: string,
  syllable: Syllable | undefined,
): string {
  const conversion = table.get(character);
  if (conversion === undefined) {
    return character;
  }
  const key = conversionKey(syllable);
  return conversion.byReading?.get(key) ?? conversion.to;
}

/**
 * Whether a character's conversion depends on how it is read.
 *
 * True where the table holds a reading that disagrees with the default, which
 * is exactly where a conversion made without a reading is a guess.
 */
export function isAmbiguousCharacter(
  table: ReadonlyMap<string, CharacterConversion>,
  character: string,
): boolean {
  const conversion = table.get(character);
  if (conversion === undefined) {
    return false;
  }
  return (
    (conversion.byReading?.size ?? 0) > 0 || (conversion.also?.length ?? 0) > 0
  );
}

/**
 * Every form a character is known to take, likeliest first.
 */
export function formsOf(
  conversion: CharacterConversion | undefined,
): readonly string[] {
  if (conversion === undefined) {
    return [];
  }
  return [
    ...new Set([
      conversion.to,
      ...(conversion.byReading?.values() ?? []),
      ...(conversion.also ?? []),
    ]),
  ];
}

/**
 * Convert a word character by character, using the readings where it has them.
 *
 * Readings line up with characters by position. A position with no reading
 * behind it takes the default, which is the right answer for the overwhelming
 * majority and a flagged guess for the rest.
 */
export function convertCharacters(
  table: ReadonlyMap<string, CharacterConversion>,
  word: string,
  readings: readonly (Syllable | undefined)[] = [],
): string {
  let converted = "";
  for (const [at, character] of toCharacters(word).entries()) {
    converted += convertCharacter(table, character, readings[at]);
  }
  return converted;
}

/**
 * Parse a stored reading key back into a syllable.
 *
 * Used by the round-trip check rather than by conversion, which keys on the
 * written form directly and never needs the syllable back.
 */
export function readConversionKey(key: string): Syllable | undefined {
  return key === "" ? undefined : readSyllable(key);
}
