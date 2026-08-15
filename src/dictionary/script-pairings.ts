/**
 * Counting how the two scripts pair up, character by character.
 *
 * Every entry the dictionary holds is one vote for a 简体 character reading a
 * given way being written a given 繁體 way. This is the tally, and the rules
 * for reading a conversion out of it.
 */
import { toCharacters } from "../script/characters.js";
import {
  type CharacterConversion,
  conversionKey,
} from "../script/conversion.js";
import type { Syllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * How often one character was written as another, at one reading.
 */
export type FormCounts = Map<string, number>;

/**
 * Observed pairings for one character: counts at each reading, and overall.
 */
export type ByReading = Map<string, FormCounts>;

/**
 * The key standing for "at any reading".
 */
const ANY = "";

/**
 * How much of a reading's evidence must agree before it overrides the default.
 *
 * A reading that disagrees with the default only earns a line in the table if
 * the sources are reasonably united about it. Below this it is noise — one
 * mis-aligned entry, or a spelling nobody else uses — and storing it would
 * make the conversion worse at the cost of bytes.
 */
const READING_AGREEMENT = 0.8;

/**
 * How much of a character's evidence a rival form needs to be worth reporting.
 *
 * This decides honesty rather than output: a form listed here makes the
 * character *ambiguous*, so every conversion of it is reported as a guess
 * unless a word or a reading settled it. Set too low and 和 is doubtful because
 * Unihan knows 咊; set too high and 面 looks certain when only the word tells
 * 面 from 麵. A twentieth of the evidence is enough to be a real spelling and
 * far more than the one-off variants clear.
 */
const RIVAL_SHARE = 0.05;

/**
 * The pairings an entry attests, character by character.
 *
 * Entries whose two scripts are written with a different number of characters
 * are skipped rather than aligned by guesswork, for the same reason
 * `pairScripts` skips them: an invented alignment is evidence for a pairing
 * nobody wrote.
 */
export function pairingsOf(
  entry: DictionaryEntry,
): readonly { hans: string; hant: string; key: string }[] {
  const hans = toCharacters(entry.hans);
  const hant = toCharacters(entry.hant);
  if (hans.length !== hant.length) {
    return [];
  }
  const reading = entry.readings.cn;
  // Only a reading with one syllable per character lines up; anything else
  // (儿化 covering two, or a source disagreeing about length) is used as
  // evidence for the pairing but not for any particular reading.
  const isAligned = reading.length === hans.length;
  return hans.map((character, at) => ({
    hans: character,
    /* c8 ignore next -- the two forms are known to be the same length */
    hant: hant[at] ?? character,
    key: isAligned ? conversionKey(reading[at]) : ANY,
  }));
}

/**
 * Tally one pairing under both its own reading and the any-reading key.
 */
export function tally(
  observed: Map<string, ByReading>,
  from: string,
  to: string,
  key: string,
  weight: number,
): void {
  const byReading = observed.get(from) ?? new Map<string, FormCounts>();
  const keys = new Set([ANY, key]);
  for (const at of keys) {
    const counts = byReading.get(at) ?? new Map<string, number>();
    counts.set(to, (counts.get(to) ?? 0) + weight);
    byReading.set(at, counts);
  }
  observed.set(from, byReading);
}

/**
 * The commonest form in a tally, and what share of the evidence it holds.
 *
 * A tie prefers a form other than the character itself, and that matters more
 * than it looks. Every character has an entry of its own where both scripts are
 * the same string, so a character attested in exactly one cross-script word
 * arrives here tied one-all against its own identity — 儁 against 㑺. The real
 * pairing is the one somebody wrote down; the identity is an artefact of how
 * the dictionary is keyed. `TraditionalTable` breaks the same tie the same way.
 */
export function commonest(
  from: string,
  counts: FormCounts | undefined,
): { form: string; share: number } | undefined {
  if (counts === undefined || counts.size === 0) {
    return undefined;
  }
  let form = "";
  let best = 0;
  let total = 0;
  for (const [candidate, count] of counts) {
    total += count;
    if (
      count > best ||
      (count === best && form === from && candidate !== from)
    ) {
      form = candidate;
      best = count;
    }
  }
  return { form, share: best / total };
}

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
export function tableOf(
  observed: Map<string, ByReading>,
): ReadonlyMap<string, CharacterConversion> {
  const table = new Map<string, CharacterConversion>();
  for (const [from, byReading] of observed) {
    const conversion = conversionOf(from, byReading);
    if (conversion !== undefined) {
      table.set(from, conversion);
    }
  }
  return table;
}

/**
 * The readings a word is converted with, where they line up character by
 * character.
 */
export function alignedReadings(
  entry: DictionaryEntry,
): readonly (Syllable | undefined)[] {
  const characters = toCharacters(entry.hans).length;
  return entry.readings.cn.length === characters ? entry.readings.cn : [];
}
