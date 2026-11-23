/**
 * Where 國語 keeps the full tones 普通话 reads only in context.
 *
 * 國語 reads 地方 as `dìfāng` and 地道 as `dìdào` in every sense. The
 * dictionary stores the 轻声 of 普通话's everyday senses, and the rules in
 * `difang-rule.ts` read the full tones only where the context names the other
 * sense. A `zh-TW` conversion leaves those rules out and restores the tones.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Locale } from "../script/script.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { DIDAO, DIFANG } from "./difang-rule.js";
import {
  READING_RULES,
  REGIONAL_DIFANG,
  TUNNEL_DIDAO,
} from "./reading-rules.js";
import type { EdgeRule } from "./rules.js";
import type { DecodedWord } from "./word.js";

/**
 * The rules a decode for `zh-TW` applies: all but the two that take 地方 and
 * 地道 apart, so both words stay whole.
 */
const TAIWAN_READING_RULES: readonly EdgeRule[] = READING_RULES.filter(
  (rule) => rule !== REGIONAL_DIFANG && rule !== TUNNEL_DIDAO,
);

/**
 * The rules the lattice decode applies for a locale.
 */
export function readingRulesFor(locale: Locale): readonly EdgeRule[] {
  return locale === "zh-TW" ? TAIWAN_READING_RULES : READING_RULES;
}

/**
 * The 國語 reading of a 地方 or 地道, or undefined for any other word.
 *
 * The dictionary stores both words with the 轻声 of 普通话's everyday senses,
 * and no 國語 delta beside it. The merge drops one, because the full-tone
 * reading is also a 普通话 sense of the same word. Each toneless
 * syllable takes the tone of its character read alone, so 方 is `fāng` and 道
 * is `dào`, as the 國語辭典 writes them.
 */
export function taiwanReadingOf(
  dictionary: Dictionary,
  word: DecodedWord,
): readonly Syllable[] | undefined {
  if (word.text !== DIFANG && word.text !== DIDAO) {
    return undefined;
  }
  const characters = toCharacters(word.text);
  return word.reading.map((syllable, at) => {
    if (syllable.tone !== NEUTRAL_TONE) {
      return syllable;
    }
    const [own] = dictionary.lookup(characters[at] ?? "")?.reading ?? [];
    return own !== undefined &&
      own.initial === syllable.initial &&
      own.final === syllable.final
      ? own
      : syllable;
  });
}
