/**
 * The readings of 教育部's two dictionaries of the 國語 standard,
 * 《國語辭典簡編本》 and 《重編國語辭典修訂本》.
 *
 * Read from the table `moe-workbook.ts` takes out of each download, which holds
 * a headword, the order of its readings, its 漢語拼音 and any variant reading,
 * and nothing of the dictionaries' own text. See docs/dictionaries for why the
 * readings alone are taken and what the licence says about them.
 */
import { isSingleCharacter } from "../script/characters.js";
import { readSyllable } from "../syllable/syllable.js";
import { ERHUA_TOKEN } from "../dictionary/reading.js";

/**
 * Which of 教育部's two dictionaries a reading comes from.
 *
 * `concise` is 《國語辭典簡編本》, which describes current usage, and
 * `revised` is 《重編國語辭典修訂本》, which adds the literary and historical.
 */
export type MoeDictionary = "concise" | "revised";

/**
 * One reading 教育部 gives a headword.
 */
export interface MoeReading {
  readonly dictionary: MoeDictionary;
  /**
   * Where the reading stands among the headword's readings.
   *
   * 0 for a headword with one reading. A headword with several numbers them
   * from 1, and 1 is the reading the dictionary lists first: 和 is `hé` at 1
   * and `hàn` at 5, 期 `qí` at 1 and `qī` at 2.
   */
  readonly order: number;
  /**
   * The reading as tokens {@link import("../dictionary/reading.js").readAlignedReading}
   * accepts, one per syllable, with 儿化 split off as its own `r5` token.
   */
  readonly readings: readonly string[];
  /**
   * A second reading the dictionary gives the same entry, where it gives one.
   *
   * Only the kinds that are readings of the word: 又音, an alternative, and
   * the 語音 and 讀音 pair of colloquial and literary readings. 變, which
   * records a tone change in connected speech such as 一 before a fourth tone,
   * is left out, since the merge stores tones before sandhi.
   */
  readonly variant?: readonly string[];
}

/**
 * Split a reading into the tokens the merge aligns against a headword.
 *
 * 教育部 writes 儿化 on the syllable, as `yī huǐr` for 一會兒, where the merge
 * expects CC-CEDICT's shape of a syllable followed by `r5`. A syllable that
 * reads as 儿化 is split back into that shape, which leaves 兒 with a token to
 * account for it; `ér` and `èr` are syllables of their own and stay whole.
 */
function tokensOf(pinyin: string): readonly string[] {
  return pinyin
    .split(" ")
    .filter((token) => token !== "")
    .flatMap((token) =>
      readSyllable(token)?.erhua === true
        ? [token.slice(0, -1), ERHUA_TOKEN]
        : [token],
    );
}

/**
 * Read the table {@link tabulateMoeWorkbook} writes, keyed by headword.
 *
 * Headwords are 繁體, as Taiwan writes them. A headword's readings come back
 * in the dictionary's own order.
 */
export function parseMoeReadings(
  text: string,
  dictionary: MoeDictionary,
): ReadonlyMap<string, readonly MoeReading[]> {
  const readings = new Map<string, MoeReading[]>();
  for (const line of text.split("\n")) {
    const [word = "", order = "", pinyin = "", variant = ""] = line.split("\t");
    if (word === "" || pinyin === "") {
      continue;
    }
    const headword = word.normalize("NFC");
    const listed = readings.get(headword) ?? [];
    listed.push({
      dictionary,
      order: Number(order) || 0,
      readings: tokensOf(pinyin),
      ...(variant !== "" && { variant: tokensOf(variant) }),
    });
    readings.set(headword, listed);
  }
  for (const listed of readings.values()) {
    listed.sort((left, right) => left.order - right.order);
  }
  return readings;
}

/**
 * Two dictionaries' readings as one.
 *
 * 《國語辭典簡編本》 is the one that describes current usage, and for a word
 * both list it wins. 《重編國語辭典修訂本》 is four times its size and records
 * the literary and historical readings too, so where the two list a word it is
 * often the older one that the larger dictionary leads with: 玩 is `wàn` there
 * before `wán`, 鹽 `yàn` before `yán`, and 它們 is `tuō men`. Only the words
 * the concise dictionary leaves out are taken from it.
 *
 * A character keeps the readings of both, the concise dictionary's first.
 * The merge only ever asks whether a character's reading is listed, and the
 * concise dictionary leaves out some current ones: it has no 差 `chà`.
 */
export function preferReadings(
  first: ReadonlyMap<string, readonly MoeReading[]>,
  second: ReadonlyMap<string, readonly MoeReading[]>,
): ReadonlyMap<string, readonly MoeReading[]> {
  const merged = new Map(second);
  for (const [word, readings] of first) {
    const extra = isSingleCharacter(word) ? (second.get(word) ?? []) : [];
    merged.set(word, [...readings, ...extra]);
  }
  return merged;
}
