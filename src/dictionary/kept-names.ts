/**
 * The names jieba tags and CC-CEDICT lacks that a person has read as names.
 *
 * {@link import("./proper-noun.js").properNounOf} keeps the tag on such a word
 * only where its first character starts names, or where it opens with a word
 * CC-CEDICT capitalises. That took the capital off 小姑娘 and 老先生, and off a
 * few real names whose first character starts ordinary words: 长 (长岛), 静
 * (静安寺), 琵 (琵琶湖). These are the ones found when the two tests went in,
 * over the Chinese Boost 例句 and Tatoeba, and each was read in its sentences.
 *
 * Both writings are listed, since the merge settles each key on its own.
 */
export const KEPT_NAMES: ReadonlySet<string> = new Set([
  "长岛",
  "長島",
  "静安寺",
  "靜安寺",
  "琵琶湖",
  "祝英台",
  "维语",
  "維語",
  "金城",
  "豫园",
  "豫園",
  "明石",
  "高乃依",
  "希思罗",
  "希思羅",
  "比邻星",
  "比鄰星",
  "冰雪节",
  "冰雪節",
  "河阳",
  "河陽",
  "国华",
  "國華",
]);
