import { HYPHENATED_IDIOM_FORMS } from "./idiom-list.js";
import { type GroupingRule, hyphenate } from "./rule.js";

/**
 * The 成语 hyphen, from the list, since no rule reaches it.
 *
 * GB/T 16159 6.3.2 hyphenates a four-syllable 成语 that can be read as two
 * disyllables and writes the rest solid. Which of the two an idiom is cannot be
 * derived from anything this package holds — see
 * [the list](./idiom-list.ts) for the measurement — so the list is the rule's
 * whole evidence, and an idiom that is not on it is written the way it was
 * before: solid, which is what the standard does with the ones that cannot be
 * halved.
 *
 * Every entry decodes as a single four-syllable word, so this only ever cuts
 * something the dictionary already agreed was one word, and cuts it where the
 * list says.
 */
export const IDIOM_HYPHENS: GroupingRule = {
  name: "idiom-hyphens",
  apply: (words) =>
    words.flatMap((word) =>
      HYPHENATED_IDIOM_FORMS.has(word.text) ? hyphenate(word, 2) : [word],
    ),
};
