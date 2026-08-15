/**
 * Pairing a CC-CEDICT entry's two scripts up, character by character.
 */
import { toCharacters } from "../script/characters.js";
import type { ReadCharacters } from "./reading.js";
import type { ScriptPairing } from "./variant-counts.js";

export type { ScriptPairing } from "./variant-counts.js";
export { TraditionalTable } from "./traditional-table.js";

/**
 * Pair a CC-CEDICT entry's two scripts up character by character.
 *
 * Yields nothing when the two forms differ in length, which happens for a
 * handful of entries where the scripts genuinely write a different number of
 * characters. Guessing an alignment there would poison the table with pairings
 * that were never observed.
 */
export function pairScripts(
  hans: string,
  hant: string,
  aligned: readonly ReadCharacters[] | undefined,
): readonly ScriptPairing[] {
  const hansCharacters = toCharacters(hans);
  const hantCharacters = toCharacters(hant);
  if (
    hansCharacters.length !== hantCharacters.length ||
    hansCharacters.length === 0
  ) {
    return [];
  }

  const pairings: ScriptPairing[] = [];
  let at = 0;
  const groups = aligned ?? [];
  for (const read of groups) {
    const group = toCharacters(read.characters);
    const numbered = group.entries();
    for (const [offset, character] of numbered) {
      const hantCharacter = hantCharacters[at + offset];
      if (hantCharacter === undefined) {
        return [];
      }
      pairings.push({
        hans: character,
        hant: hantCharacter,
        // A syllable covering two characters is not evidence about the second.
        syllable: group.length === 1 ? read.syllable : undefined,
      });
    }
    at += group.length;
  }

  // No usable reading: still worth recording the pairing itself, since which
  // variant a character usually takes is useful even without one.
  if (aligned === undefined) {
    const unread = hansCharacters.entries();
    for (const [offset, character] of unread) {
      pairings.push({
        hans: character,
        /* c8 ignore next -- the two scripts are known to be the same length */
        hant: hantCharacters[offset] ?? character,
        syllable: undefined,
      });
    }
  }

  return pairings;
}
