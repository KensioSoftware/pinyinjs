/**
 * Whether a 系 is tying something or is a department, a system or "to be".
 *
 * `jì` ties, and `xì` is the noun of 历史系 and 日系, and the literary copula
 * of 墓室系明圹. The tying verb takes a complement (系好, 系紧, 系在树上) or
 * aspect (系了, 系着), or what is tied: 系领带, 系安全带.
 */
import type { EdgeContext } from "./rules.js";
import {
  isBareAt,
  startsWithAny,
  syllableOf,
  type VerbalFrame,
  charactersOf,
} from "./verbal-frame.js";

/**
 * What follows a 系 that is tying: a complement or aspect.
 *
 * 系上 reads `jì` already through the full tier's word. 在 is in for 把绳子系在
 * 树上 and 把船系在码头上. A department or a system followed by 在 is the one
 * shape this gets wrong, and none of the corpus lines has it.
 */
const COMPLEMENT = new Set([
  "好",
  "上",
  "紧",
  "牢",
  "住",
  "着",
  "著",
  "了",
  "在",
  "得",
]);

/**
 * What is tied: 系领带, 系安全带, 系鞋带, 系围裙.
 */
const TIED = [
  "领带",
  "鞋带",
  "安全带",
  "围裙",
  "围巾",
  "绳子",
  "带子",
  "丝带",
  "腰带",
  "皮带",
  "头绳",
  "红领巾",
  "蝴蝶结",
];

/**
 * Whether the 系 at a position is tying something.
 */
function isTyingAt(context: EdgeContext, at: number): boolean {
  return (
    isBareAt(context, at + 1, COMPLEMENT) ||
    startsWithAny(context, at + 1, TIED)
  );
}

/**
 * The characters that bind it into a compound reading it otherwise.
 *
 * Bound before it: 关系, 联系, 连系, 维系, 体系, 星系 and the other nouns
 * ending in it, so 我们联系上他们 is not read as tying. Bound after it: 系统,
 * 系列, 系数.
 */
const BOUND_BEFORE = charactersOf(
  "关關联聯连連维維体體派星直世谱譜嫡旁菌根水语語品恒恆阳陽河院",
);

/**
 * The characters after it that bind it into such a compound.
 */
const BOUND_AFTER = charactersOf("统統列数數");

/**
 * 系 read `jì` where it is tying something.
 *
 * 繫 is the form 繁體 ties with, and Unihan gives it `xì` alone, so only 系
 * is here.
 */
export const JI_FRAME: VerbalFrame = {
  characters: new Set(["系"]),
  reading: syllableOf("jì"),
  boundBefore: BOUND_BEFORE,
  boundAfter: BOUND_AFTER,
  isVerbalAt: isTyingAt,
};
