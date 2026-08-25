/**
 * What a 繁體 spelling takes from the 简体 word it pairs with.
 *
 * jieba's dictionary was counted over a 简体 corpus, and all three of the fields
 * it settles arrive on one script and not the other. 听 is tagged `v` and
 * counted 20,435 times. 聽 is tagged nothing, counted nowhere, and 麥 is not a
 * name where 麦 is one. Every rule that asks what the word beside it is decides
 * on the tag, every path the decoder weighs is priced on the count, and the
 * capital comes straight off the proper-noun bit, so 繁體 text was read by
 * rules that could not see it, priced by a model that had never met it and
 * capitalised by a different answer from the one 简体 got.
 *
 * All three travel over the pairing the entries already hold. An entry names
 * the 繁體 spelling of its own word. The entry keyed on that spelling is
 * therefore the same word written the other way, and how a word is classed, how
 * often it is met and whether it is a name are facts about the word rather than
 * about the spelling. `corpus-mass.ts` makes the same move for the polyphone
 * priors, where a vote cast for a 简体 word is cast again for whichever 繁體
 * form the reading picks.
 *
 * A 繁體 spelling that is not a headword of its own needs none of this, because
 * `artifact-claims.ts` lets its 简体 entry claim the key outright and the key
 * carries that entry's fields. 銀行 is claimed by 银行 and always priced as it.
 * What is left is the characters Unihan gives an entry to, which is why only
 * single characters are paired here.
 */
import { convertCharacter } from "../script/conversion.js";
import type { CharacterConversion } from "../script/conversion.js";
import { isSingleCharacter } from "../script/characters.js";
import type { DictionaryEntry } from "./entry.js";
import { traditionalCharacterTable } from "./script-pairings.js";

/**
 * jieba's tag for a character it has counted and not classified.
 *
 * Written on 5,666 entries and on nothing longer than one character, 简体 and
 * 繁體 alike: 且, 丢, 乎, 井, 今 and 仍 carry it next to 來, 個 and 這. It says
 * that the character was seen rather than what it is. Read here as no tag at
 * all, and left in the artifact, because whether jieba wrote `zg` or wrote
 * nothing is a fact about the source and only this decides what to make of it.
 *
 * Nothing longer than one character carries it. That leaves the rules forbidding
 * an **untagged key** alone, since each of those asks about a word of two
 * characters or more and no such key is tagged `zg`.
 */
const UNCATEGORISED = "zg";

/**
 * Whether a tag says anything about the word.
 */
export function isTagged(partOfSpeech: string): boolean {
  return partOfSpeech !== "" && partOfSpeech !== UNCATEGORISED;
}

/**
 * The entries after the carry, and how many took each field.
 */
export interface CarriedEntries {
  readonly entries: readonly DictionaryEntry[];
  readonly carriedTags: number;
  readonly carriedCounts: number;
  readonly carriedCapitals: number;
}

/**
 * The 繁體 character a 简体 one is written as, or undefined where it is neither.
 *
 * Read off the aggregate table rather than off {@link DictionaryEntry.hant},
 * and that is the whole of what keeps this honest. An entry's own 繁體 form is
 * whichever CC-CEDICT sense matched its reading, and for a single character
 * that can be an oddity: CC-CEDICT holds `旹 时` as an old variant of 時, so
 * 时's entry can name 旹 while every word 时 appears in says 時. Lending 时's
 * 103,735 occurrences to 旹 made a character nobody writes the third commonest
 * way to write `shí`. The table counts words, so 時 wins it thousands to one.
 */
function traditionalOf(
  table: ReadonlyMap<string, CharacterConversion>,
  entry: DictionaryEntry,
): string | undefined {
  if (!isSingleCharacter(entry.hans)) {
    return undefined;
  }
  const written = convertCharacter(table, entry.hans, entry.readings.cn[0]);
  return written === entry.hans ? undefined : written;
}

/**
 * The 简体 entry each 繁體 character should take a field from.
 *
 * Where two 简体 characters are written the same way in 繁體 the commoner of
 * them lends. Both fields are being used to guess at what a reader meant, and
 * the commoner character is the likelier thing to have been meant. `hasField`
 * is asked first, so that a commoner character with nothing to lend does not
 * shut out a rarer one that has something.
 */
function lendersByTraditional(
  entries: readonly DictionaryEntry[],
  table: ReadonlyMap<string, CharacterConversion>,
  hasField: (entry: DictionaryEntry) => boolean,
): ReadonlyMap<string, DictionaryEntry> {
  const lenders = new Map<string, DictionaryEntry>();
  for (const entry of entries) {
    const written = hasField(entry) ? traditionalOf(table, entry) : undefined;
    if (written === undefined) {
      continue;
    }
    const held = lenders.get(written);
    if (held === undefined || held.frequency < entry.frequency) {
      lenders.set(written, entry);
    }
  }
  return lenders;
}

