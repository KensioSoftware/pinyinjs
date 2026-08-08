import { toCharacters } from "../script/characters.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  type Lattice,
  type LatticeEdge,
  READING_CHARGE,
  UNKNOWN_COST,
} from "./lattice.js";

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
  /** The reading that character takes. */
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
  /** Positional hints, by code-point index into the text. */
  readonly at: ReadonlyMap<number, readonly Syllable[]>;
}

/**
 * One word hint, with its characters and reading already taken apart.
 */
interface WordHint {
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
  const at = new Map<number, readonly Syllable[]>();

  for (const hint of list) {
    if (isPositional(hint)) {
      if (!Number.isInteger(hint.at) || hint.at < 0) {
        throw new Error(`reading hint position is not an index: ${hint.at}`);
      }
      at.set(
        hint.at,
        readHintReading(hint.reading, `position ${String(hint.at)}`),
      );
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

/**
 * The same hints with every position moved along by an offset.
 *
 * Word hints match on what is written and so are carried over untouched; only
 * the positional ones are counted from somewhere. Used where a run is decoded
 * with context in front of it, which moves the run's own characters up the
 * lattice by the length of that context.
 */
export function shiftHints(hints: ResolvedHints, by: number): ResolvedHints {
  return {
    words: hints.words,
    at: new Map([...hints.at].map(([at, reading]) => [at + by, reading])),
  };
}

/**
 * The hints that fall inside a run, with their positions made relative to it.
 *
 * A caller counts positions from the start of the whole text, while a run is
 * decoded on its own, so the positions have to be moved to where the run put
 * them — and the ones naming a character in some other run dropped, rather than
 * landing on whatever happens to sit at that index here.
 */
export function hintsWithin(
  hints: ResolvedHints,
  from: number,
  length: number,
): ResolvedHints {
  const at = new Map<number, readonly Syllable[]>();
  for (const [position, reading] of hints.at) {
    if (position >= from && position < from + length) {
      at.set(position - from, reading);
    }
  }
  return { words: hints.words, at };
}

/**
 * Whether a hint's characters are what stands at a position.
 */
function matchesAt(
  hint: WordHint,
  characters: readonly string[],
  at: number,
): boolean {
  return hint.characters.every(
    (character, index) => characters[at + index] === character,
  );
}

/**
 * A caller's readings, put into a lattice that was built without them.
 *
 * Two kinds of hint with deliberately different reach, which is the whole of
 * the semantics:
 *
 * A **word** hint is an assertion about the text it names, so it rewrites the
 * edge spanning exactly those characters and supplies the single-character
 * edges underneath it. It says nothing about a *longer* word that happens to
 * contain it — a bare 长 hint leaves 校长 as `xiàozhǎng`, because the dictionary
 * knowing 校长 is better evidence about that stretch than a caller's remark
 * about one of its characters. That is what makes a corrections table safe to
 * accumulate: entries do not reach into words nobody was thinking about.
 *
 * A **positional** hint is an assertion about one character of one text, and it
 * is the escape hatch precisely because nothing outranks it: it rewrites every
 * edge covering that position, the enclosing word included. Only a reading of
 * one syllable per character can be rewritten this way; a 儿化 edge is a single
 * claim about its whole span and there is no one syllable in it to replace.
 *
 * Nothing is invented that a caller did not write, and nothing is dropped: an
 * edge whose reading no hint touches comes through as it was.
 */
export function applyHints(lattice: Lattice, hints: ResolvedHints): Lattice {
  const { characters } = lattice;

  /** The word hint covering a position, and how far into it that position is. */
  const wordAt = (at: number): { hint: WordHint; held: number } | undefined => {
    for (const hint of hints.words) {
      if (hint.reading.length !== hint.characters.length) {
        continue;
      }
      for (let held = 0; held < hint.characters.length; held++) {
        if (at - held >= 0 && matchesAt(hint, characters, at - held)) {
          return { hint, held };
        }
      }
    }
    return undefined;
  };

  const rewrite = (edge: LatticeEdge): LatticeEdge => {
    const span = edge.to - edge.from;

    // A word hint naming exactly this stretch replaces its reading outright,
    // which is the only way a hint can reach a word the dictionary already has
    // an opinion about: 银行 asserted as `yín xíng` has to beat `yínháng`.
    const exact = hints.words.find(
      (hint) =>
        hint.characters.length === span &&
        matchesAt(hint, characters, edge.from),
    );
    let reading = exact === undefined ? edge.reading : exact.reading;

    // Everything below needs one syllable per character to have a syllable to
    // put anywhere.
    if (reading.length === span) {
      reading = reading.map((syllable, index) => {
        const at = edge.from + index;
        const positional = hints.at.get(at);
        if (positional?.length === 1 && positional[0] !== undefined) {
          return positional[0];
        }
        if (span > 1) {
          return syllable;
        }
        // Single-character edges also take what a longer word hint says about
        // this position, so that the split path reads the same as the whole.
        const found = wordAt(at);
        return found?.hint.reading[found.held] ?? syllable;
      });
    }

    return reading === edge.reading ? edge : { ...edge, reading };
  };

  return {
    characters,
    edges: lattice.edges.map((edges, at) => {
      const rewritten = edges.map((edge) => rewrite(edge));
      // A hint spanning characters no edge covers has nowhere to be written, so
      // it brings its own edge: 玩儿 as `wánr` where the dictionary lacks it.
      const spanning = hints.words.find(
        (hint) =>
          hint.reading.length !== hint.characters.length &&
          matchesAt(hint, characters, at) &&
          !rewritten.some((edge) => edge.to === at + hint.characters.length),
      );
      if (spanning === undefined) {
        return rewritten;
      }
      const to = at + spanning.characters.length;
      return [
        ...rewritten,
        {
          from: at,
          to,
          text: spanning.characters.join(""),
          reading: spanning.reading,
          cost: UNKNOWN_COST,
          readingCost: UNKNOWN_COST + READING_CHARGE,
          isProperNoun: false,
          partOfSpeech: "",
          isKnown: true,
        },
      ];
    }),
  };
}
