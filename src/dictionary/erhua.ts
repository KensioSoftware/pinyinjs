import type { Syllable } from "../syllable/syllable.js";

/**
 * The character 儿化 is written with.
 */
const ER = "儿";

/**
 * The traditional form of {@link ER}, so that 玩兒 is recognised too.
 */
const ER_HANT = "兒";

/**
 * Words ending in 儿 where the 儿 is a syllable of its own, not an r suffix.
 *
 * Only consulted where CC-CEDICT has no entry for the word, since its explicit
 * `r5` token settles the question wherever it reaches. The phrase corpus cannot
 * settle it: it writes both cases as a separate `er` syllable, and the tone does
 * not separate them either — 这儿 `zhè ér` is 儿化 while 女儿 `nǚ ér` is not,
 * and both are written with a tone.
 *
 * Every word here has 儿 meaning "child" or "son" rather than acting as a
 * diminutive suffix, which is what the distinction comes down to.
 */
export const NON_ERHUA_ER_WORDS: ReadonlySet<string> = new Set([
  "儿",
  "女儿",
  "儿子",
  "儿女",
  "儿童",
  "儿科",
  "儿孙",
  "儿媳",
  "儿媳妇",
  "婴儿",
  "幼儿",
  "孤儿",
  "男儿",
  "健儿",
  "宠儿",
  "孩儿",
  "娇儿",
  "少儿",
  "小儿",
  "干儿",
  "侄儿",
  "胎儿",
  "育儿",
  "托儿",
  "产儿",
  "新生儿",
  "混血儿",
  "私生儿",
  "白痴儿",
  "健康儿",
  "早产儿",
  "试管婴儿",
]);

/**
 * Whether a word's last character is 儿, in either script.
 */
export function isErFinal(word: string): boolean {
  return word.length > 1 && (word.endsWith(ER) || word.endsWith(ER_HANT));
}

/**
 * Whether a character is the 儿 that 儿化 folds into the syllable before it.
 */
export function isErCharacter(character: string): boolean {
  return character === ER || character === ER_HANT;
}

/**
 * Whether a syllable is a bare `er`, which is how the phrase corpus writes 儿化.
 *
 * The tone is deliberately not looked at. Upstream writes 玩儿 as `wán er` and
 * 这儿 as `zhè ér`, and both are 儿化; the tone tells us nothing.
 */
function isBareEr(syllable: Syllable): boolean {
  return syllable.initial === "" && syllable.final === "er";
}

/**
 * Add the r suffix of 儿化 to a syllable.
 *
 * Almost always just a flag, but not for a bare `e`: r-colouring `é` produces
 * exactly `ér`, and pinyin writes the two identically. Recording that as `e`
 * plus a suffix would claim a distinction the spelling cannot carry, and the
 * claim does not survive a round trip through an artifact — 蛾儿 comes back as
 * the syllable `ér` however it was stored, because that is what `er2` means.
 * So the suffix is absorbed into the final instead, which is also what actually
 * happens in the mouth.
 */
export function withErhua(syllable: Syllable): Syllable {
  if (
    syllable.initial === "" &&
    (syllable.final === "e" || syllable.final === "er")
  ) {
    return { initial: "", final: "er", tone: syllable.tone };
  }
  return { ...syllable, erhua: true };
}

/**
 * Fold a trailing `er` syllable into the syllable before it as an r suffix.
 *
 * This is the repair the phrase corpus needs: it emits 玩儿 as two syllables,
 * `wán er`, where the word is one syllable, `wánr`. Returns the reading
 * unchanged when there is no trailing `er` to fold, so it is safe to call on a
 * reading that is already correct — CC-CEDICT's, for instance.
 */
export function attachErhua(
  syllables: readonly Syllable[],
): readonly Syllable[] {
  const last = syllables.at(-1);
  const previous = syllables.at(-2);
  if (
    syllables.length < 2 ||
    last === undefined ||
    previous === undefined ||
    !isBareEr(last) ||
    previous.erhua === true
  ) {
    return syllables;
  }
  return [...syllables.slice(0, -2), withErhua(previous)];
}
