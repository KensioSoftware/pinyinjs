import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";

/**
 * One decoded word: the characters it covers and how they are read.
 */
export interface DecodedWord {
  /** The characters this word is written with. */
  readonly text: string;
  readonly reading: readonly Syllable[];
  /** Whether the dictionary marks it a proper noun. */
  readonly isProperNoun: boolean;
  /** jieba's tag, or the empty string when unknown. */
  readonly partOfSpeech: string;
  /** Whether a dictionary entry was found, rather than a character fallback. */
  readonly isKnown: boolean;
}

/**
 * How far ahead a match is looked for.
 *
 * The dictionary's longest keys are proverbs of a dozen or more characters, but
 * the prefix check stops a scan long before this in practice. It is a guard
 * against pathological input, not a real limit.
 */
const LONGEST_WORD = 16;

/**
 * The longest word starting at a position, or undefined if there is none.
 *
 * Walks one character at a time and stops as soon as the dictionary reports
 * that nothing begins with what has been collected — which is the whole reason
 * the index answers prefix queries, and what keeps this linear in practice
 * rather than quadratic in the longest key.
 */
function longestMatchAt(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): DecodedWord | undefined {
  let matched: DecodedWord | undefined;
  let candidate = "";

  for (
    let length = 0;
    length < LONGEST_WORD && at + length < characters.length;
    length++
  ) {
    /* c8 ignore next -- the loop condition keeps the index in range */
    candidate += characters[at + length] ?? "";
    if (!dictionary.hasPrefix(candidate)) {
      return matched;
    }
    const entry = dictionary.lookup(candidate);
    if (entry !== undefined) {
      matched = {
        text: candidate,
        reading: entry.reading,
        isProperNoun: entry.isProperNoun,
        partOfSpeech: entry.partOfSpeech,
        isKnown: true,
      };
    }
  }

  return matched;
}

/**
 * Read a Han run by always taking the longest dictionary match.
 *
 * **This is the baseline, not the intended algorithm.** It is the approach the
 * old PHP project took — forward longest-match, no scoring, no backtracking —
 * and it is here so that the lattice decoder has a number to beat rather than
 * an assertion to make. ALGORITHM.md sets out why it is structurally wrong:
 * it is locally optimal and never revisited, so a wrong early match poisons
 * everything after it, and it cannot use the frequency data at all.
 *
 * Characters no word covers fall back to their most likely reading.
 */
export function decodeGreedily(
  dictionary: Dictionary,
  run: string,
): readonly DecodedWord[] {
  const characters = toCharacters(run);
  const words: DecodedWord[] = [];
  let at = 0;

  while (at < characters.length) {
    const matched = longestMatchAt(dictionary, characters, at);

    if (matched === undefined) {
      // A character with no entry at all: keep it, unread, so that the text
      // still round-trips and the failure is visible rather than silent.
      /* c8 ignore next -- the while condition keeps the index in range */
      const character = characters[at] ?? "";
      words.push({
        text: character,
        reading: [],
        isProperNoun: false,
        partOfSpeech: "",
        isKnown: false,
      });
      at++;
      continue;
    }

    words.push(matched);
    at += toCharacters(matched.text).length;
  }

  return words;
}
