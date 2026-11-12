/**
 * Joining 老 and 小 to the name they address.
 *
 * 老王 is one word and 老 王 is two, and only the prefix says which.
 */
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { characterCount, toCharacters } from "../script/characters.js";
import type { GroupingRule } from "./rule.js";

/**
 * The 称呼语 GB/T 16159 writes in front of a surname.
 *
 * 老 and 小 only. 大 is written the same way in 大李, but it is also an ordinary
 * adjective in front of anything at all, and it is the one that goes wrong:
 * over 88,866 lines the three of them fire 49 times together and both clear
 * mistakes are 大 — 泡大池 is a big pool and 那头大熊 is a big bear. Dropping it
 * leaves 38 firings and every one visible in the sample is a real form of
 * address.
 */
export const ADDRESS_PREFIXES = new Set(["老", "小"]);

/**
 * 老王 is `Lǎo Wáng`: the prefix takes a capital of its own.
 *
 * The words are already written apart — nothing here moves a boundary — and
 * what was missing is only the capital, so this marks the prefix a proper noun
 * and lets the writer do what it already does with one. That is why it is a
 * grouping rule despite grouping nothing: `isProperNoun` is the flag the
 * capital hangs off, and there is one place it is set.
 *
 * The surname is the evidence. A one-character word the dictionary marks a
 * proper noun is what 老 and 小 attach to, and CC-CEDICT's capitalisation has
 * already vetoed the tags that would otherwise let 小 in front of anything —
 * see "jieba's 专名 tags need a second opinion" in ROADMAP.md.
 */
export const ADDRESS_PREFIX: GroupingRule = {
  name: "address-prefix",
  apply: (words) =>
    words.map((word, at) => {
      const next = words[at + 1];
      if (
        !ADDRESS_PREFIXES.has(word.text) ||
        next === undefined ||
        !next.isProperNoun ||
        characterCount(next.text) !== 1 ||
        next.separator !== undefined
      ) {
        return word;
      }
      return { ...word, isProperNoun: true };
    }),
};

/**
 * jieba's tags for the two kinds of proper noun 5.1 divides.
 *
 * A person and an organisation. Places are `PLACE_GENERICS`' business, and `nz`
 * is left out — both are measured out in `docs/orthography/`.
 */

/**
 * The money units the dictionary marks as surnames.
 *
 * 毛 is the surname Máo as well as a tenth of a yuan, and the dictionary flags
 * the character standing alone as a proper noun. 五毛, 十毛 and 两块五毛 are
 * money and take no capital.
 */
export const COUNTED_UNITS = new Set(["毛"]);

/**
 * 五毛 is `wǔ máo`: a unit counted by the number before it is no surname.
 *
 * The mirror of {@link ADDRESS_PREFIX}, taking the capital away where that one
 * adds it. The word before has to be written in numerals only, so 毛泽东 and
 * 姓毛 keep theirs.
 */
export const COUNTED_UNIT: GroupingRule = {
  name: "counted-unit",
  apply: (words) =>
    words.map((word, at) => {
      const before = words[at - 1];
      if (
        !COUNTED_UNITS.has(word.text) ||
        !word.isProperNoun ||
        before === undefined ||
        !toCharacters(before.text).every((character) =>
          QUANTITY_CHARACTERS.has(character),
        )
      ) {
        return word;
      }
      return { ...word, isProperNoun: false };
    }),
};
