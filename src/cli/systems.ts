/**
 * The systems table, and the one thing the CLI does with it that nothing else
 * does, which is to paint every syllable of a word its own colour.
 *
 * The table itself is `src/transcription/systems.ts`, since what a system
 * writes is a fact about the system rather than about a terminal.
 */
import type { Syllable } from "../syllable/syllable.js";
import {
  type TranscriptionSystem,
  TRANSCRIPTION_SYSTEMS,
  transcriptionSystemNamed,
} from "../transcription/systems.js";
import type { TranscriptionSource } from "./flag-lists.js";
import type { Painter } from "./colour.js";

export {
  BOPOMOFO,
  GWOYEU,
  IPA,
  WADE_GILES,
  YALE,
} from "../transcription/systems.js";
export type { TranscriptionSystem as System } from "../transcription/systems.js";

/**
 * Every system `transcribe` writes a column for.
 */
export const SYSTEMS: readonly TranscriptionSystem[] = TRANSCRIPTION_SYSTEMS;

/**
 * The system a `--system` or `--from` name stands for.
 *
 * `auto` and `pinyin` are names the flags take and no system answers to, so
 * both come back undefined.
 */
export function systemNamed(
  name: TranscriptionSource | undefined,
): TranscriptionSystem | undefined {
  return transcriptionSystemNamed(name);
}

/**
 * Write a run of syllables in one system, each syllable in its tone's colour.
 */
export function writtenWith(
  syllables: readonly Syllable[],
  system: TranscriptionSystem,
  paint: Painter,
): string {
  return syllables
    .map((syllable) => paint(system.write(syllable, true), syllable.tone))
    .join(system.separator);
}
