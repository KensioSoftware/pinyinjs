/**
 * Whether the 行 of 一行 is a line of work or a party travelling together.
 *
 * The dictionary holds 一行 as `yī xíng`, the party of 我们一行人 and 代表团
 * 一行三人. 干这一行 and 这一行不好做 are a trade, and 这一行字 is a line of
 * text, and both read `háng`. What tells them apart is what stands in front:
 * a party is counted after the people it is made of, and a trade after a
 * demonstrative or the verb that works at it.
 */
import { isSameSyllable } from "../dictionary/entry.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import type { EdgeContext, EdgeRule, EdgeVerdict } from "./rules.js";
import { opensTaggedWord, syllableOf } from "./verbal-frame.js";

/** The 行, the same in both scripts. */
const HANG = "行";

/** The 一 in front of it. */
const ONE = "一";

/** The reading of 行 as a line or a trade. */
const LINE: Syllable = syllableOf("háng");

/**
 * What stands before 一行 when it is a trade or a line.
 *
 * 这一行, 那一行 and 哪一行 point at one. 干一行, 做一行 and 爱一行 are the
 * trade worked at, as in 干一行爱一行.
 */
const BEFORE = new Set(["这", "這", "那", "哪", "干", "幹", "做", "爱", "愛"]);

/**
 * What after 一行 makes it a party again: 这一行人 and 那一行三人.
 */
const PARTY = new Set(
  toCharacters("人们們两兩二三四五六七八九十几幾数數0123456789"),
);

/**
 * Whether the 行 at a position is a trade or a line.
 *
 * 这一行程 opens the word 行程 and is left alone.
 */
function isTradeAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  return (
    characters[at] === HANG &&
    characters[at - 1] === ONE &&
    BEFORE.has(characters[at - 2] ?? "") &&
    !PARTY.has(characters[at + 1] ?? "") &&
    !opensTaggedWord(context, at)
  );
}

/**
 * 行 read `háng` in 这一行 and 干一行.
 *
 * 毕竟只有他干过这一行 came out `zhè yìxíng`, as if he had been one of a
 * travelling party. Where the frame holds, an edge reading the 行 any other
 * way is forbidden, which takes the word 一行 away, and the 行 alone is forced
 * to `háng`. 我们一行人 and 他们一行三人 keep `yìxíng`.
 */
export const TRADE_HANG: EdgeRule = {
  name: "trade-hang",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.reading.length !== edge.to - edge.from) {
      return "keep";
    }
    let verdict: EdgeVerdict = "keep";
    for (let at = edge.from; at < edge.to; at++) {
      if (!isTradeAt(context, at)) {
        continue;
      }
      const here = edge.reading[at - edge.from];
      /* c8 ignore next 3 -- the reading is as long as the span */
      if (here === undefined) {
        continue;
      }
      if (!isSameSyllable(here, LINE)) {
        return "forbid";
      }
      if (edge.to - edge.from === 1) {
        verdict = "force";
      }
    }
    return verdict;
  },
};
