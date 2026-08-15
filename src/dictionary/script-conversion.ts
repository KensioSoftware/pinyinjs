/**
 * Reading a conversion out of the tally, and finding the rivals to it.
 *
 * A pairing is taken only where one 繁體 form clearly leads and the reading
 * agrees; where two forms are close the character is left to the reading.
 */
import type { CharacterConversion } from "../script/conversion.js";
import {
  ANY,
  type ByReading,
  type FormCounts,
  commonest,
  READING_AGREEMENT,
  RIVAL_SHARE,
} from "./script-pairings.js";

/**
 * Reduce one character's observations to a default and its exceptions.
 *
 * A character with only one observed form needs no entry at all when that form
 * is itself — simplification changed a minority of characters, and storing the
 * other 40,000 as identities would be most of the file.
 */
export function conversionOf(
  from: string,
  byReading: ByReading,
): CharacterConversion | undefined {
  const overall = commonest(from, byReading.get(ANY));
  if (overall === undefined) {
    return undefined;
  }

  const exceptions = new Map<string, string>();
  for (const [key, counts] of byReading) {
    const at = commonest(from, counts);
    if (
      key !== ANY &&
      at !== undefined &&
      at.form !== overall.form &&
      at.share >= READING_AGREEMENT
    ) {
      exceptions.set(key, at.form);
    }
  }

  const also = rivalsOf(byReading.get(ANY), overall.form, exceptions);

  if (overall.form === from && exceptions.size === 0 && also.length === 0) {
    return undefined;
  }
  return {
    to: overall.form,
    ...(exceptions.size > 0 && { byReading: exceptions }),
    ...(also.length > 0 && { also }),
  };
}

/**
 * The forms a character takes often enough to make it genuinely ambiguous.
 *
 * Forms a reading already accounts for are left out: those are settled evidence
 * rather than open questions, and repeating them here would report 发 as a
 * guess in 头发 when the reading decided it.
 */
export function rivalsOf(
  counts: FormCounts | undefined,
  chosen: string,
  exceptions: ReadonlyMap<string, string>,
): readonly string[] {
  if (counts === undefined) {
    return [];
  }
  let total = 0;
  for (const count of counts.values()) {
    total += count;
  }
  const settled = new Set([chosen, ...exceptions.values()]);
  return [...counts]
    .filter(
      ([form, count]) => !settled.has(form) && count / total >= RIVAL_SHARE,
    )
    .toSorted(([, left], [, right]) => right - left)
    .map(([form]) => form);
}

/**
 * Reduce every character's observations into a table.
 */
