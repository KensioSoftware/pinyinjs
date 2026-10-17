import { readSyllable, type Syllable } from "../syllable/syllable.js";

/**
 * A character whose reading as a word of its own is not the one it leads with.
 */
export interface FreeReading {
  /** The character, in either script. */
  readonly character: string;
  /** The reading it takes standing alone, as tone-marked pinyin. */
  readonly reading: string;
  /** The words that carry the other reading, which is why the sources rank it
   * first. */
  readonly displaces: string;
}

/**
 * Characters that read one way inside words and another standing alone.
 *
 * A character's default is ranked by `kHanyuPinlu` where it lists several
 * readings and by the corpus mass of the dictionary's words where it does not,
 * and both count the character *inside words*. That is the right evidence for
 * most polyphones and the wrong evidence for these, which have a literary
 * reading in their compounds and an everyday one as a free verb or classifier.
 * 剥削, 剥夺 and 剥落 give 剥 `bō`, and a reader peeling an orange says `bāo`.
 * `kHanyuPinlu` counts 切 `qiè` 998 times against `qiē` 70, nearly all of it
 * 一切, and 切土豆 is `qiē`.
 *
 * The compounds are dictionary words and keep their own readings. The default
 * is what a character segmented on its own is read with, which is where these
 * stand as free words, and what an unknown compound is derived from.
 *
 * **What is listed here.** A character whose 现代汉语词典 entry gives the listed
 * reading to its free use and the other to its compounds or a literary sense,
 * found by reading example sentences rather than by a measure. CPP labels
 * news text, where these characters mostly sit inside words, so it is the check
 * that nothing broke rather than the evidence for the list. What is *not*
 * listed is a character whose free uses split, such as 卡 (a card, `kǎ`, and
 * stuck, `qiǎ`) or 背 (the back and to recite, `bèi`, and to carry, `bēi`): a
 * default cannot choose between two free words, and a context rule can. Nor
 * is a character that names and transliterations use on its own: 勒 is `lēi`
 * in 勒得难受 and `lè` in every 希特勒 and 达勒姆 the dictionary lacks, and 盛 is
 * `chéng` in 盛汤 and the surname `Shèng` in 刘盛. Listing either cost CPP 25
 * and 7 cases.
 *
 * **The reading must be one the sources already give the character.** It is
 * moved to the front of the ranking rather than written over it, so a source
 * refresh that dropped it would fail the build rather than leave a reading
 * nothing attests. That is why 剝 and 掙 are missing beside 剥 and 挣: Unihan
 * gives them `bō` and `zhēng` alone.
 */
export const FREE_READINGS: readonly FreeReading[] = [
  { character: "幢", reading: "zhuàng", displaces: "幢幢 and 经幢, a banner" },
  { character: "抡", reading: "lūn", displaces: "抡材 and 抡元, to select" },
  { character: "掄", reading: "lūn", displaces: "掄材 and 掄元, to select" },
  { character: "剥", reading: "bāo", displaces: "剥削, 剥夺 and 剥落" },
  { character: "削", reading: "xiāo", displaces: "削弱, 削减 and 剥削" },
  { character: "铺", reading: "pū", displaces: "店铺 and 床铺, the noun" },
  { character: "鋪", reading: "pū", displaces: "店鋪 and 床鋪, the noun" },
  { character: "咳", reading: "ké", displaces: "the interjection hāi" },
  { character: "哄", reading: "hǒng", displaces: "哄堂 and 哄抢, an uproar" },
  { character: "刨", reading: "páo", displaces: "刨床 and 刨子, a plane" },
  { character: "攒", reading: "zǎn", displaces: "攒聚 and 攒眉, to gather" },
  { character: "攢", reading: "zǎn", displaces: "攢聚 and 攢眉, to gather" },
  { character: "绷", reading: "bēng", displaces: "绷着脸, a stiff face" },
  { character: "繃", reading: "bēng", displaces: "繃著臉, a stiff face" },
  { character: "翘", reading: "qiào", displaces: "翘首 and 翘楚" },
  { character: "翹", reading: "qiào", displaces: "翹首 and 翹楚" },
  { character: "划", reading: "huá", displaces: "计划, 划分 and 规划" },
  { character: "劃", reading: "huá", displaces: "計劃, 劃分 and 規劃" },
  { character: "曲", reading: "qǔ", displaces: "曲线, 弯曲 and 曲折" },
  { character: "切", reading: "qiē", displaces: "一切, 亲切 and 切实" },
  { character: "嚼", reading: "jiáo", displaces: "咀嚼, the literary word" },
  { character: "倔", reading: "juè", displaces: "倔强 and 倔犟" },
  { character: "脏", reading: "zāng", displaces: "心脏 and 内脏, an organ" },
  { character: "挣", reading: "zhèng", displaces: "挣扎, to struggle" },
  { character: "漂", reading: "piāo", displaces: "漂亮 and 漂白" },
];

/**
 * Read a free reading into a syllable, throwing if it is not one.
 *
 * Throwing for the reason {@link import("./overrides.js").readOverrideReading}
 * does: an entry that failed to parse would leave the ranking it was written
 * to correct, and nothing would notice.
 */
export function freeSyllable(free: FreeReading): Syllable {
  const syllable = readSyllable(free.reading);
  if (syllable?.tone === undefined) {
    throw new Error(
      `free reading for ${free.character} is not a reading: ${free.reading}`,
    );
  }
  return syllable;
}

/**
 * The table, keyed by character and parsed into syllables.
 */
export const FREE_SYLLABLES: ReadonlyMap<string, Syllable> = new Map(
  FREE_READINGS.map((free) => [free.character, freeSyllable(free)]),
);

/**
 * Whether two syllables are the same reading, 儿化 aside.
 */
function sameReading(left: Syllable, right: Syllable): boolean {
  return (
    left.initial === right.initial &&
    left.final === right.final &&
    left.tone === right.tone
  );
}

/**
 * Lead a character's ranked readings with its free reading, where it has one.
 *
 * The rest keep the order the ranking gave them. A listed reading the ranking
 * does not hold throws, which is the build failing on a source that stopped
 * attesting it.
 */
export function leadWithFreeReading(
  character: string,
  ranked: readonly Syllable[],
): readonly Syllable[] {
  const free = FREE_SYLLABLES.get(character);
  if (free === undefined) {
    return ranked;
  }
  const lead = ranked.find((syllable) => sameReading(syllable, free));
  if (lead === undefined) {
    throw new Error(
      `free reading for ${character} is not one the sources give it`,
    );
  }
  return [lead, ...ranked.filter((syllable) => syllable !== lead)];
}
