/**
 * The frames that make a 地道 a tunnel rather than the real thing.
 *
 * `difang-rule.ts` takes 地道 apart where one of these holds.
 */
import { toCharacters } from "../script/characters.js";
import {
  type EdgeContext,
  startsLongerWord,
  wordEndingAt,
  wordsStartingAt,
} from "./rules.js";

/**
 * Characters before 地道 that dig it, go into it or count it as a tunnel:
 * 挖地道, 钻进地道, 一条地道.
 *
 * Only as a verb of their own or the end of one in {@link INTO_WORDS}, since
 * 引进地道的川菜 imports the real thing.
 */
const INTO_TUNNEL = new Set(toCharacters("挖掘钻鑽进進入条條"));

/**
 * Longer words before 地道 that end in one of {@link INTO_TUNNEL} and still
 * go into a tunnel or dig one.
 */
const INTO_WORDS = new Set(
  [
    "钻进 鑽進 走进 走進 爬进 爬進 跑进 跑進 躲进 躲進 逃进 逃進",
    "进入 進入 挖掘 一条 一條",
  ].flatMap((line) => line.split(" ")),
);

/**
 * Characters after 地道 that place something in a tunnel or at its mouth:
 * 地道里, 地道口.
 *
 * Only where they stand alone or open one of {@link IN_WORDS}, since 地道口味
 * and 地道里脊 are the real thing.
 */
const IN_TUNNEL = new Set(toCharacters("里裡裏口内內"));

/** Locatives after 地道 that place something in it: 躲在地道里面. */
const IN_WORDS = new Set(
  ["里面 裡面 裏面 里头 裡頭 里边 裡邊 内部 內部"].flatMap((line) =>
    line.split(" "),
  ),
);

/**
 * Whether the 地道 between two positions is a tunnel.
 */
export function isTunnelAt(
  context: EdgeContext,
  from: number,
  to: number,
): boolean {
  const { characters } = context;
  const before = wordEndingAt(context, from) ?? "";
  const after = wordsStartingAt(context, to);
  return (
    (INTO_TUNNEL.has(characters[from - 1] ?? "") &&
      (toCharacters(before).length < 2 || INTO_WORDS.has(before))) ||
    (IN_TUNNEL.has(characters[to] ?? "") &&
      (!startsLongerWord(context, to) ||
        after.some((word) => IN_WORDS.has(word))))
  );
}
