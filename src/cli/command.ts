/**
 * What every subcommand is, and the formatting each of them shares.
 *
 * Split out from `commands.ts` so that a command living in its own module can
 * take the contract and the shared helpers without importing the registry that
 * lists it, which would be a cycle.
 */
import type { ConvertedPiece } from "../decode/convert.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import type { ScriptTables } from "../script/conversion.js";
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import {
  type DictionaryChoice,
  type Flags,
  type FlagName,
  UsageError,
} from "./arguments.js";
import { type Painter, visibleLength } from "./colour.js";

/**
 * What a command is given to work with.
 */
export interface CommandInput {
  /** The words, phrases or texts to act on, one per line of output. */
  readonly texts: readonly string[];
  readonly flags: Flags;
  /** Loaded for the commands that declare they need one. */
  readonly dictionary: Dictionary | undefined;
  /** Loaded for the one command that converts between the scripts. */
  readonly scriptTables: ScriptTables | undefined;
  readonly choice: DictionaryChoice;
  /**
   * How to write a syllable, which is where tone colour is applied.
   *
   * Handed in rather than worked out, because whether the output is a terminal
   * is a fact about the run and not about the command. A command that writes no
   * syllables never calls it, and `html` deliberately does not: markup is a
   * format for a machine, exactly as `--json` is.
   */
  readonly paint: Painter;
}

/**
 * One answer, in both the forms the CLI can write it.
 *
 * Every command reports both rather than one being derived from the other: the
 * lines are for a person reading them and the data is for `jq`, and a person's
 * columns are a poor thing to parse. Keeping them side by side in each command
 * is what stops them drifting apart.
 */
export interface Reported {
  readonly lines: readonly string[];
  /** Written as one JSON document per answer, for `--json`. */
  readonly data: unknown;
}

/**
 * One subcommand.
 */
export interface Command {
  readonly name: string;
  /** One line, for the command list in the help. */
  readonly summary: string;
  /** What follows the command name, for its own help. */
  readonly argument: string;
  /** The flags it takes, beyond the global ones. */
  readonly flags: readonly FlagName[];
  /**
   * Whether it reads the dictionary.
   *
   * The syllable layer needs no data at all, and a command that only uses it
   * should not wait for 2.4 MB to load.
   */
  readonly needsDictionary: boolean;
  /**
   * Whether it reads the script conversion tables, which are their own file.
   *
   * Off for everything but `script`: the tables are 96 KB nothing else looks
   * at, and the point of keeping them out of the dictionary is not paying for
   * them by default.
   */
  readonly needsScriptTables?: boolean;
  readonly run: (input: CommandInput) => readonly Reported[];
}

/**
 * The dictionary a command declared it needs.
 */
export function dictionaryOf(input: CommandInput): Dictionary {
  /* c8 ignore next 3 -- loaded for every command that declares it needs one */
  if (input.dictionary === undefined) {
    throw new UsageError("no dictionary was loaded");
  }
  return input.dictionary;
}

/**
 * Pad a column so that what follows it lines up.
 *
 * Padded to what a reader sees rather than to the string's length: a coloured
 * cell carries escape sequences that take no width on screen, and `padEnd`
 * counts them.
 */
export function column(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleLength(text)));
}

/**
 * A reading written out, syllable by syllable, each in its tone's colour.
 */
export function written(reading: readonly Syllable[], paint: Painter): string {
  return reading
    .map((syllable) => paint(writeSyllable(syllable), syllable.tone))
    .join(" ");
}

/**
 * A conversion's pieces joined back up, each syllable in its tone's colour.
 */
export function paintedPieces(
  pieces: readonly ConvertedPiece[],
  input: CommandInput,
): string {
  return pieces
    .map((piece) => input.paint(piece.text, piece.syllable?.tone))
    .join("");
}
