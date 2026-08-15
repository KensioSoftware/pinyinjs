/**
 * Walking a query over a haystack.
 *
 * The search is a walk over two sequences at once — the haystack's characters
 * and the query's letters — where each character may account for some of the
 * query in more than one way. `match.ts` is the one call that starts it.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import { chunksFor } from "./match-chunks.js";
import { bestMatch, type PinyinMatch } from "./match-ranking.js";
import { CharacterReadings } from "./match-readings.js";
import { skipSeparators } from "./query.js";
import {
  COMPLETE,
  CROSSED,
  type Path,
  RARE_READING,
  SPELLED_OUT,
} from "./match-scoring.js";

export type { PinyinMatch } from "./match-ranking.js";

/**
 * One query being read over one haystack.
 *
 * The search is a walk over two sequences at once — the haystack's characters
 * and the query's letters — where each character may account for some of the
 * query in more than one way, since it may have more than one reading and each
 * reading may be written out or abbreviated. Memoised on the pair of positions,
 * which is what stops the ways of splitting a long query multiplying out.
 */
export class Search {
  readonly #dictionary: Dictionary;
  readonly #haystack: string;
  readonly #characters: readonly string[];
  readonly #query: string;
  readonly #readings: CharacterReadings;
  readonly #paths = new Map<string, Path | undefined>();

  constructor(dictionary: Dictionary, haystack: string, query: string) {
    this.#dictionary = dictionary;
    this.#haystack = haystack;
    this.#characters = toCharacters(haystack);
    this.#readings = new CharacterReadings(dictionary, this.#characters);
    this.#query = query;
  }

  /**
   * The best way of reading the rest of the query from a character, or nothing.
   */
  #from(at: number, offset: number): Path | undefined {
    const start = skipSeparators(this.#query, offset);
    if (start === this.#query.length) {
      return COMPLETE;
    }
    if (at >= this.#characters.length) {
      return undefined;
    }
    const key = `${String(at)}:${String(start)}`;
    const held = this.#paths.get(key);
    if (held !== undefined || this.#paths.has(key)) {
      return held;
    }
    const found = this.#read(at, start);
    this.#paths.set(key, found);
    return found;
  }

  /**
   * Read one character, every way it can be read, and keep the best.
   */
  #read(at: number, start: number): Path | undefined {
    const candidates = this.#readings.candidatesAt(at);
    if (candidates.length === 0) {
      return this.#cross(at, start);
    }

    let best: Path | undefined;
    for (const candidate of candidates) {
      for (const chunk of chunksFor(this.#query, start, candidate.reading)) {
        const rest = this.#from(at + candidate.characters, chunk.next);
        if (rest === undefined) {
          continue;
        }
        const score =
          rest.score +
          (chunk.isFull ? SPELLED_OUT * candidate.characters : 0) -
          candidate.rank * RARE_READING;
        if (best === undefined || score > best.score) {
          best = {
            steps: [
              ...Array.from({ length: candidate.characters }, (_, covered) => ({
                at: at + covered,
                isRead: true,
                from: start,
                next: chunk.next,
              })),
              ...rest.steps,
            ],
            score,
          };
        }
      }
    }
    return best;
  }

  /**
   * Step over a character with no reading, which a match may span but not end
   * on: the query is checked for having been read to its end first.
   */
  #cross(at: number, start: number): Path | undefined {
    const rest = this.#from(at + 1, start);
    return rest === undefined
      ? undefined
      : {
          steps: [
            { at, isRead: false, from: start, next: start },
            ...rest.steps,
          ],
          score: rest.score - CROSSED,
        };
  }

  /**
   * Where the query matches at all, and how it reads at each of those places.
   */
  #everyMatch(): readonly Path[] {
    const found: Path[] = [];
    for (const [at] of this.#characters.entries()) {
      if (this.#readings.at(at).length === 0) {
        continue;
      }
      const path = this.#from(at, 0);
      if (path !== undefined) {
        found.push(path);
      }
    }
    return found;
  }

  /**
   * The best match, or undefined where the query matches nowhere.
   */
  best(): PinyinMatch | undefined {
    const found = this.#everyMatch();
    return found.length === 0
      ? undefined
      : bestMatch(this.#dictionary, this.#haystack, this.#query, found);
  }
}
