/**
 * Settling which reading a word takes.
 *
 * The phrase corpus leads because it has three times CC-CEDICT's coverage;
 * CC-CEDICT corrects it on the neutral tone, which is what the two of them
 * actually disagree about; 儿化 is repaired before anything compares two
 * readings; and the override table has the last word.
 */
import type { CedictEntry } from "../sources/cedict.js";
import type { Syllable } from "../syllable/syllable.js";
import { isSingleCharacter } from "../script/characters.js";
import { isSameReading } from "./entry.js";
import { readAlignedReading } from "./reading.js";
import { repairErhua } from "./erhua-repair.js";
import { NEUTRAL_SENSE_LOOKUP } from "./neutral-senses.js";
import { OVERRIDE_READINGS } from "./overrides.js";
import {
  nearestReading,
  preferNeutralTones,
  reducesToNeutral,
} from "./reading-agreement.js";
import type { ReadCharacters } from "./reading.js";

/**
 * A word's settled reading, and what settling it cost the counts.
 */
export interface SettledReading {
  /** Undefined where no source gave a usable reading. */
  readonly reading: readonly Syllable[] | undefined;
  readonly aligned: readonly ReadCharacters[] | undefined;
  readonly neutralToneCorrections: number;
  readonly erhuaRepairs: number;
}

/**
 * Settle it.
 */
export function settleReading(
  word: string,
  defaults: ReadonlyMap<string, readonly Syllable[]>,
  cedictEntries: readonly CedictEntry[],
  cedictReadings: readonly (readonly Syllable[])[],
  phraseAligned: readonly ReadCharacters[] | undefined,
): SettledReading {
  let neutralToneCorrections = 0;
  let erhuaRepairs = 0;

  // ── The reading: phrase corpus leads, CC-CEDICT corrects ──
  let aligned = phraseAligned;
  let reading: readonly Syllable[] | undefined = aligned
    ?.map((read) => read.syllable)
    .filter((syllable) => syllable !== undefined);

  if (reading === undefined) {
    // No phrase entry. Single characters fall back to Unihan, which is the
    // better source for them anyway; everything else falls back to
    // CC-CEDICT.
    const characterDefault = defaults.get(word);
    if (isSingleCharacter(word) && characterDefault !== undefined) {
      reading = characterDefault.slice(0, 1);
      aligned = [{ characters: word, syllable: reading[0] }];
    } else if (cedictReadings[0] !== undefined) {
      reading = cedictReadings[0];
      aligned = readAlignedReading(word, cedictEntries[0]?.readings ?? []);
    }
  }

  if (reading === undefined || reading.length === 0) {
    return {
      reading: undefined,
      aligned: undefined,
      neutralToneCorrections: 0,
      erhuaRepairs: 0,
    };
  }

  // ── 儿化, before anything compares two readings ────────────
  const repaired = repairErhua(
    word,
    reading,
    aligned,
    cedictEntries,
    cedictReadings,
  );
  reading = repaired.reading;
  aligned = repaired.aligned;
  if (repaired.isRepaired) {
    erhuaRepairs++;
  }

  // ── Disagreements: CC-CEDICT wins on neutral tones ────────
  // Which sense to correct against is normally the nearest one. For a word on
  // the 轻声 list it is the nearest sense that *reduces* a syllable, because
  // there the nearest sense is the full-tone homograph the corpus happens to
  // have written and the everyday word is the other one — see
  // {@link NEUTRAL_SENSE_WORDS}.
  const chosen = reading;
  const nearest =
    phraseAligned === undefined
      ? undefined
      : ((NEUTRAL_SENSE_LOOKUP.has(word)
          ? nearestReading(
              chosen,
              cedictReadings.filter((candidate) =>
                reducesToNeutral(chosen, candidate),
              ),
            )
          : undefined) ?? nearestReading(chosen, cedictReadings));
  // A sense of a different length describes a different pronunciation, so
  // there is no syllable-for-syllable correction to make against it.
  if (nearest !== undefined) {
    const corrected = preferNeutralTones(reading, nearest);
    if (!isSameReading(corrected, reading)) {
      neutralToneCorrections++;
      reading = corrected;
    }
  }

  // ── The override table has the last word ──────────────────
  const override = OVERRIDE_READINGS.get(word);
  if (override !== undefined) {
    reading = override;
  }

  return { reading, aligned, neutralToneCorrections, erhuaRepairs };
}
