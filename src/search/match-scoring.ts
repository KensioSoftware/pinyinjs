/**
 * What ranking a match costs, and what a match is made of.
 *
 * The weights, the shape of a partial match, and the one decode the ranking
 * leans on. `match.ts` searches; this says how the searching is scored.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { sourcesOf } from "../decode/convert.js";
import { segment } from "../decode/segment.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";

/**
 * A stretch of the haystack the query spelled out.
 */
export interface MatchRange {
  /**
   * Where it starts, in code points from the start of the haystack.
   *
   * Code points rather than UTF-16 units, exactly as `Segment.at` is, so that a
   * character outside the basic plane counts as the one character it is.
   */
  readonly at: number;
  /** How many characters it covers. */
  readonly length: number;
}

/**
 * What a match scores for reading its characters the way the text reads them.
 *
 * The one thing this has that a reverse index cannot: every reading a character
 * takes is matchable, so 行 is found by both `xing` and `hang` — and the decoder
 * has already settled which of them the text in front of it means. So 银行 ranks
 * `yh` above `yx`, and 长江 ranks `cj` above `zj`, without either being refused.
 *
 * Weighted by the share of the matched characters that agree, rather than by how
 * many, so that a long match and a short one are scored on the same scale.
 */
export const CONTEXT_READING = 4;

/**
 * What a match scores for starting where a word starts.
 *
 * 大学 in 北京大学 is the second half of a word a reader thinks of as one thing;
 * 大学 in 大学生 starts it. Both are matches and the second is the better one.
 */
export const WORD_START = 2;

/**
 * What a match at the very start of the haystack scores, decaying with position.
 *
 * A tie-break rather than a judgement, and deliberately smaller than
 * {@link WORD_START}: it settles two matches that are otherwise alike, and never
 * outranks starting a word.
 */
export const EARLINESS = 1;

/**
 * What one character scores for being written out in full rather than initialled.
 *
 * Only used to choose between the ways one query can be read over one haystack,
 * never in the score a caller sees: `beij` over 北京大学 is 北 spelled out and 京
 * initialled, and no other reading of it is on offer. Where two are — `xian` is
 * both 西安 and 县 — the fuller spelling is the one the typist meant.
 *
 * Per character, which is what settles 这儿 against `zher`: read as 这 `zhèr` it
 * spells two characters out at once, where 这 abbreviated to `zh` and 儿 as `er`
 * spells one of them and initials the other.
 */
export const SPELLED_OUT = 1;

/**
 * What one step down a character's reading list costs, likeliest reading first.
 *
 * The dictionary's own order, applied before the decoder has been asked
 * anything: it is what separates 行 `xíng` from 行 `hàng` when the query could
 * be either and the surrounding text says nothing.
 */
export const RARE_READING = 2;

/**
 * What crossing one character with no reading costs.
 *
 * A separator inside a name is worth stepping over — 北京·大学 is one thing
 * with a mark in the middle of it — and a query that steps over half a line of
 * Latin to reach its second half has found something more tenuous.
 */
export const CROSSED = 0.5;

/**
 * One character on the way through a match.
 *
 * What the query wrote for it is held as the stretch of the query it took
 * rather than as the reading it was taken by, because the question ranking asks
 * later is whether the reading the text settles on could have taken that same
 * stretch — and a character often offers two readings that would.
 */
export interface Step {
  readonly at: number;
  /** Whether the query spelled this character, rather than stepping over it. */
  readonly isRead: boolean;
  /** Where in the query this character's spelling starts. */
  readonly from: number;
  /** Where the query has been read up to once it is taken. */
  readonly next: number;
}

/**
 * One way of reading a query over a stretch of the haystack.
 */
export interface Path {
  readonly steps: readonly Step[];
  /** What choosing this way of reading it is worth; see {@link SPELLED_OUT}. */
  readonly score: number;
}

/**
 * The query having been read to its end, with nothing left to account for.
 */
export const COMPLETE: Path = { steps: [], score: 0 };

/**
 * One reading a character can be matched by, and how much it covers.
 */
export interface Candidate {
  readonly reading: readonly Syllable[];
  /** How far down the character's list of readings it is. */
  readonly rank: number;
  /** How many characters it reads: two only for 儿化. */
  readonly characters: number;
}

/**
 * What the decoder made of the haystack, for ranking rather than for matching.
 */
export interface Context {
  /**
   * The reading the decoder settled on for each character.
   *
   * A syllable covering two characters is recorded against both of them, which
   * is what 儿化 is: 玩儿 is `wánr`, and that one syllable is how the decoder
   * read the 玩 and the 儿 alike. Undefined where the alignment does not work
   * out at all.
   */
  readonly preferred: readonly (Syllable | undefined)[];
  /** Where each of the decoder's words starts, in code points. */
  readonly wordStarts: ReadonlySet<number>;
}

/**
 * The steps of a match, gathered into the stretches they cover.
 */
export function rangesOf(steps: readonly Step[]): readonly MatchRange[] {
  const ranges: MatchRange[] = [];
  for (const step of steps) {
    if (!step.isRead) {
      continue;
    }
    const last = ranges.at(-1);
    if (last !== undefined && last.at + last.length === step.at) {
      ranges[ranges.length - 1] = { at: last.at, length: last.length + 1 };
      continue;
    }
    ranges.push({ at: step.at, length: 1 });
  }
  return ranges;
}

/**
 * Ask the decoder what the haystack says, for the two things ranking needs.
 *
 * Worked out once a match is known to exist rather than before, because this is
 * a decode of the whole text and matching is not: a search box filtering a list
 * asks the cheap question of every item and pays for this on the few that hit.
 */
export function contextOf(dictionary: Dictionary, haystack: string): Context {
  const preferred: (Syllable | undefined)[] = [];
  const wordStarts = new Set<number>();
  for (const word of segment(dictionary, haystack)) {
    if (word.reading.length === 0) {
      continue;
    }
    wordStarts.add(word.at);
    // `sourcesOf` is the decoder's own answer to which characters a syllable
    // reads, 儿化 included. It names the whole word and then nothing where it
    // cannot say, which is not an alignment and is dropped rather than guessed.
    const sources = sourcesOf(word.text, word.reading).filter(
      (source) => source !== undefined,
    );
    if (sources.length !== word.reading.length) {
      continue;
    }
    let at = word.at;
    for (const [index, source] of sources.entries()) {
      for (const _ of toCharacters(source)) {
        preferred[at] = word.reading[index];
        at++;
      }
    }
  }
  return { preferred, wordStarts };
}
