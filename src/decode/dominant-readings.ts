/**
 * The function words a pair nobody counted may not read their rare way, and
 * the side of the pair each has to stand on.
 *
 * Kept apart from the rule that reads it, as the 干 frames are.
 */
import { readSyllable, type Syllable } from "../syllable/syllable.js";

/**
 * Which character of a pair a function word has to be for the rule to take the
 * pair.
 *
 * The other side is where the compounds with a sense of their own sit. 都护,
 * 都邑 and 间日 open with the rare reading, 停更, 俸给 and 淹没 close with it,
 * and each was right. 的 and 着 have no such side: 破的 takes a 的 from the verb
 * before it and 着笔 takes a 着 from the verb before it as well.
 */
export type Side = "first" | "second" | "either";

/**
 * A function word's side of a pair, and the readings a pair nobody counted
 * may not give it there.
 */
export interface RareReading {
  readonly side: Side;
  readonly readings: readonly Syllable[];
}

/**
 * Read one syllable of {@link RARE_READINGS}, throwing if it is malformed.
 */
function readingOf(text: string): Syllable {
  const syllable = readSyllable(text);
  /* c8 ignore next 3 -- the table is written below and parses */
  if (syllable === undefined) {
    throw new Error(`not a syllable: ${text}`);
  }
  return syllable;
}

/**
 * The function words, and their rare readings.
 *
 * kHanyuPinlu counts each usual reading at thirty times the rare one or more,
 * and a page of example sentences met each rare reading through a pair:
 *
 * | Character | Usual reading | Rare reading | Pair |
 * | --------- | ------------- | ------------ | ---- |
 * | 的        | de (75,596)   | dì (157)     | 破的 |
 * | 着        | zhe (10,643)  | zhuó (125)   | 着笔 |
 * | 给        | gěi (2,860)   | jǐ (80)      | 家给 |
 * | 更        | gèng (1,405)  | gēng (27)    | 更香 |
 * | 都        | dōu (5,680)   | dū (93)      | 上都 |
 * | 没        | méi (5,589)   | mò (44)      | 没过 |
 * | 间        | jiān (2,080)  | jiàn (15)    | 有间 |
 * | 赚        | zhuàn (25)    | zuàn (none)  | 赚得 |
 *
 * 着 keeps `zháo`, which it takes one time in twenty and which 睡不着 needs.
 * The same odds over every polyphone would take in 系 `jì` (724 to 15) and
 * with it 系好安全带, so the list holds the characters a page showed going
 * wrong.
 *
 * Both scripts, since a 繁體 pair is a key of its own.
 */
export const RARE_READINGS: ReadonlyMap<string, RareReading> = new Map(
  (
    [
      ["的", "either", ["di4", "di2"]],
      ["着", "either", ["zhuo2", "zhao1"]],
      ["著", "either", ["zhuo2", "zhao1"]],
      ["给", "second", ["ji3"]],
      ["給", "second", ["ji3"]],
      ["更", "first", ["geng1"]],
      ["都", "second", ["du1"]],
      ["没", "first", ["mo4"]],
      ["沒", "first", ["mo4"]],
      ["间", "second", ["jian4"]],
      ["間", "second", ["jian4"]],
      ["赚", "first", ["zuan4"]],
      ["賺", "first", ["zuan4"]],
    ] as const
  ).map(([character, side, readings]) => [
    character,
    { side, readings: readings.map((text) => readingOf(text)) },
  ]),
);

/**
 * Whether the character at an index of a pair stands on a side.
 */
export function isOnSide(side: Side, index: number): boolean {
  return side === "either" || (side === "first") === (index === 0);
}
