/**
 * Whether a 东西 is a thing or the compass directions east and west.
 *
 * The dictionary holds 东西 as `dōngxi`, the thing, by the judgement recorded
 * in `neutral-senses.ts`, and leaves the compass sense to longer words such as
 * 东西方 and 各奔东西. Descriptions of roads, rivers and buildings put the
 * directions in front of words the dictionary does not join to them: 东西走向,
 * 东西向, 东西两侧.
 */
import { toCharacters } from "../script/characters.js";
import { type EdgeContext, type EdgeRule, wordsStartingAt } from "./rules.js";

/** The word, in both scripts. */
const DONGXI = new Set(["东西", "東西"]);

/**
 * Words after 东西 that make it a direction: 东西走向, 东西方向.
 */
const ORIENTATIONS = new Set(["走向", "方向"]);

/**
 * What a 两 after the directions counts: 东西两侧, 东西两端, 东西两厢.
 *
 * Listed because 这东西两块钱 is the thing and its price.
 */
const SIDES = new Set(toCharacters("侧側边邊端岸厢廂翼头頭面半"));

/** The 向 of 东西向的街道. */
const XIANG = new Set(["向"]);

/** The 两 of 东西两侧. */
const LIANG = new Set(["两", "兩"]);

/**
 * What may follow the 向 of 东西向 for it to be an orientation.
 *
 * 东西向的一号线 and a run that ends there. 把东西向他扔过去 is the thing,
 * thrown towards him.
 */
const AFTER_XIANG = new Set(["的", ""]);

/**
 * Whether what follows a 东西 ending at a position makes it the directions.
 */
function isOrientedAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  const next = characters[at] ?? "";
  if (wordsStartingAt(context, at).some((word) => ORIENTATIONS.has(word))) {
    return true;
  }
  if (LIANG.has(next)) {
    return SIDES.has(characters[at + 1] ?? "");
  }
  return XIANG.has(next) && AFTER_XIANG.has(characters[at + 1] ?? "");
}

/**
 * 东西 taken apart where it names the directions.
 *
 * 这条路是东西走向的 came out `dōngxi zǒuxiàng`, a road running thing-wise.
 * Taking the edge away leaves 东 and 西 their own readings, `dōng xī`. The
 * spacing follows the decode and writes them apart.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia the rule moves one decode in
 * each of the standard and full tiers, and over both CPP splits it moves 20 in
 * each. All are corrections: 东西两侧有厢房, 金刚墙东西两端, 东西向的官街.
 * 东西方向 now goes through the word 东西方 and reads `dōngxīfāng xiàng`, which
 * has the right syllables and the wrong spacing.
 */
export const COMPASS_DONGXI: EdgeRule = {
  name: "compass-dongxi",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    return DONGXI.has(edge.text) && isOrientedAt(context, edge.to)
      ? "forbid"
      : "keep";
  },
};
