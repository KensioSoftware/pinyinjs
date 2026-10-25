/**
 * Reading 教育部's dictionaries for a word: which readings they list, and
 * which of them describes the entry in hand.
 */
import type { MoeDictionary, MoeReading } from "../sources/moe.js";
import { DICTIONARY_SYLLABLES, isAttestedTone } from "../syllable/inventory.js";
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import { isSameReading } from "./entry.js";
import { readDictionaryReading } from "./reading.js";

/**
 * Whether every syllable of a reading is one the inventory knows, in a tone it
 * is written in.
 *
 * 教育部 spells a handful of syllables no other source does — `lüan`, a
 * neutral `kong` or `dun` in a word nobody else reads that way — and the
 * romanisation readers refuse a syllable the inventory does not list. A
 * reading like that is the dictionary's own and is left out.
 */
function isInventoried(reading: readonly Syllable[]): boolean {
  return reading.every(
    (syllable) =>
      DICTIONARY_SYLLABLES.has(
        writeSyllable({ ...syllable, erhua: false, tone: undefined }),
      ) && isAttestedTone(syllable),
  );
}

/**
 * One reading 教育部 gives, read, with the dictionary that gives it.
 */
export interface StandardReading {
  readonly reading: readonly Syllable[];
  readonly dictionary: MoeDictionary;
}

/**
 * The readings 教育部 gives the first of a word's spellings it lists.
 *
 * In the dictionary's own order, which leads with the reading it lists first,
 * and then the variant readings it gives beside them.
 */
export function standardReadingsOf(
  spellings: readonly string[],
  moe: ReadonlyMap<string, readonly MoeReading[]>,
): readonly StandardReading[] {
  for (const spelling of spellings) {
    const listed = moe.get(spelling) ?? [];
    // Variants after every main reading, so a variant only wins where no
    // main reading is as close.
    const read = [
      ...listed.map((entry) => ({ ...entry, tokens: entry.readings })),
      ...listed.flatMap((entry) =>
        entry.variant === undefined
          ? []
          : [{ ...entry, tokens: entry.variant }],
      ),
    ].flatMap(({ tokens, dictionary }) => {
      const reading = readDictionaryReading(spelling, tokens);
      return reading !== undefined && isInventoried(reading)
        ? [{ reading, dictionary }]
        : [];
    });
    if (read.length > 0) {
      return read;
    }
  }
  return [];
}

/**
 * How closely two readings of the same length agree.
 *
 * Two points for each syllable whose sounds match and one more where its tone
 * does too, so a reading that differs only in tone always beats one that
 * differs in sound, and tones break the tie between two that do not.
 */
function likeness(
  left: readonly Syllable[],
  right: readonly Syllable[],
): number {
  let score = 0;
  for (const [at, syllable] of left.entries()) {
    const other = right[at];
    if (syllable.initial === other?.initial && syllable.final === other.final) {
      score += syllable.tone === other.tone ? 3 : 2;
    }
  }
  return score;
}

/**
 * Whether two readings differ only in their tones.
 */
export function isRetoned(
  left: readonly Syllable[],
  right: readonly Syllable[],
): boolean {
  return (
    left.length === right.length &&
    left.every((syllable, at) => {
      const other = right[at];
      return (
        syllable.initial === other?.initial &&
        syllable.final === other.final &&
        (syllable.erhua ?? false) === (other.erhua ?? false)
      );
    })
  );
}

/**
 * Which of 教育部's readings describes the word the entry reads, or undefined
 * where the word is read as in 普通话.
 *
 * A word with several readings is several words, as 東西 is `dōngxī` and
 * `dōngxi`. One that reads the way the entry does, or as another 普通话 sense
 * of the word, is that word and agrees with 普通话, so there is no delta:
 * 那些 is `nàxiē` beside the `nǎxiē` of 哪些, and `nàxiē` is the reading
 * CC-CEDICT gives the `nèixiē` the entry holds. Otherwise the one most like the
 * entry's reading is the same word with its tones moved: 那裡 is `nǎlǐ` and
 * `nàlǐ`, and the 那里 that reads `nàli` is the second. The earlier wins a tie.
 */
export function standardReadingFor(
  standard: readonly (readonly Syllable[])[],
  reading: readonly Syllable[],
  isDelta: (taiwan: readonly Syllable[]) => boolean,
): readonly Syllable[] | undefined {
  if (standard.some((listed) => !isDelta(listed))) {
    return undefined;
  }
  let best: readonly Syllable[] | undefined;
  for (const listed of standard) {
    if (
      best === undefined ||
      likeness(listed, reading) > likeness(best, reading)
    ) {
      best = listed;
    }
  }
  return best;
}

/**
 * The offered readings that are deltas, other than the one chosen, once each.
 */
export function alternatesOf(
  offered: readonly (readonly Syllable[])[],
  chosen: readonly Syllable[] | undefined,
  isDelta: (taiwan: readonly Syllable[]) => boolean,
): readonly (readonly Syllable[])[] {
  const kept: (readonly Syllable[])[] = [];
  for (const candidate of offered) {
    if (
      isDelta(candidate) &&
      (chosen === undefined || !isSameReading(candidate, chosen)) &&
      !kept.some((held) => isSameReading(held, candidate))
    ) {
      kept.push(candidate);
    }
  }
  return kept;
}
