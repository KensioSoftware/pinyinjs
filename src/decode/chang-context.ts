/**
 * The two 长 contexts a degree adverb does not cover.
 *
 * 很 or 太 in front of a 长 settles it on its own, and `chang-rule.ts` says why.
 * These two do not: each names a near side that a verb 长 shares, so each has
 * to check the far side as well.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import {
  type EdgeContext,
  tagOf,
  wordsEndingAt,
  wordStartingAt,
} from "./rules.js";

/**
 * The adverbs {@link DEGREE} leaves out, because they scope a verb just as well.
 *
 * 那座桥不长 and 距离还长 are both `cháng`, and the degree set says why it will
 * not have them: 胡子不长在前额上 and 还长有毛 put the
 * same two characters around the verb. What tells the two apart is the other
 * side. A growing 长 governs something — 在前额上, 有毛, 一个包 — while the
 * adjective has nothing left to say, so the clause ends.
 */
const SCOPING = new Set(["不", "还", "還", "又", "已经", "已經"]);

/**
 * What may stand between a predicative 长 and the end of its clause.
 *
 * Only the particles that close one. Everything a verb could govern is
 * therefore excluded by construction, which is the whole of the test.
 */
const CLOSING = new Set(["了", "的", "呢", "吗", "嗎", "啊", "呀"]);

/**
 * Whether a 长 is the whole of what an adverb is scoping.
 *
 * 那座桥不长, 生得又瘦又长, 距离还长. The adverb is the near side and the end of
 * the clause is the far side, and it takes both: 不长 alone is 不长在耳朵外面
 * as readily as it is 不长.
 */
export function isPredicated(context: EdgeContext): boolean {
  const { characters, edge } = context;
  if (!SCOPING.has(characters[edge.from - 1] ?? "")) {
    return false;
  }
  const after = characters[edge.to];
  return after === undefined || CLOSING.has(after);
}

/**
 * The tag jieba gives a 量词.
 */
const MEASURE = "q";

/**
 * The tag prefix a noun carries, which is what an attributive 长 modifies.
 */
const NOUN_TAG = "n";

/**
 * The mark that makes the number after it a position rather than a count.
 */
const ORDINAL = "第";

/**
 * Whether the 量词 in front of a position is counting an ordinal.
 *
 * 一个长头发的女生 has its subject spoken for by the 一个, and 第一次长胡子 does
 * not: 第一次 is when the growing happened rather than what is being counted.
 * The walk back over the quantity characters is the same one
 * {@link import("./reading-rules.js").COUNTED_MEASURE} makes, and for the same
 * reason.
 */
function isOrdinalPhrase(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  let from = at - 1;
  while (from > 0 && QUANTITY_CHARACTERS.has(characters[from - 1] ?? "")) {
    from--;
  }
  return characters[from - 1] === ORDINAL;
}

/**
 * Whether a 长 is an adjective in front of the noun it modifies.
 *
 * 长头发, 长耳朵, 长胡子, 长裙子. The noun after it says nothing on its own,
 * since 长毛 and 长知识 are a verb and its object wearing the same shape, so the
 * near side has to say the rest. A 量词 or 有 in front of a 长 leaves it nothing
 * to be the verb of: 一个长头发的女生 and 兔子有长耳朵 have their subject
 * already spoken for, and 他长毛了 and 树长叶子 do not.
 *
 * A verb in front is **not** enough, though 他留长头发 wears long hair where
 * 他长头发 grows it. jieba tags 树 a verb and 习惯 a noun, so the tag names
 * neither set: taking every verb read 树长叶子 as an adjective and 教育长邓演达
 * with it.
 *
 * Every word ending at the position is asked rather than the longest, because
 * the longest is 一个 where the 量词 is the 个 inside it. See
 * {@link wordsEndingAt}.
 */
export function isAttributive(context: EdgeContext): boolean {
  const { edge } = context;
  if (!tagOf(context, wordStartingAt(context, edge.to)).startsWith(NOUN_TAG)) {
    return false;
  }
  if (isOrdinalPhrase(context, edge.from)) {
    return false;
  }
  return wordsEndingAt(context, edge.from).some(
    (word) => word === "有" || tagOf(context, word) === MEASURE,
  );
}
