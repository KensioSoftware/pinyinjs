import type { JiebaEntry } from "../sources/jieba.js";

/**
 * Given names no source lists, with the reading each takes, as the phrase
 * corpus writes one.
 *
 * jieba lists a scattering of given names and counts some of them (文华 1,074
 * times, 建华 342, 志强 15), and CC-CEDICT lists almost none. One the sources
 * lack decodes a character at a time, and each character is capitalised only
 * where it happens to be tagged as a name of its own. 文东 came out `Wén Dōng`,
 * read as the place 东, and 小美的妈妈 came out `Xiǎo Měidí māma`, with 美的
 * the company Midea taking the 美 from the name and reading the 的 `dí`.
 *
 * These are the given names of the recurring characters in Chinese Boost's
 * graded reading, where each was read in its passages. Only the 简体 is
 * listed. The merge carries each name to its 繁體 key, and listing 國興 as a
 * word of its own put a 國興 → 國興 exception into the script tables. A name here is never a
 * family name and a given name: GB/T 16159 joins the syllables of a given
 * name, and the whole entry is the given name.
 *
 * 新雨 and 爱雪 are given names in the same series and are left out. Each is
 * also two words that sit side by side in ordinary text, 一场新雨 *a fresh
 * rain* and 我爱雪 *I love snow*, and entered as names they took both.
 *
 * **Keep this small.** A name joins the list when a text that needs it is
 * found, the same way {@link import("./kept-names.js").KEPT_NAMES} grows.
 */
export const GIVEN_NAMES: ReadonlyMap<string, readonly string[]> = new Map([
  ["子明", ["zǐ", "míng"]],
  ["文东", ["wén", "dōng"]],
  ["小美", ["xiǎo", "měi"]],
  ["国兴", ["guó", "xīng"]],
  ["艾琳", ["ài", "lín"]],
  ["拉胡尔", ["lā", "hú", "ěr"]],
]);

/**
 * The count a listed given name is entered at.
 *
 * jieba's own default for a word it lists and cannot count is 3
 * ({@link import("./frequency-table.js").UNCOUNTED_NAME}), and that is not
 * enough here. It costs 17.62, and 小 and 美 together cost 16.24, so the name
 * would still come apart. 100 is within the range jieba counts the given names
 * it does list, and puts a name in bucket 5, at 14.62. 小美 then holds against
 * 小 + 美的, and 美国兴起 still reads 美国 兴起.
 */
export const GIVEN_NAME_COUNT = 100;

/**
 * jieba's entries with the listed given names entered as names.
 *
 * A name jieba already lists takes the person tag and keeps the larger of the
 * two counts. jieba lists 国兴 as `b`, a distinguishing word, ten times.
 */
export function withGivenNames(
  jieba: ReadonlyMap<string, JiebaEntry>,
  names: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, JiebaEntry> {
  if (names.size === 0) {
    return jieba;
  }
  const entered = new Map(jieba);
  for (const name of names.keys()) {
    const listed = jieba.get(name)?.frequency ?? 0;
    entered.set(name, {
      frequency: Math.max(listed, GIVEN_NAME_COUNT),
      partOfSpeech: "nr",
    });
  }
  return entered;
}
