/**
 * The dry 干 whose subject is a wet thing: 衣服还没干, 河都干了.
 */
import { toCharacters } from "../script/characters.js";
import { AFTER_WET, BETWEEN, WET } from "./dry-gan-words.js";

/**
 * Whether a character is punctuation or the run's end, which is where a
 * sentence about a wet thing stops.
 */
function endsClause(character: string | undefined): boolean {
  return character === undefined || !/\p{Script=Han}/u.test(character);
}

/**
 * Whether the text ending at a position spells a word.
 */
export function spellsBefore(
  characters: readonly string[],
  at: number,
  word: string,
): boolean {
  const spelled = toCharacters(word);
  return spelled.every(
    (character, offset) =>
      characters[at - spelled.length + offset] === character,
  );
}

/**
 * Where the subject of a 干 ends, once up to three adverbs in front of it are
 * stepped over.
 */
function subjectEnd(characters: readonly string[], at: number): number {
  let end = at;
  for (let skipped = 0; skipped < 3; skipped++) {
    const adverb = adverbEndingAt(characters, end);
    if (adverb === undefined) {
      return end;
    }
    end -= toCharacters(adverb).length;
  }
  return end;
}

/**
 * The adverb ending at a position, longest first, or undefined.
 */
function adverbEndingAt(
  characters: readonly string[],
  end: number,
): string | undefined {
  return BETWEEN.find((word) => spellsBefore(characters, end, word));
}

/**
 * 衣服还没干 and 河都干了: a wet thing, then adverbs, then 干 with nothing
 * after it but a particle or a complement.
 */
export function isWetThingDrying(
  characters: readonly string[],
  at: number,
): boolean {
  const after = characters[at + 1];
  if (!endsClause(after) && !AFTER_WET.has(after ?? "")) {
    return false;
  }
  const end = subjectEnd(characters, at);
  for (const thing of WET) {
    if (spellsBefore(characters, end, thing)) {
      return true;
    }
  }
  return false;
}
