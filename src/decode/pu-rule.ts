/**
 * The rules for 铺 the verb: whether a 上铺 is the upper bunk or a 上 closing
 * a place before the verb, and the reading of a 铺 an aspect particle follows.
 *
 * The bunk is a noun: 我睡上铺, 我的床位是上铺. The same two characters are as
 * often the end of a place and the verb that spreads something over it:
 * 地板上铺着地毯, 床上铺了床单. jieba tags 上铺 `ns`, and the decode read both
 * of those as the bunk.
 */
import { isSameSyllable } from "../dictionary/entry.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
} from "./rules.js";
import { syllableOf } from "./verbal-frame.js";

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

/** The character in both scripts. */
const PU = new Set(["铺", "鋪"]);

/** The aspect particles, which only a verb takes. */
const ASPECT = new Set(["着", "著", "了", "过", "過"]);

/** The verb's reading. */
const SPREAD = syllableOf("pū");

/**
 * A word reading 铺 as anything but `pū` before an aspect particle is taken
 * off the lattice.
 *
 * `pù` is the shop and the bed, and a noun takes no 着 or 过. The phrase corpus
 * holds 铺着 `pù zhe` and 铺过 `pù guò` all the same, and the full tier keeps
 * both as words, so 地板上铺着地毯 came out `dìbǎn shàng pùzhe dìtǎn` once
 * {@link LOCATIVE_SHANG_PU} had split the 上铺. Without the word, 铺 reads as
 * the verb it is stored as, and the particle as a word of its own. 铺过 already
 * read `pū` through {@link import("./guo-rule.js").EXPERIENTIAL_GUO}, and is here
 * so that it does not depend on that.
 *
 * The particle has to follow the 铺 inside the word. 店铺 and 床铺 are nouns
 * whatever comes after them.
 */
export const SPREADING_PU: EdgeRule = {
  name: "spreading-pu",
  verdictFor: ({ edge, characters }: EdgeContext) => {
    for (let at = edge.from; at < edge.to - 1; at++) {
      const here = edge.reading[at - edge.from];
      if (
        PU.has(characters[at] ?? "") &&
        ASPECT.has(characters[at + 1] ?? "") &&
        here !== undefined &&
        !isSameSyllable(here, SPREAD)
      ) {
        return "forbid";
      }
    }
    return "keep";
  },
};
