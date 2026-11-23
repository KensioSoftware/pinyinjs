/**
 * Where 不 loses its tone.
 *
 * 不 is `bu`, with no tone, inside a potential complement: 睡不着 is
 * `shuì bu zháo`, 看不见 `kànbujiàn` and 吃不了 `chī bu liǎo`. It is toneless
 * too in words that grew out of one, such as 对不起, 了不起, 来不及 and 差不多.
 * Everywhere else it keeps `bù`, which sandhi turns to `bú` before a fourth
 * tone: 不对, 不是, and the A-not-A question 是不是, whose 不 is a negation
 * between two copies of one verb rather than a complement.
 *
 * The dictionary cannot carry this. It stores every 不 as `bù`, because its
 * sources bake the tone in inconsistently (see `UNDERLYING_TONES` in
 * `dictionary/reading.ts`), and the 不 of 睡不着 stands between three words the
 * decode reads apart. So this pass runs over the decoded words, before sandhi,
 * and decides from the words around each 不.
 *
 * 國語 keeps the tone in all of these, and the 國語辭典 writes 對不起 as
 * `duìbùqǐ`, so the pass is for 普通话 only.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Locale } from "../script/script.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  CROSS_COMPLEMENTS,
  holdsWords,
  isReadResult,
  isWordComplement,
  withToneless,
} from "./bu-complements.js";
import {
  AFTER_CLAUSE,
  ASPECT,
  DAO,
  SHORT_OF,
  startsCount,
  TAKES_CLAUSE,
  withoutParticles,
} from "./bu-verbs.js";
import { BU_CHARACTER } from "./sandhi-tones.js";
import type { DecodedWord } from "./word.js";

/**
 * Whether a 不 stands between a verb and its complement.
 *
 * `result` is what follows the 不, which is the next word for a 不 standing
 * alone and the rest of the word for one the decode joined to it, such as the
 * 不到 of 做不到. `following` is the word after that.
 */
function isBetween(
  before: DecodedWord,
  result: string,
  following: DecodedWord | undefined,
): boolean {
  const verb = toCharacters(before.text);
  const last = verb.at(-1) ?? "";
  if (
    last === toCharacters(result)[0] ||
    ASPECT.has(last) ||
    last === SHORT_OF
  ) {
    return false;
  }
  const complement = withoutParticles(result);
  if (complement === DAO && startsCount(following)) {
    return false;
  }
  return (
    before.partOfSpeech.startsWith("v") &&
    CROSS_COMPLEMENTS.has(complement) &&
    (!TAKES_CLAUSE.has(before.text) || AFTER_CLAUSE.has(complement))
  );
}

/**
 * Whether the 不 opening a word is the toneless one of a potential complement.
 *
 * A 不 standing alone takes its complement from the word after it, and one
 * the decode joined into a longer word, such as the 不到 of 做不到 or the 不见了
 * of 找不见了, from the rest of that word.
 */
function isComplementBu(
  word: DecodedWord,
  before: DecodedWord | undefined,
  after: DecodedWord | undefined,
  beyond: DecodedWord | undefined,
  seesWords: boolean,
): boolean {
  const characters = toCharacters(word.text);
  if (before === undefined || characters[0] !== BU_CHARACTER) {
    return false;
  }
  if (characters.length > 1) {
    return isBetween(before, characters.slice(1).join(""), after);
  }
  if (after === undefined) {
    return false;
  }
  // The 了 rule finds the verb by the characters, and can read `liǎo` after a
  // word that is no verb at all, as in 但现在不了.
  return (
    (isReadResult(after) && before.partOfSpeech.startsWith("v")) ||
    (seesWords && isBetween(before, after.text, beyond))
  );
}

/**
 * The readings of a run's words with every complement 不 made toneless.
 *
 * `readings` holds one reading per word, which may be a locale's rather than
 * the decoded one, and a word whose reading does not line up with its
 * characters is left alone.
 */
export function neutraliseBu(
  dictionary: Dictionary,
  words: readonly DecodedWord[],
  readings: readonly (readonly Syllable[])[],
  locale: Locale,
): readonly (readonly Syllable[])[] {
  if (locale !== "zh-CN") {
    return readings;
  }
  const seesWords = holdsWords(dictionary);
  return readings.map((reading, index) => {
    const word = words[index];
    /* c8 ignore next 3 -- readings is built by mapping over these same words */
    if (word === undefined) {
      return reading;
    }
    if (toCharacters(word.text).length !== reading.length) {
      return reading;
    }
    if (isWordComplement(word)) {
      return withToneless(reading, 1);
    }
    return isComplementBu(
      word,
      words[index - 1],
      words[index + 1],
      words[index + 2],
      seesWords,
    )
      ? withToneless(reading, 0)
      : reading;
  });
}
