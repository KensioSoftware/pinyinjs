/**
 * What the sandhi pass needs from a decoded run, beyond the syllables.
 *
 * Two questions sandhi cannot answer from a reading alone. Where the words and
 * their parts are, which third-tone sandhi needs for the prosodic foot it
 * applies inside and 一 needs for the word ends. And which 汉字 each syllable
 * reads, which is what says a `yī` is 一 rather than 医 and what stands in front
 * of it. Both are things the decode knows and the syllable array does not.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { divisionOf } from "./constituents.js";
import type { SandhiGrouping } from "./sandhi.js";
import type { ScoredWord } from "./word.js";

/**
 * Where the words and their constituents fall.
 *
 * One entry per word always, because 一 sandhi reads the word ends: a 一 that
 * closes a longer word is not counting the word after it, so 唯一 stays `wéiyī`
 * in front of anything.
 *
 * Where a word *divides* is only worked out for third-tone sandhi, which is the
 * only pass that reads it and costs a dictionary lookup per word to answer.
 */
export function groupingOf(
  dictionary: Dictionary,
  words: readonly ScoredWord[],
  readings: readonly (readonly Syllable[])[],
  isThirdTone: boolean,
): SandhiGrouping {
  return words.map((scored, index) => {
    const reading = readings[index] ?? [];
    if (!isThirdTone) {
      return reading.length;
    }
    return divisionOf(dictionary, scored.word.text, reading) ?? reading.length;
  });
}

/**
 * One 汉字 per syllable, where a word offers one.
 *
 * A word whose reading is a different length from its text — 玩儿 as `wánr` —
 * has no character to give any one of its syllables, so its syllables get none
 * and the pass falls back to their spellings. See
 * {@link import("./sandhi-tones.js").isYi} and
 * {@link import("./sandhi-tones.js").isCounting}.
 */
export function charactersPerSyllable(
  words: readonly ScoredWord[],
  readings: readonly (readonly Syllable[])[],
): readonly (string | undefined)[] {
  return words.flatMap((scored, index): readonly (string | undefined)[] => {
    const reading = readings[index] ?? [];
    const held = toCharacters(scored.word.text);
    return held.length === reading.length
      ? held
      : Array.from<string | undefined>({ length: reading.length });
  });
}
