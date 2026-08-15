/**
 * Walking a query over a haystack.
 *
 * The search is a walk over two sequences at once — the haystack's characters
 * and the query's letters — where each character may account for some of the
 * query in more than one way. `match.ts` is the one call that starts it.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import { CharacterReadings } from "./match-readings.js";
import type { Syllable } from "../syllable/syllable.js";
import { type QueryChunk, readQueryChunks, skipSeparators } from "./query.js";
import {
  COMPLETE,
  CONTEXT_READING,
  contextOf,
  CROSSED,
  EARLINESS,
  type MatchRange,
  type Path,
  RARE_READING,
  rangesOf,
  SPELLED_OUT,
  type Step,
  WORD_START,
} from "./match-scoring.js";

/**
 * What a query matched, and how well.
 */
export interface PinyinMatch {
  /**
   * The stretches of the haystack the query spelled, in order.
   *
   * Usually one. There is more than one where the query ran over something
   * with no reading of its own: 北京·大学 is matched by `bjdx` as two ranges
   * with the separator between them left out, so that highlighting them marks
   * what was matched rather than what lay between.
   */
  readonly ranges: readonly MatchRange[];
  /**
   * How good the match is, where higher is better.
   *
   * For ordering the haystacks one query matched — sort descending and the
   * best is first. Comparable within a query and not across queries: what it
   * weighs is described at {@link CONTEXT_READING}, and none of it is a
   * probability.
   */
  readonly score: number;
}

/**
 * How much of a match was written the way the text is actually read.
 *
 * Asked of what the query wrote rather than of the reading the search happened
 * to take it by: 西 is stored with a neutral-toned `xi` and a first-tone `xī`,
 * and a query writing `xi` has picked neither of them over the other. What it
 * has done is write something the settled reading can account for, which is the
 * question — and the one `yx` over 银行 answers differently from `yh`.
 */
function agreementOf(
  query: string,
  steps: readonly Step[],
  preferred: readonly (Syllable | undefined)[],
): number {
  let comparable = 0;
  let agreeing = 0;
  for (const step of steps) {
    const settled = preferred[step.at];
    if (!step.isRead || settled === undefined) {
      continue;
    }
    comparable++;
    const written = readQueryChunks(query, step.from, settled);
    if (written.some((chunk) => chunk.next === step.next)) {
      agreeing++;
    }
  }
  return comparable === 0 ? 0 : agreeing / comparable;
}

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
   * Every position the query can be read up to by one whole reading.
   *
   * A reading is usually one syllable, and is not always: 瓩 is `qiānwǎ`, one
   * character read as two. The query accounts for them in order, and may run
   * out partway through, which is a query still being typed.
   */
  #chunksFor(
    from: number,
    reading: readonly Syllable[],
  ): readonly QueryChunk[] {
    let reached: readonly QueryChunk[] = [{ next: from, isFull: true }];
    for (const syllable of reading) {
      const found: QueryChunk[] = [];
      for (const chunk of reached) {
        const start = skipSeparators(this.#query, chunk.next);
        if (start === this.#query.length) {
          found.push({ next: start, isFull: chunk.isFull });
          continue;
        }
        for (const one of readQueryChunks(this.#query, start, syllable)) {
          found.push({
            next: one.next,
            isFull: chunk.isFull && one.isFull,
          });
        }
      }
      reached = found;
    }
    return reached;
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
      for (const chunk of this.#chunksFor(start, candidate.reading)) {
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
    if (found.length === 0) {
      return undefined;
    }

    const context = contextOf(this.#dictionary, this.#haystack);
    let best: PinyinMatch | undefined;
    for (const path of found) {
      const ranges = rangesOf(path.steps);
      /* c8 ignore next 3 -- a match always starts on a character it read */
      if (ranges[0] === undefined) {
        continue;
      }
      const start = ranges[0].at;
      const score =
        CONTEXT_READING *
          agreementOf(this.#query, path.steps, context.preferred) +
        (context.wordStarts.has(start) ? WORD_START : 0) +
        EARLINESS / (1 + start);
      // Strictly better, so that two matches worth the same keep the earlier.
      if (best === undefined || score > best.score) {
        best = { ranges, score };
      }
    }
    return best;
  }
}
