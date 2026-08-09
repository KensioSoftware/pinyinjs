import { toCharacters } from "../script/characters.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { JiebaEntry } from "../sources/jieba.js";
import { isFrequencyRanked, type ReadingField } from "../sources/unihan.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { readAlignedReading } from "./reading.js";
import type { TraditionalTable } from "./traditional.js";

/**
 * The sources a character's corpus mass is counted over.
 *
 * The same three the merge already holds: the words, their readings, and how
 * often jieba's corpus saw each word.
 */
export interface MassSources {
  readonly phrase: ReadonlyMap<string, readonly string[]>;
  readonly cedict: readonly CedictEntry[];
  readonly jieba: ReadonlyMap<string, JiebaEntry>;
}

/**
 * How much corpus each of a character's readings carries, keyed by reading.
 */
export type CorpusMass = ReadonlyMap<string, ReadonlyMap<string, number>>;

/**
 * A reading key that ignores 儿化, which is a suffix rather than a reading.
 */
function readingKey(syllable: Syllable): string {
  return `${syllable.initial}|${syllable.final}|${String(syllable.tone)}`;
}

/**
 * One reading per word, resolved the way the merge resolves it.
 *
 * The phrase corpus leads and CC-CEDICT fills its gaps, which is the precedence
 * the merge itself applies. Taking both would let a word CC-CEDICT lists under
 * several senses vote several times, and vote for readings the dictionary does
 * not give it: 重点 is `zhòngdiǎn` in the dictionary, and counting every
 * CC-CEDICT sense would have it also vote for `chóng`.
 */
function readingsByWord(
  sources: MassSources,
): ReadonlyMap<string, readonly string[]> {
  const readings = new Map<string, readonly string[]>();
  for (const entry of sources.cedict) {
    if (!readings.has(entry.simplified)) {
      readings.set(entry.simplified, entry.readings);
    }
  }
  for (const [word, reading] of sources.phrase) {
    readings.set(word, reading);
  }
  return readings;
}

/**
 * Count how much of jieba's corpus each reading of each character carries.
 *
 * Every word the dictionary knows votes for the reading it gives each of its
 * characters, weighted by how often jieba's corpus saw that word. It is the one
 * piece of evidence about a polyphone that is neither a lexicographer's pick nor
 * a dictionary's page order: 行 is `xíng` because 进行, 行政 and 行为 outweigh
 * 行业 and 银行, and nothing had to say so.
 *
 * **Single characters do not vote.** A one-character entry's reading *is* the
 * default being ranked — it comes from Unihan, or from a source that picked one
 * reading for the character — so counting it would have the ranking confirm
 * itself. Only a word puts a character in a context that chose between its
 * readings.
 *
 * **繁體 is counted through the script pairing.** jieba's corpus is 简体 and the
 * phrase corpus is 简体, so a traditional character appears in none of the words
 * counted here and would rank on nothing at all. Each vote is therefore also
 * cast for whichever 繁體 form the word's reading picks — 髮 gets 头发's `fà` and
 * 發 gets 发送's `fā` — which is the same evidence reaching the same character
 * under the other script.
 */
export function countCorpusMass(
  sources: MassSources,
  traditional: TraditionalTable,
): CorpusMass {
  const mass = new Map<string, Map<string, number>>();

  const cast = (character: string, key: string, weight: number): void => {
    const byReading = mass.get(character) ?? new Map<string, number>();
    byReading.set(key, (byReading.get(key) ?? 0) + weight);
    mass.set(character, byReading);
  };

  for (const [word, reading] of readingsByWord(sources)) {
    const weight = sources.jieba.get(word)?.frequency ?? 0;
    if (weight <= 0 || toCharacters(word).length < 2) {
      continue;
    }
    const aligned = readAlignedReading(word, reading);
    if (aligned === undefined) {
      continue;
    }
    for (const read of aligned) {
      // Punctuation is written and unread, and so votes for nothing.
      if (read.syllable === undefined) {
        continue;
      }
      // A syllable covering two characters — 儿化 — reads the first of them and
      // says nothing about the second, which is the same rule the 繁體
      // derivation applies to the same alignment.
      const character = toCharacters(read.characters)[0];
      /* c8 ignore next -- an aligned group always names at least one character */
      if (character === undefined) {
        continue;
      }
      const key = readingKey(read.syllable);
      cast(character, key, weight);
      const hant = traditional.convertCharacter(character, read.syllable);
      if (hant !== character) {
        cast(hant, key, weight);
      }
    }
  }

  return mass;
}

