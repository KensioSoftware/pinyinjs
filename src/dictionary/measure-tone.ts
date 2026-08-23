/**
 * Settling the tone of 个, which no source settles for itself.
 *
 * Every source writes 个 both ways, and where one writes the 轻声 it is a
 * choice made an entry at a time. CC-CEDICT has 一个 `ge5` beside 一个人 `ge4`,
 * 那个 `ge5` beside 那个人 `ge4`, 上个 `ge5` beside 上个月 `ge4`, and 每个 `ge4`
 * beside 每个人 `ge5`. large_pinyin wanders the same way over 半个 and 半个人,
 * and over 这个 and 这些个. No reading of sense separates them, because there is
 * no difference of sense to read: 那个人 is 那个 followed by 人.
 *
 * The sources do agree on the proportion. The full tone is the large majority in
 * all three. 现代汉语频率词典 counts 个 as `gè` 11,693 times against `ge` 1,891
 * (Unihan's `kHanyuPinlu`), large_pinyin writes 243 against 36, and CC-CEDICT
 * 102 against 45. So the package writes the tone and names the exception.
 *
 * **A numeral in front of it means the 量词 is counting**, and a counting 个 is
 * written `gè`: 一个, 两个, 十二个, 一百个, and 一个人 and 上一个 with them.
 * This is what the gold corpus already asserts for every 个 it holds, and what
 * the 一个 override used to state on its own.
 *
 * **The exception is the determiners.** 这个, 那个 and 哪个 are headwords in
 * 现代汉语词典 read `zhège`, `nàge` and `nǎge`, and both sources write them 轻声
 * wherever the pair stands on its own. 每个, 上个 and 下个 are the same
 * determiner shape and the sources split on them by length: CC-CEDICT has 上个
 * `ge5` beside 上个月 `ge4`, and 每个 `ge4` beside 每个人 `ge5`. The 轻声 is taken
 * for all six, which is what 那个人, 每个人 and 上个月 are said with.
 *
 * Everything else keeps the reading its source gave it. 几个, 半个, 多个 and
 * 单个 have neither a numeral nor a listed determiner in front of them, so their
 * 轻声 stands. So does the colloquial 个 of 我勒个去 and 一口吃个胖子, which
 * counts nothing, and the 北京话 今儿个, 明儿个 and 昨儿个, whose 儿 folds into
 * the syllable before it and leaves the reading shorter than the key.
 *
 * Measured over the committed dictionary it retones 25 entries of the 279 that
 * hold a 个. Over the 88,866 lines of Tatoeba and zh.wikipedia the reading
 * rules were sized against it moves 339 conversions, and every one is a 个:
 * 每个 106, 那个 63, 下个月 and 下个星期 62, 上个月 and 上个星期 60, and 35
 * where 一个 gains its tone and the 一 sandhi that follows from it. Before the
 * pass, 2,467 of the corpus's 5,397 个 sat after a character the package read
 * both ways; after it, 204 do, and all of those are positions no key covers,
 * where the decode falls back to the character's own `gè`.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * The 量词 this settles, in both scripts.
 */
const MEASURE_CHARACTERS: ReadonlySet<string> = new Set(["个", "個"]);

/**
 * The tone a counting 个 carries.
 */
const COUNTING_TONE = 4 satisfies Tone;

/**
 * The determiners that take 个 into a word of their own, where it is 轻声.
 *
 * Six characters and not a part of speech, because the tag cannot draw the
 * line. jieba tags 这个, 那个 and 每个 `r` and tags 各个, 某个 and 整个 `r` as
 * well, and those three are `gègè`, `mǒugè` and `zhěnggè` in both sources with
 * nothing disagreeing. So this is a list of judgements, in the way
 * {@link import("./neutral-senses.js").NEUTRAL_SENSE_WORDS} is, and the words
 * it decides are the ones where a source writes the 轻声 on the determiner and
 * the pair together.
 */
export const NEUTRAL_MEASURE_DETERMINERS: ReadonlySet<string> = new Set([
  "这",
  "這",
  "那",
  "哪",
  "每",
  "上",
  "下",
]);

/**
 * Whether a syllable is the 量词 rather than 个's other reading.
 *
 * 独自个 is `dú zì gě`, and a `gě` retoned to `gè` would be a different word.
 * Testing the syllable keeps it out without a list of the words it appears in.
 */
function isCountingSyllable(syllable: Syllable): boolean {
  return (
    syllable.initial === "g" &&
    syllable.final === "e" &&
    (syllable.tone === COUNTING_TONE || syllable.tone === NEUTRAL_TONE)
  );
}

/**
 * The tone the 个 at a position takes, or undefined where nothing settles it.
 */
export function countingToneAt(
  characters: readonly string[],
  at: number,
): Tone | undefined {
  // Nothing stands in front of a 个 that starts the word, and nothing settles
  // it there: 个人 is `gèrén` on its own account.
  const before = characters[at - 1] ?? "";
  if (NEUTRAL_MEASURE_DETERMINERS.has(before)) {
    return NEUTRAL_TONE;
  }
  return QUANTITY_CHARACTERS.has(before) ? COUNTING_TONE : undefined;
}

/**
 * What the settling pass changed.
 */
export interface MeasureToneSettlement {
  readonly entries: readonly DictionaryEntry[];
  /** Entries whose 个 was retoned. */
  readonly settled: number;
}

/**
 * Give every 个 the tone its position calls for.
 *
 * Runs over the finished entries, before the constituent repair, so that a
 * phrase held to the words inside it is held to a settled reading. Only the
 * 普通话 reading is touched. A zh-TW delta is a claim about how 國語 differs
 * from what stands beside it, and none of the 279 entries holding a 个 has one.
 */
export function settleMeasureTones(
  entries: readonly DictionaryEntry[],
): MeasureToneSettlement {
  let settled = 0;

  const settle = (entry: DictionaryEntry): DictionaryEntry => {
    const characters = toCharacters(entry.hans);
    const reading = entry.readings.cn;
    // 儿化 folds two characters into one syllable, so a reading shorter than
    // the word says nothing about which character each syllable reads.
    if (reading.length !== characters.length) {
      return entry;
    }

    const corrected = [...reading];
    let isMoved = false;
    for (const [at, syllable] of reading.entries()) {
      if (
        /* c8 ignore next -- the reading and the characters are the same length */
        !MEASURE_CHARACTERS.has(characters[at] ?? "") ||
        !isCountingSyllable(syllable)
      ) {
        continue;
      }
      const tone = countingToneAt(characters, at);
      if (tone === undefined || syllable.tone === tone) {
        continue;
      }
      corrected[at] = { ...syllable, tone };
      isMoved = true;
    }

    if (!isMoved) {
      return entry;
    }
    settled++;
    return { ...entry, readings: { ...entry.readings, cn: corrected } };
  };

  return { entries: entries.map((entry) => settle(entry)), settled };
}
