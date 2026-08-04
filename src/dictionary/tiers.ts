import { isSingleCharacter, toCharacters } from "../script/characters.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * The dictionary tiers, smallest first and each contained in the next.
 *
 * Nesting is what makes progressive loading safe in a browser: a page can
 * convert on `core` the moment it arrives and re-run as each larger tier lands,
 * without any answer it already gave being contradicted by a word it did not
 * yet know.
 */
export const TIERS = ["core", "standard", "full"] as const;

/**
 * One of the dictionary tiers.
 */
export type Tier = (typeof TIERS)[number];

/**
 * The tier shipped when the caller does not name one.
 *
 * Accuracy is this package's point of difference and the measured cost of the
 * whole dictionary is small — see DATA-PIPELINE.md — so the default is the
 * complete one, not the small one.
 */
export const DEFAULT_TIER = "full" satisfies Tier;

/**
 * How many multi-character words the `standard` tier keeps.
 *
 * Measured on the real word list, the top 50,000 by frequency cover 97.86% of
 * exception token mass — the share of running text where a word's reading
 * differs from its characters' defaults, which is exactly where pronunciation
 * goes wrong if the entry is missing. Going from here to the full 412k costs
 * about 1 MB and buys the remaining 2.1 points.
 */
export const STANDARD_TIER_WORDS = 50_000;

/**
 * Order entries by descending frequency, then by key for a stable result.
 */
function byFrequency(left: DictionaryEntry, right: DictionaryEntry): number {
  if (left.frequency !== right.frequency) {
    return right.frequency - left.frequency;
  }
  return left.hans < right.hans ? -1 : 1;
}

/**
 * Characters that appear in a word some source actually records.
 *
 * Unihan covers 44,357 characters, but most of them are historic or belong to
 * the extension blocks and appear in no modern vocabulary at all. Keeping them
 * out of the small tiers is what lets `core` stay small enough to be worth
 * loading first: with everything Unihan knows it is 153 KB compressed, and with
 * only the characters in use it is a fraction of that.
 *
 * "In use" is decided from the entry set itself rather than from a checked-in
 * list — a character counts if some multi-character entry contains it, or if
 * jieba attests it as a word in its own right.
 */
function charactersInUse(
  entries: readonly DictionaryEntry[],
): ReadonlySet<string> {
  const inUse = new Set<string>();
  for (const entry of entries) {
    if (isSingleCharacter(entry.hans)) {
      if (entry.frequency > 0) {
        inUse.add(entry.hans);
      }
      continue;
    }
    for (const word of [entry.hans, entry.hant]) {
      for (const character of toCharacters(word)) {
        inUse.add(character);
      }
    }
  }
  return inUse;
}

/**
 * The entries a tier contains.
 *
 * The smaller tiers hold every character in use, because characters are what
 * makes a dictionary usable at all: they cover roughly half of running text on
 * their own, and they are the fallback for every position no word matches.
 * Tiering cuts the phrase tail and the unused characters, never a character
 * that some word is written with.
 *
 * `full` holds everything, including the characters no source uses in a word.
 * They cost little there and are the difference between reading a rare
 * character and failing on it.
 */
export function selectTier(
  entries: readonly DictionaryEntry[],
  tier: Tier,
): readonly DictionaryEntry[] {
  if (tier === "full") {
    return entries;
  }

  const inUse = charactersInUse(entries);
  const characters = entries.filter(
    (entry) => isSingleCharacter(entry.hans) && inUse.has(entry.hans),
  );
  if (tier === "core") {
    return characters;
  }

  const words = entries
    .filter((entry) => !isSingleCharacter(entry.hans))
    .toSorted(byFrequency)
    .slice(0, STANDARD_TIER_WORDS);
  return [...characters, ...words];
}
