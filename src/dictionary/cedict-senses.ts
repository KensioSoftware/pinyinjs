/**
 * Reading CC-CEDICT: indexing its entries, and telling its senses apart.
 *
 * CC-CEDICT gives a word one entry per pronunciation and keys each under both
 * scripts, so getting anything out of it means first deciding which entries
 * describe the word in hand and which describe a different one written alike.
 */
import { isSingleCharacter } from "../script/characters.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { Syllable } from "../syllable/syllable.js";
import { isSameReading } from "./entry.js";
import { readDictionaryReading } from "./reading.js";

/**
 * Whether a phrase-corpus headword is really the 繁體 spelling of another word.
 *
 * `large_pinyin.txt` is a 简体 corpus, and where it carries a 繁體 headword
 * anyway it has read it as though the characters were 简体: 特徵 is `tè zhǐ`
 * there because 徵 alone is `zhǐ`, 沈溺 is `shěn nì` because 沈 alone is the
 * surname, 蝨子 is `shī zǐ`, 纔然 is `shān rán`. Every one of those is a word
 * whose 简体 form the corpus also carries, correctly.
 *
 * Left in, each becomes an entry of its own that outranks the 繁體 key the
 * derivation would have hung on the 简体 entry, so the word reads one way in a
 * tier holding the phrase tail and another way in a tier without it.
 *
 * So the corpus is held to its own contract: a headword CC-CEDICT knows only as
 * the 繁體 spelling of a different 简体 word contributes no entry, and the word
 * keeps the reading CC-CEDICT pairs it with. It is 72 headwords, 13 of which
 * the corpus reads wrongly; the other 59 arrive at the same reading either way.
 *
 * Narrow on purpose. 2,854 corpus headwords contain a 繁體-only character and
 * only these 72 are ones CC-CEDICT pairs — the rest are rare or mixed-script
 * words whose characters do read them, and dropping those would lose coverage
 * to fix nothing.
 */
export function isSpeltTraditionally(
  word: string,
  byWord: ReadonlyMap<string, readonly CedictEntry[]>,
  byHant: ReadonlyMap<string, readonly CedictEntry[]>,
): boolean {
  if (byWord.has(word)) {
    return false;
  }
  return (byHant.get(word) ?? []).some(
    (entry) => entry.simplified !== entry.traditional,
  );
}

/**
 * CC-CEDICT's entries for a word, keyed by one of its two written forms.
 */
export function indexCedict(
  cedict: readonly CedictEntry[],
  formOf: (entry: CedictEntry) => string,
): ReadonlyMap<string, readonly CedictEntry[]> {
  const byWord = new Map<string, CedictEntry[]>();
  for (const entry of cedict) {
    const form = formOf(entry);
    const existing = byWord.get(form);
    if (existing === undefined) {
      byWord.set(form, [entry]);
    } else {
      existing.push(entry);
    }
  }
  return byWord;
}

/**
 * A word's readings as CC-CEDICT gives them, one per sense.
 */
export function cedictReadingsOf(
  word: string,
  entries: readonly CedictEntry[],
): readonly (readonly Syllable[])[] {
  return entries
    .map((entry) => readDictionaryReading(word, entry.readings))
    .filter((reading) => reading !== undefined);
}

/**
 * Whether a proposed 國語 reading is really another 普通话 sense of the word.
 *
 * The test that separates a locale shift from a sense selection, which the
 * sources write the same way and mean differently. 地 is offered `dì` against a
 * 普通话 `de` — but CC-CEDICT lists 地[de5] and 地[di4] as two entries, so `dì`
 * is what 地 reads in 普通话 when it means the ground, not what 國語 does to the
 * particle. The adverbial 地 is `de` in Taipei too, and 4,240 entries end in it.
 * 都 is the same shape, and so are 着, 应, 差, 称, 斗, 舍, 薄 and 万.
 *
 * A genuine delta leaves no such trace: nothing in 普通话 reads 和 as `hàn`, 期
 * as `qí` or 垃 as `lè`, which is why those survive this and 71 characters and
 * 3 words do not.
 *
 * Only CC-CEDICT is consulted. Unihan's reading fields carry rare and historical
 * pronunciations alongside current ones — 驯 is listed `xún` somewhere in them —
 * and a reading no one uses today is not evidence that a source meant a sense
 * rather than a locale.
 */
export function isOwnSense(
  taiwan: readonly Syllable[],
  senseReadings: readonly (readonly Syllable[])[],
): boolean {
  return senseReadings.some((sense) => isSameReading(sense, taiwan));
}

/**
 * Whether a character's `Taiwan pr.` note describes one sense rather than the
 * character.
 *
 * The other half of the sense test, and the one {@link isOwnSense} cannot do.
 * That test asks whether the offered reading is a 普通话 sense of the word; this
 * asks whether the note was ever about the whole word to begin with. 從's
 * `Taiwan pr. [zong4]` sits on three of its eight senses — 侍從, 從兄弟, 從犯 —
 * and 教育部's dictionary agrees with CC-CEDICT about which: 跟隨, 依順, 參與 and
 * the preposition are `cóng` in Taipei exactly as they are in Beijing. Applying
 * it to the headword made 我从北京来 read `wǒ zòng Běijīng lái`. 會 (`huǐ`, only
 * 一會兒), 勞 (`lào`, only 慰勞) and 燥 (`sào`, only 肉燥) are the same shape.
 *
 * A note the entry leads with is kept, because the leading sense is what the
 * character means with nothing to narrow it: 和's `hàn` is on the conjunction,
 * which is what a bare 和 almost always is.
 *
 * **Only a character is tested this way.** Its entry is what every occurrence
 * no longer word covers falls back to, so it has to carry the reading that
 * survives out of context; a multi-character headword is reached only where
 * that exact word is written. Four of them carry an inline note — 相親, 載具,
 * 高挑 and 樂色 — and only 相親 has senses that differ, its dominant one being
 * the matchmaking sense that really is `xiàngqīn`.
 */
export function isSenseScopedNote(
  word: string,
  sense: CedictEntry | undefined,
): boolean {
  return sense?.taiwanScope === "sense" && isSingleCharacter(word);
}
