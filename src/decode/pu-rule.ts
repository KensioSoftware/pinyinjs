/**
 * Whether a 上铺 is the upper bunk or a 上 closing a place before the verb 铺.
 *
 * The bunk is a noun: 我睡上铺, 我的床位是上铺. The same two characters are as
 * often the end of a place and the verb that spreads something over it:
 * 地板上铺着地毯, 床上铺了床单. jieba tags 上铺 `ns`, and the decode read both
 * of those as the bunk.
 */
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
} from "./rules.js";

/** The word in both scripts. */
const SHANG_PU = new Set(["上铺", "上鋪"]);

/**
 * What only the verb 铺 takes: 铺着, 铺满. The bunk is never 着 or 满.
 */
const SPREADING = new Set(["着", "著", "满", "滿"]);

/**
 * What follows the verb 铺 and can also follow the bunk: 铺了, 铺好.
 *
 * 他睡上铺了 is the bunk, so these settle it only where the 上 closes a noun
 * of place.
 */
const COMPLETING = new Set(["了", "好"]);

/** The tags of a word the 上 can close: 床, 地板, 桌子, 身. */
const PLACE_TAGS = /^(?:n|s|f|ng)$/u;

/**
 * 上铺 is taken off the lattice where the 铺 is the verb.
 *
 * That is where 着 or 满 follows it, or where 了 or 好 follows it and a noun
 * stands before the 上. Taking the edge away leaves 地板上 or 床上 to end the
 * place and 铺 to read as the verb, which it already did, so this changes the
 * segmentation and the spacing rather than a syllable: `dìbǎn shàng pūzhe`,
 * not `dìbǎn shàngpù zhe`.
 *
 * Over the Tatoeba and Chinese Boost 例句 runs holding 上铺, it splits 2 and
 * keeps the 1 that is the bunk.
 */
export const LOCATIVE_SHANG_PU: EdgeRule = {
  name: "locative-shang-pu",
  verdictFor: (context: EdgeContext) => {
    const { edge, characters } = context;
    if (!SHANG_PU.has(edge.text)) {
      return "keep";
    }
    const next = characters[edge.to] ?? "";
    if (SPREADING.has(next)) {
      return "forbid";
    }
    const place = wordEndingAt(context, edge.from, 3);
    return COMPLETING.has(next) &&
      place !== undefined &&
      PLACE_TAGS.test(tagOf(context, place))
      ? "forbid"
      : "keep";
  },
};
