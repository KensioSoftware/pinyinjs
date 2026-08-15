/**
 * The readings the entry blob holds, short of decoding a whole entry.
 *
 * Three questions that all stop at the reading columns: what one key is read
 * as, what every key is read as, and what else a character can be read as. None
 * of them wants the other four columns, and the first two never leave the
 * string level at all — which is what makes a pass over all 723,147 keys
 * affordable at load time, and what keeps the entry decoder out of this path.
 */
import type { Syllable } from "../syllable/syllable.js";
import { decodeReading } from "./artifact.js";
import type { EntryLines } from "./entry-lines.js";
import type { KeyIndex } from "./key-index.js";

const ALTERNATE = ",";

/**
 * The stored reading of a key, or undefined when it is not a key.
 *
 * Read from the blob without decoding the rest of the line, since deriving a
 * word's reading needs its characters' readings and nothing else about them.
 */
export function storedReadingOf(
  index: KeyIndex,
  lines: EntryLines,
  word: string,
): string | undefined {
  const found = index.lookup(word);
  return found.isKey ? (lines.columnsAt(found.index)[0] ?? "") : undefined;
}

/**
 * The other readings recorded on a line, after the one the entry names.
 *
 * The lattice needs these for its single-character fallback edges: 行 has to
 * offer `xíng`, `háng` and `héng` at a position no word covers.
 */
export function alternateReadings(
  lines: EntryLines,
  at: number,
): readonly (readonly Syllable[])[] {
  return (lines.columnsAt(at)[4] ?? "")
    .split(ALTERNATE)
    .map((text) => decodeReading(text))
    .filter((reading) => reading !== undefined);
}

/**
 * The lowest code unit that begins a surrogate pair.
 */
const HIGH_SURROGATE = 0x1_00_00;

/**
 * Whether a key is written with exactly one character, without allocating.
 *
 * Asked of every key in the dictionary when {@link readingsCursor} gathers the
 * character defaults, which is where splitting each key into characters would
 * cost an array per key for an answer that is a length check.
 */
function isOneCharacter(key: string): boolean {
  if (key.length === 1) {
    return true;
  }
  return key.length === 2 && (key.codePointAt(0) ?? 0) >= HIGH_SURROGATE;
}

/**
 * A word's reading, joined from its characters' default readings.
 *
 * Walked by code point rather than split into characters first, for the same
 * reason as {@link isOneCharacter}: this runs over every key in the dictionary
 * three times during a reverse index build, and the array `toCharacters`
 * allocates per key is 20% of it.
 *
 * Returns the empty string where any character has no default, which is what a
 * tier missing a character would look like. No tier does: `selectTier` never
 * drops a character some word is written with.
 */
function derivedReading(
  key: string,
  defaults: ReadonlyMap<string, string>,
): string {
  let joined = "";
  let at = 0;
  while (at < key.length) {
    const width = (key.codePointAt(at) ?? 0) >= HIGH_SURROGATE ? 2 : 1;
    const value = defaults.get(key.slice(at, at + width));
    if (value === undefined) {
      return "";
    }
    joined = joined === "" ? value : `${joined} ${value}`;
    at += width;
  }
  return joined;
}

/**
 * Every key's reading, in key order, at the string level.
 *
 * The seam a second index over the same artifact is built through.
 *
 * Handed out as a cursor rather than as an array because the array is 39 MB on
 * the full tier. What the cursor holds instead is the character defaults a
 * derived reading is assembled from, and dropping it releases them.
 */
export interface DictionaryReadings {
  /** How many positions there are, which is the dictionary's own size. */
  readonly size: number;
  /**
   * The reading at a position, in the artifact's tone-numbered spelling.
   *
   * Empty where the position is out of range, or where a character the word is
   * written with is not itself a key.
   */
  readonly readingAt: (at: number) => string;
}

/**
 * A cursor over every key's reading, in key order.
 *
 * Two passes, mirroring `readArtifact`: the character defaults are gathered
 * first, because 83.25% of the full tier's keys store no reading and mean "the
 * characters' defaults, in order". Holding the cursor holds those defaults, so
 * build what needs it, use it, and let it go.
 */
export function readingsCursor(
  index: KeyIndex,
  lines: EntryLines,
): DictionaryReadings {
  const defaults = new Map<string, string>();
  for (let at = 0; at < index.size; at++) {
    const key = index.keyAt(at);
    const reading = isOneCharacter(key) ? lines.readingColumnAt(at) : "";
    if (reading !== "") {
      defaults.set(key, reading);
    }
  }

  return {
    size: index.size,
    readingAt: (at: number): string => {
      const stored = lines.readingColumnAt(at);
      return stored === "" ? derivedReading(index.keyAt(at), defaults) : stored;
    },
  };
}
