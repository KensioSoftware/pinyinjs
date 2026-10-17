/**
 * Whether a pair nobody counted may read a function word its rare way.
 *
 * The reading decode prices a word by the edge, so a pair the dictionary holds
 * beats the same two characters read apart whatever the pair says about them.
 * Some pairs are a sense the language barely uses, held by a source and
 * counted by no corpus, and they turn a common function word into its rare
 * reading.
 */
import { costOfBucket } from "../dictionary/frequency-table.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { isOnSide, RARE_READINGS } from "./dominant-readings.js";
import {
  type EdgeContext,
  type EdgeRule,
  startsLongerWord,
  tagOf,
  wordStartingAt,
} from "./rules.js";

/**
 * The highest frequency bucket a word nobody counted lands in.
 *
 * A key jieba never listed has a count of zero and lands in bucket 0. A key
 * jieba lists without counting carries its default of 3, and bucket 2 runs
 * from 3 to 8. {@link import("../dictionary/frequency-table.js").UNCOUNTED_NAME}
 * gives a name the same default.
 */
const UNCOUNTED_BUCKET = 2;

/**
 * What an edge in {@link UNCOUNTED_BUCKET} costs. Rarer edges cost more.
 */
const UNCOUNTED_COST = costOfBucket(UNCOUNTED_BUCKET);

/**
 * Whether two syllables are the same reading, tone and all.
 */
function isSame(left: Syllable, right: Syllable | undefined): boolean {
  return (
    right !== undefined &&
    left.initial === right.initial &&
    left.final === right.final &&
    left.tone === right.tone
  );
}

/**
 * The tag prefix jieba gives a noun.
 */
const NOUN_TAG = "n";

/**
 * Whether a pair ending in 都 is a capital's name where it stands.
 *
 * 都 is `dū` at the end of a capital's name and `dōu` in front of what is said
 * of everything before it. A name ends the run (大家习惯把上海称为魔都) or
 * stands in front of a noun (金中都故城). The adverb has a predicate after it,
 * as in 书架上都是书 and 猫在黑暗中都是灰色的.
 */
function isCapital(context: EdgeContext): boolean {
  const { characters, edge } = context;
  return (
    edge.to === characters.length ||
    tagOf(context, wordStartingAt(context, edge.to)).startsWith(NOUN_TAG)
  );
}

/**
 * The tag prefix jieba gives a verb.
 */
const VERB_TAG = "v";

/**
 * Whether a pair opening with 更 is a compound of its own.
 *
 * 更 the adverb raises what follows it: 会更香, 更易使出, 更适用. 更 the verb
 * *to change* makes compounds with a verb beside it, and 更变 is one no corpus
 * counted. A bare verb after the 更 is the compound's second half. A verb
 * opening a longer word (适用) belongs to that word, and the 更 in front of it
 * is the adverb.
 */
function isGengCompound(context: EdgeContext): boolean {
  const { characters, edge } = context;
  const second = edge.from + 1;
  return (
    tagOf(context, characters[second]).startsWith(VERB_TAG) &&
    !startsLongerWord(context, second)
  );
}

/**
 * Whether a pair reads a function word its rare way on the word's own side.
 */
function readsRarely(
  context: EdgeContext,
  characters: readonly string[],
): boolean {
  return characters.some((character, index) => {
    const rare = RARE_READINGS.get(character);
    if (rare === undefined || !isOnSide(rare.side, index)) {
      return false;
    }
    if (
      (character === "都" && isCapital(context)) ||
      (character === "更" && isGengCompound(context))
    ) {
      return false;
    }
    return rare.readings.some((reading) =>
      isSame(reading, context.edge.reading[index]),
    );
  });
}

/**
 * A pair nobody counted that reads a function word its rare way is taken off
 * the lattice.
 *
 * The reading decode charges per edge, and that charge is what lets 地气 read
 * `dì qì` against the 地 and 气 around it. The charge is the same for a pair
 * no corpus counts. 破的 is CC-CEDICT's *to hit the target*, and it read
 * 气球胀得太大，会破的 as `huì pò dì`. 更香 is `large_pinyin.txt`'s incense
 * clock, 家给 is the 家给人足 of an idiom, 赚得 is that file's reading of a word
 * CC-CEDICT reads `zhuàn dé`, and 上都 and 中都 are the capitals of two
 * dynasties. Each sat in an everyday sentence and took its 的, 更, 给, 赚 or 都.
 *
 * Taking the edge away leaves each character to its own reading, which is the
 * usual one. A counted word keeps its reading (目的, 首都, 京都), and so does a
 * pair of more than two characters (知更鸟, 漫无目的地).
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia this changes 25 runs in the
 * full tier, and all 25 are corrections. Over both CPP splits it changes 32,
 * and two are wrong (官员俸给 and 北魏国都代郡). CPP's labelled accuracy holds
 * at 91.86%. The standard and core tiers hold none of these pairs.
 */
export const DOMINANT_READING: EdgeRule = {
  name: "dominant-reading",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    const characters = toCharacters(edge.text);
    if (
      characters.length !== 2 ||
      edge.reading.length !== characters.length ||
      edge.cost < UNCOUNTED_COST
    ) {
      return "keep";
    }
    return readsRarely(context, characters) ? "forbid" : "keep";
  },
};
