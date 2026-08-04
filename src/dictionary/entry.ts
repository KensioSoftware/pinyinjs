import type { Syllable } from "../syllable/syllable.js";

/**
 * How a word is read, per locale.
 *
 * `tw` is a delta rather than a second dictionary: only a few hundred words are
 * read differently in 國語, so it is absent on almost every entry.
 */
export interface EntryReadings {
  /** 普通话, always present. */
  readonly cn: readonly Syllable[];
  /** 國語, only when it differs from {@link EntryReadings.cn}. */
  readonly tw?: readonly Syllable[];
}

/**
 * One word in the merged dictionary.
 *
 * Both scripts are held on the one entry rather than in two dictionaries, so
 * that a lookup of either form finds the same readings and no conversion happens
 * on the lookup path. See SCRIPTS-AND-LOCALES.md for why routing 繁體 through
 * 简体 before lookup would throw away accuracy.
 */
export interface DictionaryEntry {
  /** The 简体 form. */
  readonly hans: string;
  /** The 繁體 form, equal to {@link DictionaryEntry.hans} when unchanged. */
  readonly hant: string;
  /**
   * Other 繁體 spellings of this same word, where a source attests one.
   *
   * Simplification was many-to-one, so a 简体 word can have more than one
   * 繁體 spelling and both be current: 台湾 is written 臺灣 and 台灣, and a
   * reader of either expects it read `Táiwān`. Keying only
   * {@link DictionaryEntry.hant} would leave the other spelling converting
   * character by character, which is precisely the loss SCRIPTS-AND-LOCALES.md
   * makes 繁體 a first-class key to avoid.
   *
   * Only spellings a source writes out for this word belong here, never ones
   * composed from per-character variants — see the merge for what that costs.
   */
  readonly hantVariants?: readonly string[];
  readonly readings: EntryReadings;
  /** Corpus occurrences from jieba, or 0 for a word jieba does not list. */
  readonly frequency: number;
  /** jieba's part of speech tag, or the empty string when unknown. */
  readonly partOfSpeech: string;
  readonly isProperNoun: boolean;
  /**
   * Other readings this word's single character has, most likely first.
   *
   * Only single-character entries carry these. They are the polyphone priors the
   * lattice needs for its single-character fallback edges: 行 has to offer
   * `xíng`, `háng` and `héng` at a position no dictionary word covers.
   */
  readonly alternates?: readonly (readonly Syllable[])[];
}

/**
 * Whether two syllables are the same sound.
 */
export function isSameSyllable(left: Syllable, right: Syllable): boolean {
  return (
    left.initial === right.initial &&
    left.final === right.final &&
    left.tone === right.tone &&
    (left.erhua ?? false) === (right.erhua ?? false)
  );
}

/**
 * Whether two readings are the same sequence of sounds.
 */
export function isSameReading(
  left: readonly Syllable[],
  right: readonly Syllable[],
): boolean {
  return (
    left.length === right.length &&
    left.every((syllable, at) =>
      /* c8 ignore next -- the lengths match, so the fallback is unreachable */
      isSameSyllable(syllable, right[at] ?? syllable),
    )
  );
}
