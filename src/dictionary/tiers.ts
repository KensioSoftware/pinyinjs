import { isSingleCharacter, toCharacters } from "../script/characters.js";
import { traditionalForms } from "./artifact.js";
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
 * The characters a tier holds: the ones in use, and the ones it has to answer.
 *
 * "In use" alone is not enough, because a tier is keyed by more than the
 * headwords it holds — an entry claims every 繁體 spelling attested for it, and
 * some of those spellings are rare characters with entries of their own. A tier
 * holding 卒 is keyed for 䘚 whether or not it holds 䘚, so without the
 * character's own entry it answers that key from the 卒 that reached it
 * sideways and reads `zú`, where `full` lets 䘚's own entry win the key and
 * reads `zhú`. Neither reading is wrong — 䘚 written for 卒 really is `zú` —
 * but which one you get must not depend on how much of the dictionary has
 * loaded, or the documented upgrade path contradicts itself mid-paragraph.
 *
 * Admitting the entry is all it takes: the artifact's `claimKeys` puts
 * headwords ahead of 繁體 aliases in every tier, so once 䘚 is present it wins
 * its own key exactly as it does in `full`.
 *
 * It repeats to a fixpoint because an admitted character claims spellings of
 * its own, and one of those can be another character with an entry behind it.
 * On the current sources it settles at once — 242 characters admitted, then a
 * confirming pass that admits none — but nothing in the merge rules a chain
 * out, and the pass is a set lookup per entry against a build that reads four
 * source files.
 */
function charactersHeld(
  entries: readonly DictionaryEntry[],
  words: readonly DictionaryEntry[],
): ReadonlySet<string> {
  const headed = new Set<string>();
  for (const entry of entries) {
    if (isSingleCharacter(entry.hans)) {
      headed.add(entry.hans);
    }
  }

  const inUse = charactersInUse(entries);
  const held = new Set<string>();
  for (const character of headed) {
    if (inUse.has(character)) {
      held.add(character);
    }
  }

  /**
   * Admit the characters this entry claims the key of, reporting any news.
   */
  const admitClaims = (entry: DictionaryEntry): boolean => {
    let admitted = false;
    for (const form of traditionalForms(entry)) {
      if (headed.has(form) && !held.has(form)) {
        held.add(form);
        admitted = true;
      }
    }
    return admitted;
  };

  for (const entry of words) {
    admitClaims(entry);
  }
  let growing = true;
  while (growing) {
    growing = false;
    for (const entry of entries) {
      if (isSingleCharacter(entry.hans) && held.has(entry.hans)) {
        growing = admitClaims(entry) || growing;
      }
    }
  }
  return held;
}

/**
 * The entries a tier contains.
 *
 * The smaller tiers hold every character in use, because characters are what
 * makes a dictionary usable at all: they cover roughly half of running text on
 * their own, and they are the fallback for every position no word matches.
 * Tiering cuts the phrase tail and the unused characters, never a character
 * that some word is written with — and never one the tier is keyed for anyway,
 * which is what {@link charactersHeld} adds on top.
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

  const words =
    tier === "core"
      ? []
      : entries
          .filter((entry) => !isSingleCharacter(entry.hans))
          .toSorted(byFrequency)
          .slice(0, STANDARD_TIER_WORDS);

  const held = charactersHeld(entries, words);
  const characters = entries.filter(
    (entry) => isSingleCharacter(entry.hans) && held.has(entry.hans),
  );
  return tier === "core" ? characters : [...characters, ...words];
}
