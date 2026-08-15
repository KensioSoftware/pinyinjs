/**
 * What one line of the entry blob means, once it is read as a word.
 *
 * The blob is columns of text and `Dictionary` is a store of words; this is
 * where the one becomes the other. It is worth its own module because the
 * decode is the only part of a lookup that knows the artifact's encoding — the
 * flag letters, the boundary notation, the empty reading that means "derive it"
 * — and none of that should be visible to the index and caching around it.
 */
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { decodeReading } from "./artifact.js";
import { nameBoundariesIn, PROPER_NOUN_FLAG } from "./artifact-format.js";

/**
 * What the dictionary knows about one word.
 */
export interface WordEntry {
  readonly word: string;
  /** 普通话 reading. */
  readonly reading: readonly Syllable[];
  /** 國語 reading, absent when it does not differ. */
  readonly taiwanReading?: readonly Syllable[];
  readonly partOfSpeech: string;
  readonly isProperNoun: boolean;
  /**
   * Where a proper name divides into its parts, in characters.
   *
   * Present only where CC-CEDICT's own capitalisation divides it: 齐白石 is
   * `[Qi2 Bai2 shi2]`, 司马迁 `[Si1 ma3 Qian1]`, 上海交通大学
   * `[Shang4 hai3 Jiao1 tong1 Da4 xue2]`. Absent for 马克思 `[Ma3 ke4 si1]`,
   * which is why a transliteration stays one word.
   */
  readonly nameBoundaries?: readonly number[];
  /**
   * Decoding cost, where lower means more likely.
   *
   * Quantised from the corpus frequency; see
   * {@link import("./frequency-table.js").FrequencyTable.costOf}.
   */
  readonly cost: number;
}

/**
 * Decode one line's columns into an entry.
 *
 * `readingOf` is asked for a single character's stored reading, and is only
 * reached where the line's own reading column is empty.
 */
export function decodeEntry(
  word: string,
  columns: readonly string[],
  readingOf: (character: string) => string | undefined,
  cost: number,
): WordEntry {
  const [reading = "", taiwan = "", partOfSpeech = "", flags = ""] = columns;

  // An empty reading means the word is read as its characters' defaults,
  // which is how 87.8% of multi-character entries are stored.
  const encoded =
    reading === ""
      ? toCharacters(word)
          .map((character) => readingOf(character) ?? "")
          .join(" ")
      : reading;
  const decoded = decodeReading(encoded) ?? [];
  const taiwanReading = decodeReading(taiwan);
  const nameBoundaries = nameBoundariesIn(flags);

  return {
    word,
    reading: decoded,
    ...(taiwanReading !== undefined && { taiwanReading }),
    partOfSpeech,
    isProperNoun: flags.includes(PROPER_NOUN_FLAG),
    ...(nameBoundaries.length > 0 && { nameBoundaries }),
    cost,
  };
}