/**
 * The mass each reading is ranked on, with a leading 轻声 held in place.
 *
 * A 轻声 the fields put ahead of every full-tone reading ranks on the mass of
 * whichever reading carries the most, so the corpus can reorder the readings
 * behind it but never take the default away from it.
 *
 * 轻声 is the unstressed reading — a 语气词, a suffix, the second half of a
 * reduplication — and unstressed is precisely the use this mass cannot see. It
 * counts a character only inside the words the dictionary holds, and a particle
 * spends its life on the end of a sentence rather than inside a word: every
 * occurrence of 吧 the corpus can reach is 酒吧, 网吧 or 吧台, so `bā` carries
 * 1027 of it and the `ba` that ends four sentences in five carries 225. The
 * sources are not silent about that reading — `kMandarin` names `ba` and
 * `kHanyuPinlu` counted it 2073 times — they say it about the bare character,
 * which is the one place a word cannot vote.
 *
 * Only a 轻声 the fields already lead with is held, and only against being
 * displaced. Where the corpus reaches a neutral reading the fields rank lower
 * it still promotes it — 蔔 takes 萝卜's `bo` over `bó` — and where they lead
 * with a full tone it ranks the readings as it finds them: 哩 is `lī` in
 * `kMandarin`, and the corpus is free to prefer the `lǐ` of 哩程 and 平方哩.
 */
function rankingMass(
  readings: readonly Syllable[],
  massOf: (syllable: Syllable) => number,
): readonly { readonly syllable: Syllable; mass: number }[] {
  const ranked = readings.map((syllable) => ({
    syllable,
    mass: massOf(syllable),
  }));
  const heaviest = Math.max(0, ...ranked.map((reading) => reading.mass));
  for (const reading of ranked) {
    if (reading.syllable.tone !== NEUTRAL_TONE) {
      break;
    }
    reading.mass = heaviest;
  }
  return ranked;
}

/**
 * Re-rank one character's readings by how much corpus each carries.
 *
 * The sort is stable and the mass of an unseen reading is zero, so a character
 * no word covers keeps Unihan's order exactly, and so does the tail of readings
 * below the ones words attest. The corpus only ever reorders what it has
 * evidence about, and never past a leading 轻声 — see {@link rankingMass}.
 *
 * **Only where `kHanyuPinlu` did not already rank the character**, which is the
 * whole of what this instrument is for. `kMandarin` names one reading and orders
 * nothing, so where it decides the default there is nothing behind it, and that
 * is what the corpus supplies. Where `kHanyuPinlu` lists several readings there
 * already is a corpus ranking, and it is the better one: **this mass counts a
 * character only inside words, so a reading used mostly as a bare character is
 * invisible to it.** 呢 is 呢子 and 呢绒 in the dictionary and 呢 on the end of a
 * question everywhere else; 都 is 首都 and 都市 against a bare 都 that is simply
 * `dōu`; 将, 与, 处, 喝, 蒙 and 吗 are the same shape. `kHanyuPinlu` counts
 * occurrences rather than words and has seen exactly what this cannot.
 *
 * Measured over CPP, that division is the whole difference between the rule
 * paying and not: where `kHanyuPinlu` is silent or alone the mass fixes 438 and
 * breaks 256, and where it ranks the character it fixes 201 and breaks 263.
 */
export function rankByCorpusMass(
  character: string,
  readings: readonly Syllable[],
  fields: ReadonlyMap<ReadingField, readonly string[]>,
  mass: CorpusMass,
): readonly Syllable[] {
  const byReading = mass.get(character);
  if (byReading === undefined || isFrequencyRanked(fields)) {
    return readings;
  }
  const ranking = rankingMass(
    readings,
    (syllable) => byReading.get(readingKey(syllable)) ?? 0,
  );
  return ranking
    .toSorted((left, right) => right.mass - left.mass)
    .map((ranked) => ranked.syllable);
}
