/**
 * Folding a word's 儿 into the syllable before it.
 *
 * Two different repairs, because the sources mark 儿化 in two different
 * places. A trailing 儿 is settled from the exception list and CC-CEDICT's
 * `r5` token; one in the *middle* of a word can only come from CC-CEDICT,
 * since the phrase corpus writes a syllable per character and has no way to
 * say that two characters are read as one.
 */
import type { CedictEntry } from "../sources/cedict.js";
import type { Syllable } from "../syllable/syllable.js";
import { attachErhua } from "./erhua.js";
import { isErhua } from "./reading-agreement.js";
import {
  ERHUA_TOKEN,
  readAlignedReading,
  type ReadCharacters,
} from "./reading.js";

/**
 * A reading and its alignment, after any repair.
 */
export interface ErhuaRepair {
  readonly reading: readonly Syllable[];
  readonly aligned: readonly ReadCharacters[] | undefined;
  /** Whether anything was folded. */
  readonly isRepaired: boolean;
}

/**
 * Repair one word's reading, or hand back what it was given.
 */
export function repairErhua(
  word: string,
  reading: readonly Syllable[],
  aligned: readonly ReadCharacters[] | undefined,
  cedictEntries: readonly CedictEntry[],
  cedictReadings: readonly (readonly Syllable[])[],
): ErhuaRepair {
  if (isErhua(word, cedictReadings)) {
    const attached = attachErhua(reading);
    if (attached !== reading) {
      // Fold the alignment the same way, so the 繁體 derivation still knows
      // which character each syllable reads.
      const last = aligned?.at(-1);
      const previous = aligned?.at(-2);
      const folded =
        aligned !== undefined && last !== undefined && previous !== undefined
          ? [
              ...aligned.slice(0, -2),
              {
                characters: previous.characters + last.characters,
                syllable: attached.at(-1),
              },
            ]
          : aligned;
      return { reading: attached, aligned: folded, isRepaired: true };
    }
  } else if (reading.every((syllable) => syllable.erhua !== true)) {
    // 儿化 in the middle of a word, which the trailing repair above cannot
    // reach: 一点儿事 is `yìdiǎnr shì`, three syllables over four characters,
    // and the phrase corpus writes four. Only CC-CEDICT's `r5` marks it, and
    // only it knows where, so where it does the whole reading is taken from
    // it — 53 of its 683 `r5` entries carry the marker mid-word.
    const marked = cedictEntries.find((entry) =>
      entry.readings.includes(ERHUA_TOKEN),
    );
    const markedAligned =
      marked === undefined
        ? undefined
        : readAlignedReading(word, marked.readings);
    if (markedAligned !== undefined) {
      return {
        reading: markedAligned
          .map((read) => read.syllable)
          .filter((syllable) => syllable !== undefined),
        aligned: markedAligned,
        isRepaired: true,
      };
    }
  }

  return { reading, aligned, isRepaired: false };
}
