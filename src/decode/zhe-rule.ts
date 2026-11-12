/**
 * The 着 of 看着 and 想着, which is the verb's aspect and not half of a word.
 *
 * jieba counts 看着, 想着 and 穿着 as words, so the decode read 它看着我 as 它
 * 看着 我 and 她只想着回家的事 as 她 只 想着 回家. Each is the verb with the
 * durative 着 after it, the same shape as 吃着 and 拿着, which jieba never
 * counted and the decode already cut in two. CC-CEDICT holds no entry for 看着
 * or 想着, and the one it holds for 穿着 is the noun *attire*, so a caller
 * looking the word up found nothing or the wrong thing.
 */
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordsEndingAt,
  wordsStartingAt,
} from "./rules.js";

/**
 * The aspect particle, in both scripts.
 */
const ZHE = new Set(["着", "著"]);

/**
 * The verb-and-着 words that mean more than the verb doing it.
 *
 * Each is one CC-CEDICT gives a sense of its own. 挨着 is *near*, 有着 the
 * written *to have*, 活着 *alive*, 跟着 *immediately afterwards* as well as
 * *following*, and 背着 *behind someone's back*, which is `bèi` where the verb
 * carrying something on the back is `bēi`. Cutting any of them would leave a
 * caller looking up the half that does not carry the sense.
 */
const LEXICAL = new Set([
  "挨着",
  "挨著",
  "有着",
  "有著",
  "活着",
  "活著",
  "跟着",
  "跟著",
  "背着",
  "背著",
]);

/**
 * The word whose noun is a word in its own right, *attire*, and the verb in
 * front of 着 otherwise.
 */
const ATTIRE = new Set(["穿着", "穿著"]);

/**
 * The tag prefix jieba gives a verb.
 */
const VERB_TAG = "v";

/**
 * Whether a syllable is the particle's neutral `zhe`.
 */
function isNeutralZhe(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "zh" &&
    syllable.final === "e" &&
    syllable.tone === NEUTRAL_TONE
  );
}

/**
 * What stands before 穿着 when it is the noun: 她的穿着很时髦, 不要以穿着判断人.
 */
const BEFORE_ATTIRE = new Set(["的", "以"]);

/**
 * The locative after 穿着 when it is the noun: 他穿着上很不讲究.
 */
const AFTER_ATTIRE = "上";

/**
 * Whether 穿着 stands where a noun does.
 *
 * After 的 or 以, or before a 上 that opens no word of its own. 他穿着上衣 has
 * 上衣 there, and the 穿 is the verb.
 */
function isAttire(context: EdgeContext): boolean {
  const { characters, edge } = context;
  if (!ATTIRE.has(edge.text)) {
    return false;
  }
  if (BEFORE_ATTIRE.has(characters[edge.from - 1] ?? "")) {
    return true;
  }
  return (
    characters[edge.to] === AFTER_ATTIRE && !opensTaggedWord(context, edge.to)
  );
}

/**
 * Whether a tagged word of more than one character starts at a position.
 */
function opensTaggedWord(context: EdgeContext, at: number): boolean {
  return wordsStartingAt(context, at).some(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * Whether a longer word would take the 着 or the verb once the pair is gone.
 *
 * 看着手机 has 着手 *to set about* starting at the 着, and taking 看着 away
 * would hand the 着 to it and read `zhuó`. 注意地看著 has 注意地看 ending at
 * the 看, a phrase the full tier holds untagged, and the decode would take it
 * over 注意 地 看. Which word the character belongs to is a question this rule
 * cannot answer, so it leaves the decode as it was. A tagged word ending at the
 * verb is let through, since 照看 and 着 is the reading the rule is after.
 */
function isClaimed(context: EdgeContext): boolean {
  const { edge } = context;
  return (
    opensTaggedWord(context, edge.from + 1) ||
    wordsEndingAt(context, edge.from + 1).some(
      (word) => toCharacters(word).length > 1 && tagOf(context, word) === "",
    )
  );
}

/**
 * A verb and its aspect 着 are two words, unless the pair means more.
 *
 * The edge taken away is a verb of two characters whose second is 着 read
 * neutral `zhe`. 睡着 and 点着 are `zháo`, *falling asleep* and *catching
 * fire*, and stay whole, as do 沉着 and 执着 in `zhuó`. The prepositions 随着,
 * 沿着 and 朝着 are tagged `p` and are not reached. {@link LEXICAL} lists the
 * five verbs CC-CEDICT gives a sense of their own. 穿着 where it is the noun,
 * *attire*, is kept. Taking the edge away leaves the verb and the particle to read as
 * themselves, and the particle rule settles 着 as `zhe`.
 */
export const DURATIVE_ZHE: EdgeRule = {
  name: "durative-zhe",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (
      edge.to - edge.from !== 2 ||
      !ZHE.has(edge.text.slice(1)) ||
      !edge.partOfSpeech.startsWith(VERB_TAG) ||
      !isNeutralZhe(edge.reading[1]) ||
      LEXICAL.has(edge.text)
    ) {
      return "keep";
    }
    return isAttire(context) || isClaimed(context) ? "keep" : "forbid";
  },
};
