/**
 * Applying resolved hints to a lattice.
 *
 * Where `hints.ts` says what a caller asserted, this is what the decoder does
 * with it: shifting the positions to a run, finding which of them fall inside
 * one, and forcing the edges they name.
 */
import type { Syllable } from "../syllable/syllable.js";
import { type Lattice, type LatticeEdge, READING_CHARGE } from "./lattice.js";
import type { ResolvedHints, WordHint } from "./hints.js";

/**
 * What an edge a hint brought with it costs, in both decodes.
 *
 * Zero, because a caller naming a reading is the strongest evidence the decode
 * has. The other branch of {@link applyHints} says so already by overwriting a
 * dictionary entry's reading where a hint names the same stretch, and an edge
 * with no entry behind it has to say the same thing through its cost.
 *
 * It was {@link import("./lattice-types.js").UNKNOWN_COST} until
 * {@link READING_CHARGE} came down, which worked only while one edge beat two
 * whatever they cost: 玩儿 hinted as `wánr` went back to `wán ér` the moment
 * frequency could speak.
 */
const HINT_COST = 0;

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
    at: new Map([...hints.at].map(([at, syllable]) => [at + by, syllable])),
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
  const at = new Map<number, Syllable>();
  for (const [position, syllable] of hints.at) {
    if (position >= from && position < from + length) {
      at.set(position - from, syllable);
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
        if (positional !== undefined) {
          return positional;
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
          cost: HINT_COST,
          readingCost: HINT_COST + READING_CHARGE,
          isProperNoun: false,
          partOfSpeech: "",
          // No dictionary entry backs this one — that is the whole reason it
          // had to be brought along — so it reports itself as the fallback it
          // is. A hint written over an edge that *was* backed keeps that edge's
          // own answer, since the entry still covers those characters.
          isKnown: false,
        },
      ];
    }),
  };
}
