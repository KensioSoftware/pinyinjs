/**
 * What one run's search reads once and then remembers.
 *
 * The questions `segment-run.ts` asks of a candidate piece, and how long a
 * piece can be worth asking about at all.
 */
import { countToneMarks } from "../tone/tone-mark.js";
import { ATTESTED_SYLLABLES, DICTIONARY_SYLLABLES } from "./inventory.js";
import { isSeparableStart } from "./separation.js";
import {
  normaliseUmlaut,
  readSyllable,
  type Syllable,
  writeSyllable,
  writeSyllableSpelling,
} from "./syllable.js";

/**
 * How long a written syllable can be, and so how far ahead a reading looks.
 *
 * The longest spelling in the inventory is `zhuang` at six letters, and the
 * rest is what hangs off one: the r of 儿化, a tone digit or the raised form of
 * it, `u:` where ü is typed that way, and a combining mark where the input
 * arrives decomposed. Two of those cannot both be there, which leaves the
 * longest piece worth reading two characters short of this.
 */
export const LONGEST_SYLLABLE =
  Math.max(...[...ATTESTED_SYLLABLES].map((spelling) => spelling.length)) + 4;

/**
 * Whether a syllable is one Mandarin actually uses.
 *
 * {@link readSyllable} asks only whether an initial and a final can be put
 * together, which is a wider question: `tia` passes it and is not a syllable of
 * the language. The 儿化 suffix is set aside before the check, since the
 * inventory lists base syllables and `wanr` is `wan` with an r on it.
 */
function isAttestedSyllable(syllable: Syllable): boolean {
  return DICTIONARY_SYLLABLES.has(
    writeSyllableSpelling({ ...syllable, erhua: false }),
  );
}

/**
 * Whether a spelling writes its tone mark where the orthography puts it.
 *
 * `xīa` reads as x + ia in the first tone, which pinyin writes `xiā`, so the
 * mark sits a letter early. Read on its own that is a slip worth tolerating,
 * and {@link readSyllable} tolerates it. Inside a longer run it is also what
 * two syllables written without a boundary look like, `xīan1` being 西安 half
 * typed, and the search weighs the two readings by what they cost.
 */
function isWellMarked(spelling: string, syllable: Syllable): boolean {
  return (
    countToneMarks(spelling) === 0 ||
    writeSyllable(syllable) ===
      normaliseUmlaut(spelling).normalize("NFC").toLowerCase()
  );
}

/**
 * What the two passes over a run share.
 *
 * Both try the same pieces, and reading one costs a Unicode normalisation and
 * a walk through the tables, so each piece is read once and remembered.
 * `marksBefore` counts the tone marks in front of every position, which turns
 * counting the marks on a piece into a subtraction, and `isSeparableAt` says
 * of every position whether a syllable starting there would need an apostrophe
 * before it.
 */
export interface RunTables {
  readonly marksBefore: readonly number[];
  readonly isSeparableAt: readonly boolean[];
  readonly syllables: Map<string, Syllable | undefined>;
  readonly wellMarked: Map<string, boolean>;
  readonly attested: Map<string, boolean>;
}

/**
 * The tables for one run, read off its characters in a single pass.
 */
export function tablesFor(run: string): RunTables {
  const marksBefore: number[] = [0];
  const isSeparableAt: boolean[] = [];
  let marks = 0;
  for (let at = 0; at < run.length; at++) {
    const character = run.charAt(at);
    marks += countToneMarks(character);
    marksBefore.push(marks);
    isSeparableAt.push(isSeparableStart(character));
  }
  return {
    marksBefore,
    isSeparableAt,
    syllables: new Map(),
    wellMarked: new Map(),
    attested: new Map(),
  };
}

/**
 * Read a piece of the run as a syllable, remembering what it read.
 */
export function readPiece(
  tables: RunTables,
  piece: string,
): Syllable | undefined {
  const read = tables.syllables.get(piece);
  if (read !== undefined || tables.syllables.has(piece)) {
    return read;
  }
  const syllable = readSyllable(piece);
  tables.syllables.set(piece, syllable);
  return syllable;
}

/**
 * Whether a piece is a syllable of the language, remembering the answer.
 */
export function isPieceAttested(
  tables: RunTables,
  piece: string,
  syllable: Syllable,
): boolean {
  const known = tables.attested.get(piece);
  if (known !== undefined) {
    return known;
  }
  const attested = isAttestedSyllable(syllable);
  tables.attested.set(piece, attested);
  return attested;
}

/**
 * Whether a piece writes its tone mark in place, remembering the answer.
 */
export function isPieceWellMarked(
  tables: RunTables,
  piece: string,
  syllable: Syllable,
): boolean {
  const known = tables.wellMarked.get(piece);
  if (known !== undefined) {
    return known;
  }
  const wellMarked = isWellMarked(piece, syllable);
  tables.wellMarked.set(piece, wellMarked);
  return wellMarked;
}
