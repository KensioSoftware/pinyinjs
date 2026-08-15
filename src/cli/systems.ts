/**
 * The romanisation systems, as a table the CLI can walk.
 *
 * Each entry takes apart a `write*Word` helper into the syllable write and the
 * separator it joins on, so that every syllable can be painted its own colour.
 * `commands.test.ts` holds the pair together over the whole inventory.
 */
import type { Syllable } from "../syllable/syllable.js";

export { BOPOMOFO, GWOYEU, IPA, WADE_GILES, YALE } from "./system-table.js";
import type { TranscriptionSource } from "./arguments.js";
import type { Painter } from "./colour.js";
import { BOPOMOFO, GWOYEU, IPA, WADE_GILES, YALE } from "./system-table.js";

/**
 * How one system writes a word: a syllable at a time, and what it joins on.
 *
 * The `write*Word` helpers are each a map and a join, and this takes them apart
 * so that every syllable can be painted its own colour. That duplicates five
 * separators, so each entry carries the helper it stands in for and
 * `commands.test.ts` asserts the two agree over the whole inventory in every
 * tone state — rather than the list being trusted.
 */
export interface System {
  /** What `--from` and `--system` call it. */
  readonly name: TranscriptionSource;
  readonly write: (syllable: Syllable) => string;
  readonly separator: string;
  /**
   * How the system writes a word, with its tones or without them.
   *
   * `--notation none` can only be honoured where the tone is written
   * separately*: Wade-Giles, Yale and IPA all have a way to leave it off.
   * Bopomofo marks it with a symbol of the script and Gwoyeu Romatzyh spells
   * it into the syllable, so for those two there is nothing to leave off and
   * the flag is ignored rather than approximated.
   */
  readonly word: (syllables: readonly Syllable[], hasTones: boolean) => string;
  /**
   * Whether the system writes the capitals the conversion settled.
   *
   * The three romanisations do, since a romanisation is a way of writing
   * Chinese in the Latin alphabet and inherits what that alphabet does with a
   * proper noun. IPA and bopomofo do not — see {@link toTranscription}.
   */
  readonly capitals: boolean;
}

/**
 * Every system `transcribe` writes a column for, for the guard above.
 */
export const SYSTEMS: readonly System[] = [
  BOPOMOFO,
  WADE_GILES,
  YALE,
  GWOYEU,
  IPA,
];

/**
 * The system a `--system` or `--from` name stands for.
 */
export function systemNamed(
  name: TranscriptionSource | undefined,
): System | undefined {
  return SYSTEMS.find((system) => system.name === name);
}

/**
 * Write a run of syllables in one system, each syllable in its tone's colour.
 */
export function writtenWith(
  syllables: readonly Syllable[],
  system: System,
  paint: Painter,
): string {
  return syllables
    .map((syllable) => paint(system.write(syllable), syllable.tone))
    .join(system.separator);
}
