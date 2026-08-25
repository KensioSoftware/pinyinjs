/**
 * The part of speech carried across to the 繁體 spelling of the same word.
 *
 * jieba's dictionary is 简体 and its tags were counted over a 简体 corpus, so
 * the 繁體 spelling of a common word arrives with nothing on it. 听 is `v` and
 * 聽 carries no tag at all, while 说, 来, 问 and 学 are tagged and 說, 來, 問
 * and 學 come back `zg`.
 *
 * Every rule that asks what the word beside it is decides on that tag, so all
 * of them were silent over half the corpus. 我听过这首歌 read `wǒ tīngguo zhè
 * shǒu gē` and 我聽過這首歌 read `wǒ tīng guò zhè shǒu gē`. That is one sentence
 * written two ways.
 */
import { isProperNounTag } from "../sources/jieba.js";
import type { DictionaryEntry } from "./entry.js";

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
 * The entries after the carry, and how many of them took a tag.
 */
export interface TaggedEntries {
  readonly entries: readonly DictionaryEntry[];
  readonly carried: number;
}

/**
 * Whether an entry can lend its tag to the spelling it names.
 *
 * A proper noun cannot. Its tag travels with {@link DictionaryEntry.isProperNoun},
 * which `properNounOf` settles from jieba **and** CC-CEDICT's capitalisation
 * and which can veto what the tag proposes. Carrying the tag alone would leave
 * an entry claiming a place name that the same entry denies is a proper noun,
 * so `nr`, `ns`, `nt` and `nz` are left where they are. That is 230 of the
 * 2,273 spellings this reaches.
 */
function canLend(entry: DictionaryEntry): boolean {
  return (
    entry.hant !== entry.hans &&
    isTagged(entry.partOfSpeech) &&
    !isProperNounTag(entry.partOfSpeech)
  );
}

/**
 * Give every untagged 繁體 spelling the tag its 简体 word carries.
 *
 * The pairing is the one the entries already hold. An entry names the 繁體
 * spelling of its own word. The entry keyed on that spelling is therefore the
 * same word written the other way, and a part of speech is a fact about the
 * word rather than about the spelling. `corpus-mass.ts` makes the same move for
 * the polyphone priors, where a vote cast for a 简体 word is cast again for
 * whichever 繁體 form the reading picks.
 *
 * Only a spelling with no tag of its own takes one, which leaves everything
 * jieba classified untouched. Where two 简体 words name the same 繁體 spelling the
 * commoner of them lends, since the tag is being used to guess at what stands
 * beside a character and the commoner word is the likelier thing to be
 * standing there.
 */
export function carryTagsToTraditional(
  entries: readonly DictionaryEntry[],
): TaggedEntries {
  const byTraditional = new Map<string, DictionaryEntry>();
  for (const entry of entries) {
    if (!canLend(entry)) {
      continue;
    }
    const held = byTraditional.get(entry.hant);
    if (held === undefined || held.frequency < entry.frequency) {
      byTraditional.set(entry.hant, entry);
    }
  }

  let carried = 0;
  const tagged = entries.map((entry) => {
    if (isTagged(entry.partOfSpeech)) {
      return entry;
    }
    const lender = byTraditional.get(entry.hans);
    if (lender === undefined) {
      return entry;
    }
    carried += 1;
    return { ...entry, partOfSpeech: lender.partOfSpeech };
  });

  return { entries: tagged, carried };
}
