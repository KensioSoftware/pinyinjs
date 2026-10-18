/**
 * What the modifier before a 的 says about the 话 after it: 他刻薄的话,
 * 说了很蠢的话, 用通俗的话解释.
 */
import { toCharacters } from "../script/characters.js";
import {
  type EdgeContext,
  wordEndingAt,
  wordsEndingAt,
  wordStartingAt,
} from "./rules.js";
import { at } from "./hua-speaking.js";
import {
  DEGREE,
  EXPLAINING,
  OF_SPEECH,
  PERSONS,
  SPEAKING,
  SPEAKING_TAIL,
} from "./hua-words.js";

/**
 * Whether the 的 follows an adjective of speech that somebody said.
 *
 * The adjective can carry a degree (很蠢, 这么卑鄙), and before it stands a
 * speaker (他刻薄的话), a verb of speaking (说出这么卑鄙的话, 说了很蠢的话) or
 * another 的 (我说过的最愚蠢的话). A bare 难听的话 is left to the conditional.
 */
export function describesSpeech(context: EdgeContext, from: number): boolean {
  const quality = wordsEndingAt(context, from, 2).find((word) =>
    OF_SPEECH.has(word),
  );
  if (quality === undefined) {
    return false;
  }
  let start = from - toCharacters(quality).length;
  const degree = wordsEndingAt(context, start, 2).find((word) =>
    DEGREE.has(word),
  );
  if (degree !== undefined) {
    start -= toCharacters(degree).length;
  }
  if (
    at(context, start - 1) === "的" ||
    wordsEndingAt(context, start, 2).some((word) => PERSONS.has(word))
  ) {
    return true;
  }
  let verb = start - 1;
  while (verb > start - 4 && SPEAKING_TAIL.has(at(context, verb))) {
    verb -= 1;
  }
  return SPEAKING.has(at(context, verb));
}

/**
 * Whether the 话 is the words something is put in: 用通俗的话解释.
 *
 * A 用 in the few characters before the 的, standing as a word of its own, and
 * a verb of explaining at the 话's end or one character on (再说一遍,
 * 做解释). 用电脑的话就快多了 has no such verb and stays the conditional, and so
 * does 有用的话, whose 用 is half of another word.
 */
export function explainsIn(
  context: EdgeContext,
  from: number,
  to: number,
): boolean {
  let uses = false;
  for (let index = from - 1; index >= Math.max(0, from - 5); index--) {
    const character = at(context, index);
    if (character === "的") {
      return false;
    }
    if (character === "用" && wordEndingAt(context, index + 1, 2) === "用") {
      uses = true;
      break;
    }
  }
  return (
    uses &&
    [to, to + 1].some((index) => {
      const word = wordStartingAt(context, index);
      return word !== undefined && EXPLAINING.includes(word);
    })
  );
}
