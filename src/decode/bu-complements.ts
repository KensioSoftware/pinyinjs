/**
 * The words that decide whether a 不 is toneless.
 *
 * What may follow 不 as a result, what may stand before it as a verb, and the
 * tests on a single word that read them, with the step that drops the tone.
 * `neutral-bu.ts` puts them together over a run.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { BU_CHARACTER } from "./sandhi-tones.js";
import type { DecodedWord } from "./word.js";

/**
 * What can follow 不 inside a word to make it a potential complement.
 *
 * Built from the three-character words the dictionary holds in the shape
 * X不Y: 了不得, 忍不住, 比不上, 买不起, 信不过, 受不了, 想不到, 用不着, 来不及,
 * 说不定, 看不清, 过不去, 想不开, 行不通, 吃不下, 合不来, 拿不准, 看不懂,
 * 说不出, 看不见, 拿不动, 打不倒, 数不尽, 保不齐 and 合不拢嘴.
 *
 * Left out on purpose: 是, which gives 可不是, 要不是 and 赔不是 (`péi búshì`,
 * where 不是 is a noun); 成, 如, 然 and 错, which give 难不成, 还不如, 要不然
 * and 很不错; and 透, since 密不透风 is `mìbùtòufēng`.
 */
const WORD_COMPLEMENTS = new Set(
  toCharacters(
    "得住上起过過了到着著及定清去开開通下来來准準懂出见見动動倒尽盡齐齊拢攏",
  ),
);

/**
 * Words whose 不 is toneless though nothing after it is a complement.
 */
const LEXICALISED = new Set([
  "差不多",
  "差不离",
  "差不離",
  "冷不丁",
  "冷不防",
  "猛不防",
]);

/**
 * Characters before 不 that are not the verb of a complement.
 *
 * 只不过 is `zhǐbùguò`, 无不及 `wúbùjí` and 眼不见 `yǎn bú jiàn`.
 */
const NOT_VERBS = new Set(toCharacters("只無无眼獨独"));

/**
 * The part-of-speech tag of a 成语.
 *
 * A 成语's 不 is classical negation and keeps its tone: 迫不及待 is
 * `pòbùjídài`.
 */
const IDIOM_TAG = "i";

/**
 * What can follow a standalone 不 as the complement of the verb before it.
 *
 * Narrower than {@link WORD_COMPLEMENTS}, because across words the verb may be
 * one that takes a whole clause: 我决定不去了 is `bú qù`, deciding not to go.
 * So the bare directions 来, 去, 上 and 过 are out, and so are 回来 and 进去,
 * which 决定不回来 negates. 懂 is out because 欺负不懂中文的人 and 面对不懂的问题
 * negate it, and 看不懂, 听不懂 and 搞不懂 are words. What is left is rarely a
 * verb in its own right after 不.
 */
export const CROSS_COMPLEMENTS = new Set([
  ...toCharacters("住起及动動完见見到掉清惯慣下出开開"),
  "出来",
  "出來",
  "起来",
  "起來",
  "下来",
  "下來",
  "下去",
]);

/**
 * The results a decode rule has already read as a potential complement.
 *
 * 睡不着 reads its 着 `zháo` and 吃不了 its 了 `liǎo` only where
 * `zhao-rule.ts` and `liao-rule.ts` found a verb, 不 and complement, so a 不
 * before either is toneless with nothing further to check.
 */
export const READ_RESULTS: ReadonlyMap<
  string,
  Pick<Syllable, "final" | "tone">
> = new Map([
  ["着", { final: "ao", tone: 2 }],
  ["著", { final: "ao", tone: 2 }],
  ["了", { final: "iao", tone: 3 }],
]);

/**
 * Whether the 不 of a word, its second character, is toneless.
 */
export function isWordComplement(word: DecodedWord): boolean {
  const characters = toCharacters(word.text);
  if (characters.length < 3 || characters[1] !== BU_CHARACTER) {
    return false;
  }
  if (LEXICALISED.has(characters.slice(0, 3).join(""))) {
    return true;
  }
  const [verb = "", , result = ""] = characters;
  return (
    word.partOfSpeech !== IDIOM_TAG &&
    verb !== result &&
    WORD_COMPLEMENTS.has(result) &&
    !NOT_VERBS.has(verb)
  );
}

/**
 * Whether a word's reading is the result a rule has already read.
 */
export function isReadResult(word: DecodedWord): boolean {
  const expected = READ_RESULTS.get(word.text);
  const [syllable] = word.reading;
  return (
    expected !== undefined &&
    syllable?.final === expected.final &&
    syllable.tone === expected.tone
  );
}

/**
 * A word every tier but core holds.
 */
const PROBE_WORD = "对不起";

/**
 * Whether the dictionary holds words at all.
 *
 * The core tier holds characters only, and every 不 it decodes stands between
 * two characters. Without words to see, 固定不动 and 决定不开除 look the same
 * as 走不动 and 打不开, so the core tier takes only the results the 着 and 了
 * rules have already read.
 */
export function holdsWords(dictionary: Dictionary): boolean {
  return dictionary.lookup(PROBE_WORD) !== undefined;
}

/**
 * A reading with one syllable made toneless.
 */
export function withToneless(
  reading: readonly Syllable[],
  at: number,
): readonly Syllable[] {
  // The tone it had is kept, which Gwoyeu Romatzyh spells behind its dot:
  // 对不起 is `duey.buh.chii`.
  return reading.map((syllable, index) =>
    index === at
      ? {
          ...syllable,
          tone: NEUTRAL_TONE,
          ...(syllable.tone !== undefined && {
            originalTone: syllable.originalTone ?? syllable.tone,
          }),
        }
      : syllable,
  );
}