/**
 * Whether an entry has a tag worth lending.
 */
function canLendTag(entry: DictionaryEntry): boolean {
  return isTagged(entry.partOfSpeech);
}

/**
 * The tag a spelling ends up with, and whether it took one.
 *
 * `nr`, `ns`, `nt` and `nz` are lent along with the rest now that
 * {@link properFor} carries the bit they go with. Lending the tag without it
 * would have left a spelling claiming a place name the same entry denies is a
 * proper noun, which is why they were held back until the bit travelled.
 */
function tagFor(
  entry: DictionaryEntry,
  lender: DictionaryEntry | undefined,
): string | undefined {
  if (isTagged(entry.partOfSpeech) || lender === undefined) {
    return undefined;
  }
  return lender.partOfSpeech;
}

/**
 * The count a spelling ends up with, and whether it took one.
 *
 * The larger of the two, rather than the lender's outright. A 繁體 spelling
 * that jieba counted at all was counted incidentally in a corpus written the
 * other way, and the word occurs at least as often as the commoner spelling of
 * it was seen. Taking the smaller would price 過 by the handful of 繁體 lines
 * jieba's corpus happens to contain.
 *
 * Only the form the reading picks takes it. 发 read `fā` is written 發, so 發
 * takes 发's count and 髮 does not, which is the same line the conversion draws
 * when it writes 出发 as 出發 and 头发 as 頭髮.
 *
 * **The count is carried whole and not shared out.** A share would say that
 * 繁體 text is some fraction as common as 简体 text, and nothing measured here
 * says what that fraction is. It would also be invisible: the buckets the
 * decoder compares are log-spaced, one of them is a factor of 2.49, so halving
 * a count moves it 0.76 of a bucket and a tenth of it moves it 2.5. Only a
 * share of an order of magnitude would change a decode, and inventing one that
 * large to fix a decode that is currently wrong would be trading one guess for
 * another.
 */
function countFor(
  entry: DictionaryEntry,
  lender: DictionaryEntry | undefined,
): number | undefined {
  if (lender === undefined || lender.frequency <= entry.frequency) {
    return undefined;
  }
  return lender.frequency;
}

/**
 * Whether a spelling is a name, and whether that is a change.
 *
 * The bit is what survived `properNounOf`, so it is the answer both sources
 * reached together rather than jieba's proposal, and it is taken whichever way
 * it points. Demoting matters as much as promoting. 后 is a locative and 後
 * arrived tagged `nr` with nothing under its own spelling to challenge it, so
 * 退休後 came out `tuìxiū Hòu` where 退休后 came out `tuìxiū hòu`.
 *
 * This carries the 简体 answer whether or not that answer is right. jieba calls
 * 连 a surname and 連 now agrees, where before the two differed and one of them
 * happened to be correct. The two scripts saying one thing is what this is for.
 * How good that one thing is for a bare character is #159.
 */
function properFor(
  entry: DictionaryEntry,
  lender: DictionaryEntry | undefined,
): boolean | undefined {
  if (lender === undefined || lender.isProperNoun === entry.isProperNoun) {
    return undefined;
  }
  return lender.isProperNoun;
}

/**
 * Give every 繁體 headword the tag and the count its 简体 word carries.
 *
 * Neither overwrites something the source stated. A spelling jieba classified
 * keeps its own tag, and a spelling jieba counted more often than its 简体 word
 * keeps its own count.
 */
export function carryToTraditional(
  entries: readonly DictionaryEntry[],
): CarriedEntries {
  const table = traditionalCharacterTable(entries);
  const tagLenders = lendersByTraditional(entries, table, canLendTag);
  const countLenders = lendersByTraditional(
    entries,
    table,
    (entry) => entry.frequency > 0,
  );
  let carriedTags = 0;
  let carriedCounts = 0;
  let carriedCapitals = 0;

  const carried = entries.map((entry) => {
    const tagLender = tagLenders.get(entry.hans);
    const partOfSpeech = tagFor(entry, tagLender);
    const frequency = countFor(entry, countLenders.get(entry.hans));
    const isProperNoun = properFor(entry, tagLender);
    if (
      partOfSpeech === undefined &&
      frequency === undefined &&
      isProperNoun === undefined
    ) {
      return entry;
    }
    if (partOfSpeech !== undefined) {
      carriedTags += 1;
    }
    if (frequency !== undefined) {
      carriedCounts += 1;
    }
    if (isProperNoun !== undefined) {
      carriedCapitals += 1;
    }
    return {
      ...entry,
      ...(partOfSpeech !== undefined && { partOfSpeech }),
      ...(frequency !== undefined && { frequency }),
      ...(isProperNoun !== undefined && { isProperNoun }),
    };
  });

  return { entries: carried, carriedTags, carriedCounts, carriedCapitals };
}
