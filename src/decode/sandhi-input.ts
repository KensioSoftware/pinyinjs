/**
 * What the sandhi pass needs from a decoded run, beyond the syllables.
 *
 * Two questions sandhi cannot answer from a reading alone. Third-tone sandhi
 * applies inside a prosodic foot, so it has to be told where the words and
 * their parts are. 一 sandhi asks what stands in front of the 一, and the answer
 * is a character rather than a spelling. Both are things the decode knows and
 * the syllable array does not.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { divisionOf } from "./constituents.js";
import type { SandhiGrouping } from "./sandhi.js";
import type { ScoredWord } from "./word.js";

/**
 * Where the words and their constituents fall, for third-tone sandhi.
 *
 * Undefined unless third-tone sandhi was asked for, since dividing a word costs
 * dictionary lookups and nothing else reads the answer.
 */
export function groupingOf(
  dictionary: Dictionary,
  words: readonly ScoredWord[],
  readings: readonly (readonly Syllable[])[],
  isThirdTone: boolean,
): SandhiGrouping | undefined {
  if (!isThirdTone) {
    return undefined;
  }
  return words.map((scored, index) => {
    const reading = readings[index] ?? [];
    return divisionOf(dictionary, scored.word.text, reading) ?? reading.length;
  });
}

/**
 * One 汉字 per syllable, where a word offers one.
 *
 * A word whose reading is a different length from its text — 玩儿 as `wánr` —
 * has no character to give any one of its syllables, so its syllables get none
 * and the pass falls back to their spellings. See
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
