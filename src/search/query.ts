import {
  normaliseUmlaut,
  type Syllable,
  writeSyllableSpelling,
} from "../syllable/syllable.js";
import { stripToneMarks } from "../tone/tone-mark.js";
import { toneFromNotation } from "../tone/tone.js";

/**
 * What a query may write between syllables.
 *
 * Whitespace is what anybody types; the apostrophe is the 隔音符号 and the
 * hyphen is what a 成语 or a reduplicated word is written with, so both arrive
 * in a query pasted from written pinyin rather than typed.
 */
const QUERY_SEPARATORS = /[\s'’‘-]+/gu;

/**
 * The one separator a normalised query is written with.
 */
const SEPARATOR = " ";

const TONE_DIGIT = /^[0-5]$/u;

/**
 * Put a typed query into the one form the matcher reads.
 *
 * Case is dropped, every separator becomes a single space, and the `v` and `u:`
 * conventions become ü — all three are ways of writing the same query, and
 * folding them here is what keeps the matcher itself about syllables.
 *
 * **A tone written as a mark is dropped rather than honoured.** Constraining a
 * match by tone needs to know where the syllable the mark sits inside ends, and
 * a query is exactly the text where that is not yet known: `bei` may still
 * become `beijing`. A tone written as a digit says where the syllable ends by
 * being there at all, so that one is honoured — see {@link readQueryChunks}.
 */
export function normaliseQuery(query: string): string {
  return normaliseUmlaut(stripToneMarks(query.normalize("NFC").toLowerCase()))
    .replaceAll(QUERY_SEPARATORS, SEPARATOR)
    .trim();
}

/**
 * Step over any separators at a position, which fall between syllables.
 */
export function skipSeparators(query: string, at: number): number {
  let next = at;
  while (query[next] === SEPARATOR) {
    next++;
  }
  return next;
}

/**
 * One way a query can account for one syllable.
 */
export interface QueryChunk {
  /** Where the query has been read up to, once this chunk is taken. */
  readonly next: number;
  /** Whether the syllable was written out in full, rather than abbreviated. */
  readonly isFull: boolean;
}

/**
 * How a syllable may be abbreviated in a query.
 *
 * The first letter is the abbreviation everybody means by "initials only" —
 * 北京 is `bj` and 西安 is `xa`, which is why this is taken from the spelling
 * rather than from {@link Syllable.initial}: 安 has no initial and is still
 * typed `a`. The initial itself is offered alongside it so that a retroflex
 * keeps its h — 中文 is `zw` to one typist and `zhw` to another.
 */
function abbreviationsOf(
  syllable: Syllable,
  spelling: string,
): readonly string[] {
  const first = spelling.slice(0, 1);
  const { initial } = syllable;
  return [first, initial].filter(
    (abbreviation, at, all) =>
      abbreviation !== "" &&
      abbreviation.length < spelling.length &&
      all.indexOf(abbreviation) === at,
  );
}

/**
 * Every way the query at a position can account for one syllable.
 *
 * Three forms, which between them are every way a syllable gets typed:
 *
 * - written out in full, `bei`, optionally with the tone as a digit, `bei3`,
 *   which matches only where the reading carries that tone;
 * - abbreviated to its initial, `b`, which is what a query of initials is;
 * - cut short by the query simply ending, `bei` against `běijīng` — anything
 *   the syllable starts with, so that a search box still matches while the
 *   query is being typed.
 *
 * The third is confined to the end of the query on purpose. A part-syllable in
 * the middle would let `bejing` through as `be` + `jing`, which is a typo
 * rather than an abbreviation, and nothing in front of a search box means it.
 *
 * Returns one chunk per distinct position the query can be read up to, since
 * the forms overlap: `b` is both an initial and the whole of what is left.
 */
export function readQueryChunks(
  query: string,
  at: number,
  syllable: Syllable,
): readonly QueryChunk[] {
  const spelling = writeSyllableSpelling(syllable);
  const found = new Map<number, boolean>();

  /**
   * Note that the query can be read up to here, keeping the fuller reading of
   * the two where a position is reached both ways.
   */
  const take = (next: number, isFull: boolean): void => {
    found.set(next, (found.get(next) ?? false) || isFull);
  };

  if (query.startsWith(spelling, at)) {
    const after = at + spelling.length;
    const digit = query[after] ?? "";
    // A reading with no tone written cannot contradict one, and a few hundred
    // characters are stored that way: 西 is `xi`, with `xī` listed beside it.
    if (
      TONE_DIGIT.test(digit) &&
      (syllable.tone === undefined ||
        toneFromNotation(Number(digit)) === syllable.tone)
    ) {
      take(after + 1, true);
    }
    take(after, true);
  }

  for (const abbreviation of abbreviationsOf(syllable, spelling)) {
    if (query.startsWith(abbreviation, at)) {
      take(at + abbreviation.length, false);
    }
  }

  const tail = query.slice(at);
  if (
    tail !== "" &&
    tail.length < spelling.length &&
    spelling.startsWith(tail)
  ) {
    take(query.length, false);
  }

  return [...found].map(([next, isFull]) => ({ next, isFull }));
}
