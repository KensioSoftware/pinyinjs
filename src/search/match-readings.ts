/**
 * What a character in the haystack can be read as, asked once per position.
 *
 * Kept apart from the search itself because it is a different question: the
 * search asks how a query walks over a text, and this asks only what each
 * character offers it to walk on.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { isSameReading } from "../dictionary/entry.js";
import { isErCharacter, withErhua } from "../dictionary/erhua.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
import type { Syllable } from "../syllable/syllable.js";
import type { Candidate } from "./match-scoring.js";

export class CharacterReadings {
  readonly #dictionary: Dictionary;
  readonly #characters: readonly string[];
  readonly #readings: (readonly (readonly Syllable[])[])[] = [];

  constructor(dictionary: Dictionary, characters: readonly string[]) {
    this.#dictionary = dictionary;
    this.#characters = characters;
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
  at(at: number): readonly (readonly Syllable[])[] {
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
  candidatesAt(at: number): readonly Candidate[] {
    const readings = this.at(at);
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
}
