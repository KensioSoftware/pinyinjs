/**
 * The edges one position of a lattice offers.
 *
 * A word the dictionary has starting here, or the single character sitting
 * here — the two ways a reading can cover ground, kept apart from assembling
 * them into a lattice.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import {
  ALTERNATE_PENALTY,
  type LatticeEdge,
  LONGEST_WORD,
  READING_CHARGE,
  UNKNOWN_COST,
} from "./lattice-types.js";

export {
  type Lattice,
  type LatticeEdge,
  READING_CHARGE,
  UNKNOWN_COST,
} from "./lattice-types.js";

/**
 * The edges leaving a position that come from multi-character dictionary words.
 *
 * Walks one character at a time and stops as soon as the dictionary reports
 * that nothing begins with what has been collected, which is what keeps the
 * scan linear in practice rather than quadratic in the longest key.
 */
export function wordEdgesAt(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): readonly LatticeEdge[] {
  const edges: LatticeEdge[] = [];
  let candidate = "";

  for (
    let length = 0;
    length < LONGEST_WORD && at + length < characters.length;
    length++
  ) {
    /* c8 ignore next -- the loop condition keeps the index in range */
    candidate += characters[at + length] ?? "";
    if (!dictionary.hasPrefix(candidate)) {
      break;
    }
    const entry = length === 0 ? undefined : dictionary.lookup(candidate);
    if (entry !== undefined) {
      edges.push({
        from: at,
        to: at + length + 1,
        text: candidate,
        reading: entry.reading,
        cost: entry.cost,
        readingCost: entry.cost + READING_CHARGE,
        isProperNoun: entry.isProperNoun,
        partOfSpeech: entry.partOfSpeech,
        isKnown: true,
      });
    }
  }

  return edges;
}

/**
 * The single-character edges leaving a position, one per known reading.
 *
 * Always present, whatever words also start here. Two things depend on that:
 * every position has an outgoing edge, so the lattice is always traversable;
 * and a polyphone offers all of its readings at every position, so scoring has
 * something to choose between rather than only what the word list happens to
 * cover.
 */
export function characterEdgesAt(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): readonly LatticeEdge[] {
  /* c8 ignore next -- callers only ask about positions inside the run */
  const character = characters[at] ?? "";
  const entry = dictionary.lookup(character);

  if (entry === undefined) {
    // A character with no entry at all: keep it, unread, so that the text still
    // round-trips and the failure is visible rather than silent.
    return [
      {
        from: at,
        to: at + 1,
        text: character,
        reading: [],
        cost: UNKNOWN_COST,
        readingCost: UNKNOWN_COST + READING_CHARGE,
        isProperNoun: false,
        partOfSpeech: "",
        isKnown: false,
      },
    ];
  }

  return dictionary.readingsOf(character).map((reading, rank) => ({
    from: at,
    to: at + 1,
    text: character,
    reading,
    cost: entry.cost + rank * ALTERNATE_PENALTY,
    readingCost: entry.cost + rank * ALTERNATE_PENALTY + READING_CHARGE,
    isProperNoun: entry.isProperNoun,
    partOfSpeech: entry.partOfSpeech,
    isKnown: true,
  }));
}
