import type { Flags } from "./flags.js";
import { chosen, SOURCES, type TranscriptionSource } from "./flag-lists.js";

export {
  APOSTROPHES,
  CAPITALS,
  chosen,
  counted,
  LOCALES,
  NOTATIONS,
  PUNCTUATION,
  SLUG_SYLLABLES,
  SLUG_TONES,
  SLUG_UMLAUTS,
  TIERS,
  type TranscriptionSource,
} from "./flag-lists.js";
/**
 * Reading a single typed value out of the flags.
 *
 * Every option a command takes is one of these underneath: a value from a
 * fixed list, a number, or a name from a fixed list with its own meaning.
 * The refusal when a flag names something that does not exist lives here too.
 */
import type { ColourDepth } from "./colour.js";

/**
 * Read the `--from` flag.
 */
export function transcriptionSource(flags: Flags): TranscriptionSource {
  return chosen(flags, "from", SOURCES) ?? "auto";
}

/**
 * Which system a conversion should be written in.
 *
 * `pinyin` is not a value: writing pinyin is what `convert` does with no flag
 * at all, and offering a name for the default would suggest the others are
 * alternatives to it rather than things it is put through afterwards.
 */
export const SYSTEMS_WRITTEN: readonly TranscriptionSource[] = [
  "bopomofo",
  "wade-giles",
  "yale",
  "gwoyeu",
  "ipa",
];

/**
 * Read the `--system` flag.
 */
export function transcriptionSystem(
  flags: Flags,
): TranscriptionSource | undefined {
  return chosen(flags, "system", SYSTEMS_WRITTEN);
}

/**
 * How much colour a run should write, given what the terminal offered.
 *
 * `--colour` and `--no-colour` force it either way, and `--color` is accepted
 * as a spelling because every other tool spells it that way and nobody should
 * have to discover which this one chose.
 *
 * **`--json` is never coloured**, whatever the flags say: the option is about
 * the plain output, and the JSON already carries the tone as a number for a
 * caller that will do its own rendering.
 *
 * Forcing colour where the environment offered none — into a pipe, or past
 * `NO_COLOR` — gets the sixteen every terminal has, because nothing is known
 * about where that output is going.
 */
export function colourDepth(flags: Flags, offered: ColourDepth): ColourDepth {
  if (flags.json === true) {
    return 0;
  }
  if (flags["no-colour"] === true || flags["no-color"] === true) {
    return 0;
  }
  if (flags.colour === true || flags.color === true) {
    return offered === 0 ? 16 : offered;
  }
  return offered;
}
