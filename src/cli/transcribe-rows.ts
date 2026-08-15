/**
 * Writing a reading out in every system.
 *
 * The other half of `transcribe`: `transcribe-reading.ts` settles what
 * syllables the text stands for, and this writes them. Everything here is
 * total — every syllable can be written in every system — which is what makes
 * it a separate concern from reading, where only some systems answer at all.
 */
import { writeSyllable } from "../syllable/syllable.js";
import { convertOptions, type Flags } from "./arguments.js";
import type { Painter } from "./colour.js";
import {
  BOPOMOFO,
  GWOYEU,
  IPA,
  WADE_GILES,
  writtenWith,
  YALE,
} from "./systems.js";
import type { Reading } from "./transcribe-reading.js";

/**
 * One syllable or word, in every system.
 */
export interface Transcribed {
  readonly pinyin: string;
  readonly bopomofo: string;
  readonly wadeGiles: string;
  readonly yale: string;
  readonly gwoyeu: string;
  readonly ipa: string;
  /**
   * Whether the Wade-Giles this came from was spelled exactly.
   *
   * Undefined when the input was not Wade-Giles, since the question only
   * arises there.
   */
  readonly isExact?: boolean;
}

/**
 * Write a run of syllables in every system.
 */
export function transcribed(
  reading: Reading,
  flags: Flags,
  paint: Painter,
): Transcribed {
  const { notation } = convertOptions(flags);
  const { syllables, isExact } = reading;
  return {
    pinyin: syllables
      .map((syllable) =>
        paint(writeSyllable(syllable, notation), syllable.tone),
      )
      .join(""),
    bopomofo: writtenWith(syllables, BOPOMOFO, paint),
    wadeGiles: writtenWith(syllables, WADE_GILES, paint),
    yale: writtenWith(syllables, YALE, paint),
    gwoyeu: writtenWith(syllables, GWOYEU, paint),
    ipa: writtenWith(syllables, IPA, paint),
    ...(isExact !== undefined && { isExact }),
  };
}
