/**
 * The 长 contexts that name a span of time or a change in length.
 *
 * Each settles a 长 that `chang-context.ts` and `chang-complement.ts` leave to
 * the character's default, `zhǎng`. In each, a word stands beside the 长 that
 * only ever stands beside a length.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia they change 9 readings in the
 * full tier, 10 in the standard tier and 18 in the core tier. All are
 * corrections except 菲利普的长子 in the core tier, which holds no word 长子.
 * CPP's labelled accuracy holds at 91.86%.
 */
import { closesClause } from "./chang-context.js";
import {
  type EdgeContext,
  startsLongerWord,
  tagOf,
  wordsEndingAt,
  wordsStartingAt,
} from "./rules.js";

/**
 * Spans a 长 in front of can only be measuring.
 *
 * 长时间 is jieba's word with no reading in either source, so the lattice
 * reaches it as 长 and 时间. Growing takes a thing that grows, and none of
 * these do.
 */
const SPANS = new Set(["时间", "時間", "时期", "時期", "周末", "週末", "假期"]);

/**
 * Whether a 长 stands in front of a span of time: 长时间, 长周末.
 */
export function isSpanAhead(context: EdgeContext): boolean {
  return wordsStartingAt(context, context.edge.to).some((word) =>
    SPANS.has(word),
  );
}

/**
 * The correlative that coordinates two qualities.
 */
const BOTH = "又";

/**
 * Whether a 长 is the first of two qualities a 又…又 joins.
 *
 * 又长又冷 and 又长又直. `chang-context.ts` reads the second of the pair,
 * 又瘦又长, as a predicate closing its clause. The first has a 又 on each side,
 * and only a quality goes between them.
 */
export function isCoordinated(context: EdgeContext): boolean {
  const { characters, edge } = context;
  return characters[edge.from - 1] === BOTH && characters[edge.to] === BOTH;
}

/**
 * Verbs of becoming, which take a quality as their result.
 */
const BECOMING = new Set(["变", "變", "变得", "變得"]);

/**
 * Whether a 长 is what something became: 白天日益变长, 影子变长了.
 *
 * The clause has to end after it, since 变长出 would be a verb after all.
 */
export function isBecome(context: EdgeContext): boolean {
  return (
    wordsEndingAt(context, context.edge.from).some((word) =>
      BECOMING.has(word),
    ) && closesClause(context)
  );
}

/**
 * The tag jieba gives a time word.
 */
const TIME_TAG = "t";

/**
 * Subjects that are spans themselves, which a 长 after can only measure.
 *
 * jieba tags 冬天 and 白天 `t`, and 时间 and 日子 `n`, so the time words are
 * taken by their tag and the rest named here.
 */
const SPAN_SUBJECTS = new Set(["时间", "時間", "日子", "距离", "距離", "路程"]);

/**
 * Whether a 长 says how long a span is: 时间长了, 工作时间长.
 *
 * The span is the word in front and the clause ends after the 长. 头发长了 is
 * the same shape with a thing that grows, and a span cannot.
 */
export function isSpanMeasured(context: EdgeContext): boolean {
  return (
    wordsEndingAt(context, context.edge.from).some(
      (word) => SPAN_SUBJECTS.has(word) || tagOf(context, word) === TIME_TAG,
    ) && closesClause(context)
  );
}

/**
 * The comparative marker, in both scripts.
 */
const THAN = "比";

/**
 * The particle that makes what is before it a modifier.
 */
const MODIFYING = "的";

/**
 * Whether a 长 closes a comparison: 时间比我想的长, 其刀刃比大刀长.
 *
 * A 比 standing as a word of its own earlier in the run sets up the
 * comparison, and the 长 at the end of the clause is what is compared. A 比
 * opening a longer word is something else (比作, 比较), and a 的 after the 长
 * makes it a modifier inside the clause, as in 比作一棵…生长的大树. 比他长得高
 * compares how tall, and its 得 keeps it out of the rule before this is asked.
 */
export function isComparedWith(context: EdgeContext): boolean {
  const { characters, edge } = context;
  const compares = characters
    .slice(0, edge.from)
    .some(
      (character, at) => character === THAN && !startsLongerWord(context, at),
    );
  return compares && characters[edge.to] !== MODIFYING && closesClause(context);
}
