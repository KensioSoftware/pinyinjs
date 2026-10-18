/**
 * The 个人 whose 个 is counting one 人, and not the word *individual*.
 *
 * {@link import("./measure-rule.js").COUNTED_MEASURE} takes 个人 apart after a
 * number, so 三个人 is three people. A bare 个 with no number at all stands for
 * 一个 after a verb that introduces somebody, and the measure rule has nothing
 * to go on there: 门口有个人, 想找个人聊聊天, 我今天雇了个人.
 */
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordStartingAt,
} from "./rules.js";

/**
 * The word, in both scripts.
 */
const INDIVIDUAL = new Set(["个人", "個人"]);

/**
 * The verbs that bring an unnamed somebody into a sentence.
 *
 * 有个人 is *somebody*, 找个人 and 叫个人 are finding and sending one, 雇了个人
 * is hiring one and 换了个人 is becoming somebody else.
 */
const INTRODUCING = new Set([
  "有",
  "找",
  "叫",
  "请",
  "請",
  "雇",
  "换",
  "換",
  "派",
]);

/**
 * The aspect particle that can sit between the verb and the 个.
 */
const PERFECTIVE = "了";

/**
 * The tag prefix jieba gives a noun.
 */
const NOUN_TAG = "n";

/**
 * Whether a verb that introduces somebody stands in front of a 个人, with or
 * without a 了 after it.
 *
 * The word after the 个人 is asked about too. 个人 in front of a noun is the
 * modifier *personal* (我有个人问题, 有个人信息), and only a verb, a particle
 * or the end of the run leaves the 人 to be the person.
 */
function isIntroduced(context: EdgeContext, from: number, to: number): boolean {
  const { characters } = context;
  const verb = characters[from - 1] === PERFECTIVE ? from - 2 : from - 1;
  if (!INTRODUCING.has(characters[verb] ?? "")) {
    return false;
  }
  return !tagOf(context, wordStartingAt(context, to)).startsWith(NOUN_TAG);
}

/**
 * 个人 is taken apart where an introducing verb makes its 个 count one 人.
 *
 * Taking the edge away leaves 个 and 人 to read as themselves. The readings
 * are `gè rén` either way, so this changes the segmentation and the spacing.
 *
 * Over the 139,893 distinct Han runs of Tatoeba and the Chinese Boost example
 * sentences, the decode kept 个人 as one word in 61 runs. The rule splits 12,
 * and every one of them is somebody. A rough number in front (十几个人,
 * 一百多个人) is left alone, because taking the edge away there moves the 个
 * onto the 几 and reads 十 几个 人.
 */
export const COUNTED_GE: EdgeRule = {
  name: "counted-ge",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    return INDIVIDUAL.has(edge.text) &&
      isIntroduced(context, edge.from, edge.to)
      ? "forbid"
      : "keep";
  },
};
