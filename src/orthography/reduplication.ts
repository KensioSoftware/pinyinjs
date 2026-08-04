import type { DecodedWord } from "../decode/word.js";
import { toCharacters } from "../script/characters.js";
import { type GroupingRule, hyphenate } from "./rule.js";

/**
 * Whether four characters repeat as AABB, with A and B different.
 *
 * 干干净净 and 高高兴兴 do; 一一得一 does not, and neither does a 叠字 name
 * like 丁丁 doubled, since A and B have to differ for there to be two halves.
 */
function isAabb(characters: readonly string[]): boolean {
  const [first, second, third, fourth] = characters;
  return (
    characters.length === 4 &&
    first === second &&
    third === fourth &&
    first !== third
  );
}

/**
 * The 重叠 hyphen inside a four-character AABB word.
 *
 * GB/T 16159 6.1.3 writes 干干净净 as `gāngān-jìngjìng`: one word, with the
 * boundary between its halves marked. The shape *is* the evidence — a
 * four-character word whose first two characters double and whose last two
 * double is a reduplication and essentially nothing else — so this needs no
 * tag, which matters given that two thirds of the dictionary carries none.
 *
 * Two conditions keep it honest, both sized against the whole dictionary. The
 * word must have reached the rule as **one** decoded word: 爸爸妈妈 and 哥哥姐姐
 * decode as two words each and are two words, `bàba māma`, not a reduplication
 * of 爸妈. And a proper noun is left alone, since a name that happens to be
 * shaped this way is not a reduplication of anything.
 *
 * Fires on 1,541 of the dictionary's 1,590 AABB keys; the 49 it holds back are
 * all jieba proper-noun tags that CC-CEDICT did not veto — 斯斯文文, 老老少少,
 * 正正经经 — which are mis-tagged rather than misjudged here, and are already
 * wrong in their capitals for the same reason.
 *
 * Over 711,000 decoded words of Tatoeba and zh.wikipedia it fires 66 times,
 * and all 66 are reduplications: 时时刻刻, 马马虎虎, 形形色色, 轰轰烈烈. What
 * it misses is the same shape arriving as two words — 43 spans, of which about
 * 16 are reduplications the decode happened to split (匆匆忙忙, 来来往往) and
 * the rest are 爸爸妈妈, 爷爷奶奶 and 爸爸刚刚, where joining would be wrong.
 * Nothing separates the two halves of that mixture: 匆匆 and 爸爸 are both
 * words, and so are 匆忙 and 爸妈.
 */
export const AABB_REDUPLICATION: GroupingRule = {
  name: "aabb-reduplication",
  apply: (words) =>
    words.flatMap((word) =>
      word.isProperNoun || !isAabb(toCharacters(word.text))
        ? [word]
        : hyphenate(word, 2),
    ),
};

/**
 * Whether two words are the same word repeated: 研究研究.
 *
 * Two characters each, because a one-character repeat is a different rule —
 * 看看 is `kànkan`, written solid with a neutral second syllable — and because
 * a repeated single character is as likely to be two separate words.
 *
 * Nothing is asked of the part of speech, which was measured rather than
 * assumed: excluding noun-tagged repeats removes three misfires — 战争 falling
 * either side of 克里米亚战争｜战争中, and 大象大象 addressing an elephant
 * twice — at the cost of four real reduplications, since jieba tags 商量,
 * 多谢 and 拜托 as nouns. Fewer right answers for a better-looking rule.
 */
function isRepeat(word: DecodedWord, previous: DecodedWord): boolean {
  return (
    word.text === previous.text &&
    word.isKnown &&
    !word.isProperNoun &&
    toCharacters(word.text).length === 2 &&
    word.separator === undefined
  );
}

/**
 * The 重叠 hyphen between a repeated two-character word: 研究研究.
 *
 * GB/T 16159 writes verb reduplication `yánjiū-yánjiū`, and this is the
 * productive half of 重叠: 研究研究 is not a dictionary entry and never will be,
 * so it arrives as two decoded words rather than as one word to be split.
 * Marking the second is all that is needed, and no reading changes.
 *
 * The ABAB words the dictionary *does* hold are deliberately not touched: they
 * decode as one word, and 50 keys are shaped this way with 哔哩哔哩 and
 * 达姆达姆 among them, where a hyphen would be asserting a reduplication that
 * is really a transliteration.
 *
 * Measured over the same 711,000 decoded words, it fires 54 times and is right
 * 46 of them — 休息休息, 一天一天, 考虑考虑, 好久好久. The eight misfires are
 * all one word ending a clause and the same word starting the next
 * (告诉我们｜我们在哪里, 不喜欢｜喜欢不问问题的), or a noun said twice to
 * address someone (大象大象). Nothing short of syntax separates those from
 * 讨论讨论, and the eight are a spacing error where all 54 were one before.
 */
export const ABAB_REDUPLICATION: GroupingRule = {
  name: "abab-reduplication",
  apply: (words) =>
    words.map((word, at) => {
      const previous = words[at - 1];
      return previous !== undefined && isRepeat(word, previous)
        ? { ...word, separator: "-" as const }
        : word;
    }),
};
