/**
 * The artifact's on-disk format: its separators, its flags, and how a reading
 * is written as one field.
 *
 * Both halves of `artifact.ts` — writing the file and reading it back — are
 * held to the same answers here, which is what stops the two drifting apart.
 */
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * Separator between a line's columns.
 */
export const COLUMN = "\t";

/**
 * Separator between lines, matching the key index's own separator.
 */
export const LINE = "\n";

/**
 * Separator between the alternate readings of a character.
 */
export const ALTERNATE = ",";

/**
 * The flag marking a proper noun.
 */
export const PROPER_NOUN_FLAG = "p";

/**
 * Where a proper name divides, written after the proper-noun flag.
 *
 * `p` alone is a proper noun whose parts CC-CEDICT does not divide; `p1` is one
 * that divides after the first character, `p2.4` after the second and fourth.
 * The positions are decimal and dot-separated rather than one digit each,
 * because the longest word carrying any is 19 characters.
 *
 * It rides in the flags column rather than taking a column of its own because
 * it is only ever present on a proper noun, and only 8,205 of 723,139 keys
 * carry one — a sixth column would cost a separator on every line to say
 * nothing on almost all of them. *
 * `security/detect-unsafe-regex` flags the nested quantifier, and there is no
 * ambiguity behind it: a literal `.` separates `\d+` from `(?:\.\d+)*`, so no
 * input can be split between them two ways. Timed on a string of digits and
 * dots that cannot match, it is linear — 8k to 128k characters doubles the time
 * for each doubling of the input, 39µs to 607µs.
 */
export const NAME_BOUNDARIES = /^p(?<at>\d+(?:\.\d+)*)$/u;

export const BOUNDARY_SEPARATOR = ".";

/**
 * The boundaries a flags column states, empty where it states none.
 */
export function nameBoundariesIn(flags: string): readonly number[] {
  const at = NAME_BOUNDARIES.exec(flags)?.groups?.["at"];
  return at === undefined ? [] : at.split(BOUNDARY_SEPARATOR).map(Number);
}

/**
 * A compiled dictionary, in the form it is written to disk and read back.
 *
 * Three parallel pieces, all indexed by the same position: search `keys` for a
 * word, and the line at that position in `entries` describes it. Nothing is
 * parsed on load beyond scanning for separators — see BROWSER.md, where the
 * measurement behind that choice is recorded.
 */
export interface DictionaryArtifact {
  /** Sorted keys, newline-joined: the {@link KeyIndex} blob. */
  readonly keys: string;
  /** One line per key, in key order. */
  readonly entries: string;
  /** Quantised frequencies, packed two per byte. */
  readonly frequencies: Uint8Array;
}

/**
 * Write a reading in tone-numbered notation.
 *
 * Numbered rather than tone-marked because it is ASCII, so it survives any
 * encoding, and because the tone is then a character rather than a combining
 * mark that normalisation could move.
 */
export function encodeReading(syllables: readonly Syllable[]): string {
  return syllables
    .map((syllable) => writeSyllable(syllable, "numbers"))
    .join(" ");
}

/**
 * Read a reading back, or return undefined if any syllable is malformed.
 */
export function decodeReading(text: string): readonly Syllable[] | undefined {
  if (text === "") {
    return undefined;
  }
  const syllables = text.split(" ").map((token) => readSyllable(token));
  return syllables.includes(undefined)
    ? undefined
    : (syllables as readonly Syllable[]);
}

/**
 * Order two keys the way {@link KeyIndex} requires them: by UTF-16 code unit.
 */
export function byCodeUnit(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * Every 繁體 spelling an entry claims a key for.
 */
export function traditionalForms(entry: DictionaryEntry): readonly string[] {
  return [entry.hant, ...(entry.hantVariants ?? [])];
}
