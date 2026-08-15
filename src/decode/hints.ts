import { toCharacters } from "../script/characters.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";

/**
 * A reading a caller asserts for a word, wherever that word occurs.
 *
 * The same shape as the build-time override table
 * {@link import("../dictionary/overrides.js").READING_OVERRIDES}, because it is
 * the same idea moved from build time to call time: text on the left, the
 * reading it takes on the right.
 */
export interface WordReading {
  /** The characters this reading is asserted for. */
  readonly word: string;
  /** The reading, space-separated: `"tài cháng"`. */
  readonly reading: string;
}

/**
 * A reading a caller asserts for one character of one text.
 *
 * The escape hatch for a text no word-keyed hint can settle, which is a real
 * category rather than a hypothetical one: 孩子越长越漂亮 grows and
 * 头发越长越漂亮 lengthens, so the same four characters take different readings
 * and only the caller knows which was meant.
 */
export interface PositionalReading {
  /**
   * Which character, counted in code points from the start of the text.
   *
   * Code points rather than UTF-16 units, matching {@link toCharacters}, so
   * that a character outside the BMP counts as the one character it is.
   */
  readonly at: number;
  /** The reading that character takes, which is one syllable. */
  readonly reading: string;
}

/**
 * One reading a caller asserts, keyed either by the word or by the position.
 */
export type ReadingHint = WordReading | PositionalReading;

/**
 * Readings a caller asserts over whatever the sources say.
 *
 * Either a plain object of word to reading, which is the terse form for the
 * corrections table an application accumulates, or a list, which is what to
 * reach for when positions are needed or when both kinds are mixed.
 *
 * ```ts
 * convert(dictionary, text, { readings: { 太长: "tài cháng" } });
 * convert(dictionary, text, { readings: [{ at: 3, reading: "cháng" }] });
 * ```
 */
export type ReadingHints =
  | Readonly<Record<string, string>>
  | readonly ReadingHint[];

/**
 * A caller's hints, parsed and split by which kind they are.
 */
export interface ResolvedHints {
  /** Word hints, longest first, so a longer assertion wins a shared start. */
  readonly words: readonly WordHint[];
  /**
   * Positional hints, by code-point index into the text.
   *
   * One syllable rather than a reading, because a position names one character
   * and there is nowhere to put a second. {@link resolveHints} is what makes
   * that true, so nothing downstream has to check it.
   */
  readonly at: ReadonlyMap<number, Syllable>;
}

/**
 * One word hint, with its characters and reading already taken apart.
 */
export interface WordHint {
  readonly characters: readonly string[];
  readonly reading: readonly Syllable[];
}

/**
 * Whether a hint names a position rather than a word.
 */
function isPositional(hint: ReadingHint): hint is PositionalReading {
  return "at" in hint;
}

/**
 * Take a space-separated reading apart into syllables.
 *
 * An unmarked syllable is 轻声, as it is everywhere else in this package: a
 * caller writing `"dài fu"` means the neutral 夫 rather than an unknown tone.
 *
 * Throws rather than ignoring what it cannot read. A hint is a caller asserting
 * something against every source, so a hint that does not parse is a mistake in
 * the calling code, and silently converting as though it had not been given
 * would hide it behind a reading that merely looks plausible.
 */
export function readHintReading(
  reading: string,
  subject: string,
): readonly Syllable[] {
  const syllables = reading.split(/\s+/u).filter((token) => token !== "");
  if (syllables.length === 0) {
    throw new Error(`reading hint for ${subject} is empty`);
  }
  return syllables.map((token) => {
    const syllable = readSyllable(token);
    if (syllable === undefined) {
      throw new Error(`reading hint for ${subject} is not pinyin: ${token}`);
    }
    return { ...syllable, tone: syllable.tone ?? NEUTRAL_TONE };
  });
}

/**
 * Parse a caller's hints once, before any run is decoded.
 *
 * Word hints are sorted longest first so that a caller asserting both 长 and
 * 太长 gets the longer assertion where both match, which is the same
 * longest-wins rule the dictionary itself is read by.
 */
export function resolveHints(hints: ReadingHints): ResolvedHints {
  const list: readonly ReadingHint[] = Array.isArray(hints)
    ? hints
    : Object.entries(hints as Record<string, string>).map(
        ([word, reading]) => ({ word, reading }),
      );

  const words: WordHint[] = [];
  const at = new Map<number, Syllable>();

  for (const hint of list) {
    if (isPositional(hint)) {
      if (!Number.isInteger(hint.at) || hint.at < 0) {
        throw new Error(`reading hint position is not an index: ${hint.at}`);
      }
      const subject = `position ${String(hint.at)}`;
      const syllables = readHintReading(hint.reading, subject);
      // A position names one character. A reading of several syllables is a
      // caller meaning something else — most likely a word hint — and saying so
      // beats applying the first syllable or quietly applying none.
      if (syllables.length !== 1 || syllables[0] === undefined) {
        throw new Error(
          `reading hint for ${subject} is not one syllable: ${hint.reading}`,
        );
      }
      at.set(hint.at, syllables[0]);
      continue;
    }
    const characters = toCharacters(hint.word);
    if (characters.length === 0) {
      throw new Error("reading hint has no word");
    }
    words.push({
      characters,
      reading: readHintReading(hint.reading, hint.word),
    });
  }

  words.sort((left, right) => right.characters.length - left.characters.length);
  return { words, at };
}

export { applyHints, hintsWithin, shiftHints } from "./hint-lattice.js";
