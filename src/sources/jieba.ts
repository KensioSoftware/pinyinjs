/**
 * What jieba's dictionary knows about one word.
 */
export interface JiebaEntry {
  /** Corpus occurrences, used to rank candidate words when decoding. */
  readonly frequency: number;
  /** ICTCLAS-style part of speech tag, or the empty string when absent. */
  readonly partOfSpeech: string;
}

/**
 * Part of speech tags marking a proper noun.
 *
 * These supply the capitalisation signal that the orthography pass needs, so
 * that 北京 is written `Běijīng` rather than `běijīng`. No pinyin source carries
 * capitalisation, which is why it has to come from the tag.
 */
const PROPER_NOUN_TAGS = new Set([
  "nr", // person
  "ns", // place
  "nt", // organisation
  "nz", // other proper noun
]);

/**
 * Whether a part of speech tag marks a proper noun.
 */
export function isProperNounTag(partOfSpeech: string): boolean {
  return PROPER_NOUN_TAGS.has(partOfSpeech);
}

/**
 * Read jieba's `dict.txt`, whose lines are `word frequency tag`.
 *
 * Lines whose frequency is missing or unparseable are skipped rather than
 * defaulted, since a word with no count tells the decoder nothing and would
 * otherwise be indistinguishable from a genuinely rare one.
 */
export function parseJiebaDictionary(text: string): Map<string, JiebaEntry> {
  const entries = new Map<string, JiebaEntry>();

  for (const line of text.split("\n")) {
    const [word, count, partOfSpeech = ""] = line.trim().split(" ");
    if (word === undefined || word === "" || count === undefined) {
      continue;
    }
    const frequency = Number(count);
    if (!Number.isFinite(frequency)) {
      continue;
    }
    entries.set(word.normalize("NFC"), { frequency, partOfSpeech });
  }

  return entries;
}
