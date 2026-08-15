/**
 * The bopomofo symbols, and writing a syllable in them.
 *
 * `bopomofo.ts` reads by inverting these same tables, so the dependency runs
 * one way — nothing here knows how a string is parsed back.
 */
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  EMPTY_RHYME_INITIALS,
  ERHUA_SYMBOL,
  FINAL_PARTS,
  INITIAL_SYMBOLS,
  MEDIAL_SYMBOLS,
  RHYME_SYMBOLS,
  TONE_MARKS,
} from "./bopomofo-tables.js";

export {
  EMPTY_RHYME_INITIALS,
  ERHUA_SYMBOL,
  FINAL_PARTS,
  INITIAL_SYMBOLS,
  type Medial,
  MEDIAL_SYMBOLS,
  type Rhyme,
  RHYME_SYMBOLS,
  TONES_BY_MARK,
} from "./bopomofo-tables.js";

/**
 * How the first tone is written.
 *
 * Standard bopomofo leaves it unmarked, which is why `none` is the default. The
 * cost is that a syllable whose tone was never written comes back as a first
 * tone, since bopomofo has no way to say "no tone at all"; `mark` writes ˉ and
 * keeps the two apart.
 */
export interface BopomofoOptions {
  readonly firstTone?: "mark" | "none";
}

/**
 * Write a syllable in bopomofo: 就 jiù becomes ㄐㄧㄡˋ.
 *
 * Total over well-formed syllables — every initial and every final has a
 * symbol — so anything the syllable parser accepts can be written, including
 * the syllables no dictionary uses.
 */
export function writeBopomofo(
  syllable: Syllable,
  options: BopomofoOptions = {},
): string {
  const { initial, final, tone } = syllable;
  const [medial, rhyme] = FINAL_PARTS[final];
  const isEmptyRhyme = final === "i" && EMPTY_RHYME_INITIALS.has(initial);

  const written = [
    INITIAL_SYMBOLS.get(initial) ?? "",
    isEmptyRhyme ? "" : (MEDIAL_SYMBOLS.get(medial) ?? ""),
    isEmptyRhyme ? "" : (RHYME_SYMBOLS.get(rhyme) ?? ""),
  ].join("");
  const suffix = syllable.erhua === true ? ERHUA_SYMBOL : "";

  const mark = tone === undefined ? undefined : TONE_MARKS.get(tone);
  if (mark === undefined || (tone === 1 && options.firstTone !== "mark")) {
    return `${written}${suffix}`;
  }
  return tone === NEUTRAL_TONE
    ? `${mark}${written}${suffix}`
    : `${written}${mark}${suffix}`;
}

/**
 * Write a word in bopomofo, one syllable after another.
 *
 * Separated by spaces, as 教育部's dictionaries write them. A syllable boundary
 * is findable without the space — an initial symbol can only start one — but a
 * long unbroken run of symbols is hard to read, and the space costs nothing.
 */
export function writeBopomofoWord(
  syllables: readonly Syllable[],
  options: BopomofoOptions = {},
): string {
  return syllables
    .map((syllable) => writeBopomofo(syllable, options))
    .join(" ");
}
