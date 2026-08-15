import type { Dictionary } from "../dictionary/dictionary.js";
import { isSameReading } from "../dictionary/entry.js";
import { isErCharacter, withErhua } from "../dictionary/erhua.js";
import { toCharacters } from "../script/characters.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  normaliseQuery,
  type QueryChunk,
  readQueryChunks,
  skipSeparators,
} from "./query.js";
import {
  type Candidate,
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

export type { MatchRange } from "./match-scoring.js";

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
class Search {
  readonly #dictionary: Dictionary;
  readonly #haystack: string;
  readonly #characters: readonly string[];
  readonly #query: string;
  readonly #readings: (readonly (readonly Syllable[])[])[] = [];
  readonly #paths = new Map<string, Path | undefined>();

  constructor(dictionary: Dictionary, haystack: string, query: string) {
    this.#dictionary = dictionary;
    this.#haystack = haystack;
    this.#characters = toCharacters(haystack);
    this.#query = query;
  }

  /**
   * Every reading a character offers, likeliest first, asked for once.
   *
   * Canonicalised here rather than left to the dictionary, so that a Hong Kong
   * glyph form is matched by the readings of the Taiwan-standard key it folds
   * to rather than by nothing.
   *
   * The 國語 reading goes on the end where it differs, so that 圾 answers to
   * `se` as well as to `ji`. A search box is not the place to insist on one
   * standard: somebody typing what they say is not typing it wrongly, and the
   * decoder's own reading is what ranks the two afterwards.
   */
  #readingsAt(at: number): readonly (readonly Syllable[])[] {
    const held = this.#readings[at];
    if (held !== undefined) {
      return held;
    }
    /* c8 ignore next -- only ever asked about a character that is there */
    const character = toCanonicalGlyphs(this.#characters[at] ?? "");
    const found = this.#dictionary.readingsOf(character);
    const taiwan = this.#dictionary.lookup(character)?.taiwanReading;
    const readings =
      taiwan === undefined ||
      found.some((reading) => isSameReading(reading, taiwan))
        ? found
        : [...found, taiwan];
    this.#readings[at] = readings;
    return readings;
  }

  /**
   * Every reading the query could be accounting for at a character.
   *
   * One per reading the character has — and one more for each of them where an
   * 儿 follows, carrying the r suffix that character stands for. 玩儿 is
   * `wánr`, one syllable over two characters, and somebody looking for it types
   * `wanr`: the r is part of how the word is said, so it is part of how the
   * word is searched for.
   *
   * Offered wherever an 儿 follows rather than only where the dictionary
   * attests the 儿化, because the query is what decides which of them was
   * meant. 女儿 is `nǚ'ér` and not `nǚr`, and typing `nvr` still finds it —
   * below `nver`, since the reading the text takes is what ranks them.
   */
  #candidatesAt(at: number): readonly Candidate[] {
    const readings = this.#readingsAt(at);
    const plain = readings.map((reading, rank) => ({
      reading,
      rank,
      characters: 1,
    }));
    if (!isErCharacter(this.#characters[at + 1] ?? "")) {
      return plain;
    }
    return [
      ...plain,
      ...readings.flatMap((reading, rank) => {
        const last = reading.at(-1);
        /* c8 ignore next 3 -- a stored reading is never empty or already r-ed */
        if (last === undefined || last.erhua === true) {
          return [];
        }
        return [
          {
            reading: [...reading.slice(0, -1), withErhua(last)],
            rank,
            characters: 2,
          },
        ];
      }),
    ];
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
    const candidates = this.#candidatesAt(at);
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
      if (this.#readingsAt(at).length === 0) {
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

/**
 * Find where a pinyin query matches a Chinese text, for filtering and
 * highlighting.
 *
 * ```ts
 * match(dictionary, "北京大学", "bjdx")?.ranges; // [{ at: 0, length: 4 }]
 * ```
 *
 * The query is what somebody types on a Latin keyboard with no Chinese input
 * method in front of them: full syllables joined or spaced, `beijing` and
 * `bei jing`; initials, `bj`; the two mixed, `beij` and `bjing`; tones as
 * digits where they are worth writing, `bei3jing1`; and `v` or `u:` for ü.
 * Returns undefined where none of it matches.
 *
 * **No index is built and none is needed.** The haystack is Chinese, so the
 * query is tested as a path over each character's readings rather than the text
 * being spelled out in advance and searched — which is what makes every reading
 * of a polyphone matchable rather than whichever one a default table picked.
 * 行 is found by `xing` and by `hang`, and 长江 by `cj` as well as by `zj`.
 *
 * The reading the decoder settles on in context is then what ranks them, so the
 * one that reads correctly here sorts above the one that merely could:
 *
 * ```ts
 * const scoreOf = (query: string) => match(dictionary, "银行", query)?.score;
 * scoreOf("yh") > scoreOf("yx"); // true — 银行 is yínháng, not yínxíng
 * ```
 *
 * Ranges rather than a boolean, so that a caller can mark what matched, in code
 * points from the start of the text. Everything this needs is in the `core`
 * dictionary, so a page that never loads a word list can still do it.
 */
export function match(
  dictionary: Dictionary,
  haystack: string,
  query: string,
): PinyinMatch | undefined {
  const normalised = normaliseQuery(query);
  if (normalised === "" || haystack === "") {
    return undefined;
  }
  return new Search(dictionary, haystack, normalised).best();
}
