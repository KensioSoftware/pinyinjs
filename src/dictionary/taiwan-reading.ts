/**
 * The 國語 reading an entry carries, where a source states one.
 *
 * 教育部's dictionaries are the standard and are asked first. For a word they
 * list, what they say settles the entry, including when they say the word
 * reads as it does in 普通话. A word they leave out falls back to CC-CEDICT's
 * `Taiwan pr.` notes and Unihan's `kMandarin` pairs, which between them mark
 * some 640 items.
 *
 * A character is settled the other way round. 教育部 lists a polyphone's
 * readings in the order its entries are written, which leads with the literary
 * reading as often as the current one: 們 is `mén` before `men` and 著 `zhù`
 * before `zhe`. The order says nothing about which a character on its own
 * means, so the dictionary is used as a check on the notes, not as a default.
 * Both dictionaries are consulted for a character, since the question is only
 * whether a reading is listed at all.
 *
 * Every source hedges in its own way. CC-CEDICT hangs `Taiwan pr.` on one
 * sense of a headword and the others know nothing about it. What survives the
 * sense tests, and is not simply another 普通话 sense of the word, is the
 * delta. A reading that is the locale's but only for one sense is kept as an
 * alternate, so a caller can still see it.
 */
import { isSingleCharacter } from "../script/characters.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { MoeReading } from "../sources/moe.js";
import type { UnihanReadings } from "../sources/unihan.js";
import type { Syllable } from "../syllable/syllable.js";
import { isOwnSense } from "./cedict-senses.js";
import { isSameReading } from "./entry.js";
import { type NotedReading, notedReadingOf } from "./taiwan-notes.js";
import {
  alternatesOf,
  isRetoned,
  type StandardReading,
  standardReadingFor,
  standardReadingsOf,
} from "./standard-readings.js";

/**
 * What the sources settle about a word's 國語 reading.
 */
export interface TaiwanReading {
  /** The reading, where it differs from the 普通话 one. */
  readonly reading?: readonly Syllable[];
  /**
   * Other 國語 readings the word has in some sense, none of them 普通话 ones.
   *
   * 和 is `hé` in Taipei as in Beijing, and is also `hàn` when it joins two
   * nouns. Nothing at the word can say which a given 和 is, so the default
   * stays `hé` and `hàn` is offered here.
   */
  readonly alternates: readonly (readonly Syllable[])[];
  /** Whether 教育部 lists the word, so that nothing should be composed for it. */
  readonly isStandard: boolean;
}

/**
 * What a word is held to: 教育部 where it lists the word, the notes where not.
 *
 * A word only the revised dictionary lists may move its tones and nothing
 * else. That dictionary records classical words beside current ones under the
 * same characters, and where the concise one is silent there is nothing to say
 * which a headword is: it lists 五百 only as `wǔ bó`, which is not how
 * Taipei reads the number. A tone is the shift 國語 makes across whole classes
 * of words, and a change of sound is more often a different word written the
 * same way.
 */
function wordReadingOf(
  standard: readonly StandardReading[],
  noted: NotedReading | undefined,
  reading: readonly Syllable[],
  isDelta: (taiwan: readonly Syllable[] | undefined) => boolean,
): TaiwanReading {
  if (standard.length === 0) {
    return noted !== undefined && isDelta(noted.reading)
      ? { reading: noted.reading, alternates: [], isStandard: false }
      : { alternates: [], isStandard: false };
  }
  const readings = standard.map((listed) => listed.reading);
  const isCurrent = standard.some((listed) => listed.dictionary === "concise");
  const chosen = standardReadingFor(readings, reading, isDelta);
  const taiwan =
    chosen !== undefined && (isCurrent || isRetoned(chosen, reading))
      ? chosen
      : undefined;
  return {
    ...(taiwan !== undefined && { reading: taiwan }),
    // The readings it could not be told apart from, which are other words
    // written alike.
    alternates: isCurrent ? alternatesOf(readings, taiwan, isDelta) : [],
    isStandard: true,
  };
}

/**
 * What a character is held to: the notes, as far as 教育部 bears them out.
 *
 * A note 教育部 lists the reading for stands, as the default if it is about
 * the whole character and as an alternate if it is about one sense: 和's `hàn`
 * is listed, and is the conjunction only. A note it lists no such reading for
 * is dropped, which is what the standard says of 俄 `è` and 法 `fà`.
 *
 * 教育部 never supplies a character's reading by itself. Its order is the
 * order its entries are written in, and a character it does not list in its
 * 普通话 reading is as often a gap in the concise dictionary as a reading that
 * has moved: it has no 差 `chà`, and the one 差 it lists that 普通话 has no
 * sense for is `cuō`.
 */
function characterReadingOf(
  standard: readonly StandardReading[],
  noted: NotedReading | undefined,
  isDelta: (taiwan: readonly Syllable[] | undefined) => boolean,
): TaiwanReading {
  const isStandard = standard.length > 0;
  if (noted === undefined || !isDelta(noted.reading)) {
    return { alternates: [], isStandard };
  }
  const isListed = standard.some((listed) =>
    isSameReading(listed.reading, noted.reading),
  );
  if (isStandard && !isListed) {
    return { alternates: [], isStandard };
  }
  return noted.isSenseScoped
    ? { alternates: [noted.reading], isStandard }
    : { reading: noted.reading, alternates: [], isStandard };
}

/**
 * Settle it for one word.
 *
 * `spellings` are the word's 繁體 forms, which is how 教育部 keys it.
 */
export function taiwanReadingOf(
  word: string,
  spellings: readonly string[],
  senses: readonly CedictEntry[],
  senseReadings: readonly (readonly Syllable[])[],
  reading: readonly Syllable[],
  unihan: UnihanReadings | undefined,
  moe: ReadonlyMap<string, readonly MoeReading[]>,
): TaiwanReading {
  // A reading the word already has in 普通话 is a sense, not a locale.
  const isDelta = (taiwan: readonly Syllable[] | undefined): boolean =>
    taiwan !== undefined &&
    !isSameReading(taiwan, reading) &&
    !isOwnSense(taiwan, senseReadings);

  const noted = notedReadingOf(word, senses, unihan);
  if (!isSingleCharacter(word)) {
    return wordReadingOf(
      standardReadingsOf(spellings, moe),
      noted,
      reading,
      isDelta,
    );
  }
  // Every spelling, because a 简体 character can be a 繁體 one in its own
  // right with readings of its own: 教育部 lists 台 only as `yí`, and the
  // `tái` is under 臺.
  const listed = spellings.flatMap((spelling) =>
    standardReadingsOf([spelling], moe),
  );
  return characterReadingOf(listed, noted, isDelta);
}
