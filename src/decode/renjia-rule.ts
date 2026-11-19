/**
 * Whether a 人家 is somebody else or a household.
 *
 * The dictionary holds 人家 as `rénjia`, the pronoun of 别把人家当傻瓜 and
 * 人家不要啦, by the judgement recorded in `neutral-senses.ts`. A household is
 * `rénjiā`, and is said after a count of households, a word for how many or
 * how well off, or a description closed by 的: 这户人家, 二十户人家, 很多人家,
 * 有钱人家, 穷人家, 有的人家. The longer words the
 * dictionary holds (大户人家, 小户人家, 书香人家) carry `rénjiā` themselves.
 */
import { isSameSyllable } from "../dictionary/entry.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import type { EdgeContext, EdgeRule, EdgeVerdict } from "./rules.js";
import { syllableOf } from "./verbal-frame.js";

/** The 人 of 人家, the same in both scripts. */
const REN = "人";

/** The 家 of 人家, the same in both scripts. */
const JIA = "家";

/** The reading of 家 in a household. */
const HOUSEHOLD: Syllable = syllableOf("jiā");

/**
 * The measure word households are counted by, in both scripts.
 */
const HU = new Set(["户", "戶"]);

/**
 * What says how many households there are, or how well off one is, in both
 * scripts, read backwards from the 人.
 *
 * 的 is there because a pronoun is seldom described, and a household is:
 * 有的人家, 家境殷实的人家. 好 is left out, since 他酒量好人家送他 has the
 * pronoun after it.
 */
const DESCRIBING = [
  "有钱",
  "有錢",
  "富贵",
  "富貴",
  "贫苦",
  "貧苦",
  "贫寒",
  "貧寒",
  "穷苦",
  "窮苦",
  "普通",
  "平常",
  "寻常",
  "尋常",
  "殷实",
  "殷實",
  "很多",
  "许多",
  "許多",
  "不少",
  "好些",
  "家家",
  "穷",
  "窮",
  "富",
  "的",
];

/**
 * Whether the text ending at a position spells one of the describing words.
 */
function spellsDescriptionBefore(
  characters: readonly string[],
  at: number,
): boolean {
  return DESCRIBING.some((word) => {
    const length = toCharacters(word).length;
    return characters.slice(at - length, at).join("") === word;
  });
}

/**
 * Whether the 家 at a position closes a 人家 that is a household.
 */
function isHouseholdAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  if (characters[at] !== JIA || characters[at - 1] !== REN) {
    return false;
  }
  return (
    HU.has(characters[at - 2] ?? "") ||
    spellsDescriptionBefore(characters, at - 1)
  );
}

/**
 * Whether an edge joins the 人 of a household 人家 to what stands before it.
 *
 * 有钱人 and 穷人 are words, and 有钱人家 would otherwise go through them and
 * leave 家 alone. The 人 belongs to the 家.
 */
function takesRenFrom(context: EdgeContext): boolean {
  const { edge } = context;
  const ren = edge.to - 1;
  return (
    edge.to - edge.from > 1 &&
    context.characters[ren] === REN &&
    isHouseholdAt(context, edge.to)
  );
}

/**
 * 人家 read `rénjiā` where it is a household.
 *
 * Where the frame holds, an edge reading the 家 as anything but `jiā` is
 * forbidden, and so is one joining its 人 to the words before. That takes the
 * pronoun 人家 away and leaves 人 and 家 to their own readings, with 家 forced
 * to `jiā`. The two are written apart, as the decode leaves them.
 */
export const HOUSEHOLD_RENJIA: EdgeRule = {
  name: "household-renjia",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.reading.length !== edge.to - edge.from) {
      return "keep";
    }
    if (takesRenFrom(context)) {
      return "forbid";
    }
    let verdict: EdgeVerdict = "keep";
    for (let at = edge.from; at < edge.to; at++) {
      if (!isHouseholdAt(context, at)) {
        continue;
      }
      const here = edge.reading[at - edge.from];
      /* c8 ignore next 3 -- the reading is as long as the span */
      if (here === undefined) {
        continue;
      }
      if (!isSameSyllable(here, HOUSEHOLD)) {
        return "forbid";
      }
      if (edge.to - edge.from === 1) {
        verdict = "force";
      }
    }
    return verdict;
  },
};
