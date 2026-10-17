/**
 * Whether a 相 is a photograph or is "each other".
 *
 * 照相 is `zhàoxiàng` and a word. Taken apart, as in 照了一张相 and 你照的相,
 * the 相 stands on its own and took the commoner `xiāng` of 相信 and 互相.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import type { EdgeContext } from "./rules.js";
import {
  closesTaggedWord,
  syllableOf,
  type VerbalFrame,
} from "./verbal-frame.js";

/**
 * The verb of the photograph, in both scripts.
 */
const TAKING = "照";

/**
 * What can stand between 照 and its 相: aspect, a count and 的.
 *
 * 照了一张相, 照张相, 照个相, 照过相, 照的相.
 */
const BETWEEN = new Set([
  "了",
  "过",
  "過",
  "的",
  "张",
  "張",
  "个",
  "個",
  "几",
  "幾",
  ...QUANTITY_CHARACTERS,
]);

/**
 * How far back the 照 may be.
 */
const REACH = 4;

/**
 * Whether the 相 at a position is the photograph of a 照 before it.
 *
 * A word ending at the 照 takes it away from the 相, which keeps 按照 and
 * 护照 out.
 */
function isPhotographAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  for (let back = at - 1; back >= Math.max(0, at - REACH); back--) {
    /* c8 ignore next -- the position is inside the run */
    const character = characters[back] ?? "";
    if (character === TAKING) {
      return !closesTaggedWord(context, back + 1);
    }
    if (!BETWEEN.has(character)) {
      return false;
    }
  }
  return false;
}

/**
 * 相 read `xiàng` where it is a photograph taken.
 */
export const XIANG_FRAME: VerbalFrame = {
  characters: new Set(["相"]),
  reading: syllableOf("xiàng"),
  boundBefore: new Set(),
  boundAfter: new Set(),
  isVerbalAt: isPhotographAt,
};
