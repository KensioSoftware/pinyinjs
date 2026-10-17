/**
 * How a 离合词 is read when more than a 个 stands between its halves.
 *
 * 睡不着觉, 请了假 and 睡了八个小时觉 part the word around an aspect particle,
 * a complement or a count. `SEPARATED_COMPOUND` in `split-rule.ts` asks this
 * module for the tail's reading wherever the 个 shape has nothing to say.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { type EdgeContext, tagOf } from "./rules.js";

/**
 * The tag prefix jieba gives a verb.
 *
 * The same prefix `split-rule.ts` reads, so `vn` and `vd` are in.
 */
const VERB_TAG = "v";

/**
 * The numerals that count the time or the amount pushed into a 离合词.
 *
 * {@link QUANTITY_CHARACTERS} and the two that ask or halve a count, since
 * 放几天假 and 睡半个小时觉 are as common as any number.
 */
const INFIX_NUMERALS = `[${[...QUANTITY_CHARACTERS, "几", "幾", "半"].join("")}]`;

/**
 * What can stand between a 离合词's halves besides a lone 个, as a pattern.
 *
 * The verb half takes an aspect particle or a complement, and the object half a
 * count, in that order and either one alone (睡不着觉, 睡够了觉, 请了假,
 * 睡了十个小时觉, 放三天假, 睡一会儿觉, 睡了个好觉). Spelled out rather than
 * left to the tags, because the tags are what the 个 rule found too loose. 下
 * and 年 count only behind a numeral (睡一下觉), which keeps out the
 * directional 下 the `CLASSIFIER` note in `split-rule.ts` describes. 天 and 会儿 count
 * bare, since 请了天假 and 睡会儿觉 are how both are said.
 *
 * The count is the object's and the complement the verb's, so 好 comes in
 * twice. 睡好觉 completes the sleeping, and 睡了个好觉 describes the sleep.
 */
const INFIX = new RegExp(
  "^(?=.)" +
    // What the verb takes: aspect, a potential complement, or a result.
    "(?:[了过過]|[不得][着著好了成够夠完饱飽上]|[够夠好完饱飽足]了?)?" +
    // What the object takes: a count, with 个 and a 好 the sleep can be.
    "(?:" +
    `${INFIX_NUMERALS}*[个個]好?` +
    `|${INFIX_NUMERALS}*[个個]?(?:小时|小時|钟头|鐘頭|天|夜|晚上|会儿|會兒)` +
    `|${INFIX_NUMERALS}+(?:下|年|周|週|星期|个月|個月)` +
    `|一?[点點][儿兒]?` +
    ")?$",
  "u",
);

/**
 * How far back the head of a widely separated 离合词 is looked for.
 *
 * 睡了十个小时觉 holds five characters between its halves, the longest the
 * pattern above admits short of a count in the hundreds.
 */
const WIDEST_INFIX = 6;

/**
 * The tag prefix jieba gives a noun.
 */
const NOUN_TAG = "n";

/**
 * Whether the tail at a position goes on into a noun it could be modifying.
 *
 * 他请了假，要回乡下 ends the compound at the comma. 放了假钱 would not: the 假
 * there says what the money is, and 假钱 is no word the dictionary holds for
 * anything to find. A noun, or the 的 that marks an attributive,
 * in the next place is the shape of that reading, and the rule stands back from
 * it. 假花 gets past this, since 花 is tagged as the verb, and is the one known
 * gap.
 */
function modifiesWhatFollows(context: EdgeContext, at: number): boolean {
  const next = context.characters[at + 1];
  return next === "的" || tagOf(context, next).startsWith(NOUN_TAG);
}

/**
 * The directional complements the dictionary tags as verbs, and reads neutral
 * behind the verb they complete.
 */
const DIRECTIONS = new Set(["来", "來", "去"]);

/**
 * Whether the tail at a position can be the object a verb is parted from.
 *
 * The object of a 离合词 is a noun or a verb made into one (觉 is tagged `v`), so
 * the tail has to be tagged as one of those. Both wrong firings the corpus and
 * the ChineseBoost library offered were of another kind. 干吗 is tagged a verb,
 * and 我的袜子已经干了吗 read its 吗 as `má` across the 了. 坐下 is a verb with
 * 下 tagged `f`, and 伊莉雅坐了下一班飞机 read the 下 of 下一班 as `xia`. 来
 * and 去 are tagged verbs and are named, because a verb and the direction it
 * goes in are no verb and its object, and both read neutral behind it.
 */
function isObject(context: EdgeContext, at: number): boolean {
  /* c8 ignore next -- the tail is a position of the run itself */
  const tail = context.characters[at] ?? "";
  const tag = tagOf(context, tail);
  return (
    !DIRECTIONS.has(tail) &&
    (tag.startsWith(NOUN_TAG) || tag.startsWith(VERB_TAG))
  );
}

/**
 * The syllable a 离合词 separated by more than a 个 gives its tail, or
 * undefined.
 *
 * The nearest head the {@link INFIX} pattern reaches is the one asked about,
 * so 我还没睡够觉 finds 睡觉 and never gets as far as the 还. The pair has to
 * be tagged a verb itself, which is what a 离合词 is, and 打了场硬仗 found the
 * 打场 of threshing, a noun, behind a 场 that was counting. That stands in for
 * the 个 shape's verb in front, which the dictionary leaves untagged on 休, 流
 * and 理, so 休一天假, 流了血 and 理了发 are read through it. The tail has to be
 * an object, for the reason {@link isObject} gives, and must not run on into a
 * noun, for the reason {@link modifiesWhatFollows} gives.
 *
 * The 个 shape's `opensTaggedWord` is left out, because it changed
 * nothing over either corpus. Forcing the tail's own edge leaves a longer word
 * starting at it to the decode, so 我睡了觉得好多了 still reads 觉得 whole.
 *
 * Only the tail is settled. A head reached across a complement can be an
 * adverb the tags call a verb, and 还不够钱 would read its 还 as `huán` off
 * 还钱.
 */
export function widelySeparatedSyllableAt(
  context: EdgeContext,
  at: number,
): Syllable | undefined {
  const { characters } = context;
  for (let head = at - 2; head >= 0 && head >= at - 1 - WIDEST_INFIX; head--) {
    if (!INFIX.test(characters.slice(head + 1, at).join(""))) {
      continue;
    }
    /* c8 ignore next -- both positions are inside the run just measured */
    const word = `${characters[head] ?? ""}${characters[at] ?? ""}`;
    const entry = context.dictionary.lookup(word);
    if (
      entry?.reading.length !== 2 ||
      !entry.partOfSpeech.startsWith(VERB_TAG) ||
      !isObject(context, at)
    ) {
      continue;
    }
    return modifiesWhatFollows(context, at) ? undefined : entry.reading[1];
  }
  return undefined;
}
