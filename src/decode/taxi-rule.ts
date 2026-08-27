/**
 * The taxi 的, which is `dī` and a word of its own rather than the particle.
 *
 * 的士, 的哥, 的姐, 打的, 面的 and 摩的 are six keys spelling the same
 * characters as a modifier, a particle 的 and a head. Kept apart from the two
 * rules about the particle itself, which are in `de-rule.ts`.
 */
import type { Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  type EdgeRule,
  endsLongerWord,
  startsLongerWord,
  tagOf,
  wordsStartingAt,
} from "./rules.js";

/**
 * Whether a syllable is `dī`, the reading 的 takes in the taxi vocabulary.
 */
function isDi(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "d" && syllable.final === "i" && syllable.tone === 1
  );
}

/**
 * What can follow a 的 that is the structural particle.
 *
 * A noun or a pronoun is the head the particle marks (打的电话, 所打的仗,
 * 见过面的那个人). An adjective or an adverb is the complement, where the 的
 * stands for a 得 (打的不是很好, 打的很好). None of the four can follow a taxi
 * word, which is a verb and its object already.
 */
const AFTER_PARTICLE = /^(?:n|r|a|d)/u;

/**
 * Where the taxi 的 sits in an edge, or undefined for every other edge.
 */
function taxiIn(edge: EdgeContext["edge"]): number | undefined {
  if (edge.to - edge.from !== 2 || edge.reading.length !== 2) {
    return undefined;
  }
  if (edge.text.startsWith("的") && isDi(edge.reading[0])) {
    return edge.from;
  }
  return edge.text.endsWith("的") && isDi(edge.reading[1])
    ? edge.from + 1
    : undefined;
}

/**
 * Whether the taxi key running from a position holds the 的 inside it.
 *
 * See {@link TAXI_DI} for what the two branches are asking.
 */
function holdsTaxi(context: EdgeContext, from: number, di: number): boolean {
  if (di === from) {
    return !startsLongerWord(context, di + 1);
  }
  return (
    !endsLongerWord(context, di) &&
    !wordsStartingAt(context, di + 1).some((word) =>
      AFTER_PARTICLE.test(tagOf(context, word)),
    )
  );
}

/**
 * Whether a standing taxi key covers the 的 at a position.
 *
 * Both keys are asked about, since the 的 can be either character of one: the
 * 的 of 打的士 opens 的士 and closes 打的.
 */
function isUnderTaxi(context: EdgeContext, at: number): boolean {
  const { characters, dictionary } = context;
  for (const from of [at - 1, at]) {
    const key = from < 0 ? "" : characters.slice(from, from + 2).join("");
    const reading = dictionary.lookup(key)?.reading;
    if (
      reading?.length === 2 &&
      isDi(reading[at - from]) &&
      holdsTaxi(context, from, at)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 的 read `dī` where the taxi word holding it stands, and written whole there.
 *
 * The taxi vocabulary is six keys (的士, 的哥, 的姐, 打的, 面的 and 摩的). The
 * `dī` in them is the only `dī` the dictionary holds, and that reading names
 * the set. All six also spell a modifier, a particle 的 and a head, much the
 * commoner reading of the same characters, and the decode had it both ways at
 * once. 我的哥哥们 came out `wǒ dī gēgē men` on the strength of 的哥, while
 * 的士 came out `dī shì` on the strength of nothing at all.
 *
 * What decides it is what follows the 的, and where the key sits around the 的
 * decides which question that is.
 *
 * A key **beginning** with the 的 offers its own second character as the head.
 * A longer word starting there is the better claim on it. 哥哥 takes the 哥 of
 * 我的哥哥们, 姐姐 the 姐 of 我的姐姐 and 士兵 the 士 of 我的士兵. Nothing
 * starts at the 哥 of 那个的哥 or the 士 of 我要一辆的士, and both keys stand.
 *
 * A key **ending** with the 的 puts the head outside itself, and
 * {@link AFTER_PARTICLE} is what one looks like. The other side is asked as
 * well. A longer word ending at the 的 owns the character in front of it, and
 * that is what 上面的, 方面的 and 表面的 are. Without that test 26 more runs of
 * the corpus change and every one of them is wrong.
 *
 * Where the word does stand the bare 的 is taken out from under it. That is the
 * spacing half of the same claim. 的 sits in the cheapest band the dictionary
 * holds, at 5.62 against a 4.62 floor. A two-character key spanning one is
 * therefore weighed against a split starting several buckets ahead of an
 * ordinary word's, and 的士 came apart at 16.62 against 16.24 for the split
 * where 的哥 at 14.62 held. Forbidding the split is what reaches spacing at
 * all, since forcing an edge only settles the rivals covering the same
 * characters.
 *
 * Measured over the 88,866 lines of Tatoeba and zh.wikipedia, 21 的 read `dī`
 * and 9 of them were the particle. This changes 17 runs. Six are readings it
 * corrects (所打的仗, 谁打的电话, 打的不是很好, 我的哥哥们, 我打的这辆出租车,
 * 见过面的那个人), ten are taxi words that were split and now hold together,
 * and the last is 用一元硬币来打的, which joins up while staying wrong. That
 * one closes a 是⋯的 whose 是 sits in the clause before it, and no local
 * evidence says so. The two others left are the 的哥里 of a transliterated
 * Gori. The gold corpus holds at 3 misses and CPP at 91.49%.
 */
export const TAXI_DI: EdgeRule = {
  name: "taxi-di",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.text === "的") {
      return isUnderTaxi(context, edge.from) ? "forbid" : "keep";
    }
    const di = taxiIn(edge);
    return di !== undefined && !holdsTaxi(context, edge.from, di)
      ? "forbid"
      : "keep";
  },
};
