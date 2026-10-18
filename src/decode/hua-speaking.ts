/**
 * What a verb of speaking says about the 话 after a 的: 说的话, 说这样的话,
 * 说句简单的话.
 */
import { toCharacters } from "../script/characters.js";
import { type EdgeContext, wordEndingAt } from "./rules.js";
import {
  SPEAKING,
  NOT_SPEAKING,
  ASKING,
  SPEAKING_TAIL,
  MANNER,
  KIND,
} from "./hua-words.js";

/**
 * The character at a position, or the empty string beyond either end.
 */
export function at(context: EdgeContext, index: number): string {
  return context.characters[index] ?? "";
}

/**
 * Whether the 的 is the object marker of a verb of speaking.
 *
 * 说的话, 所说的话, 说过的话 and 说出来的话 all qualify, unless a manner stands in
 * front of the verb or somebody is asked for an opinion: 这么说的话 is *if you
 * put it like that* and 要我说的话 is *if you ask me*.
 */
export function followsSpeaking(context: EdgeContext, from: number): boolean {
  let verb = from - 1;
  while (verb > from - 4 && SPEAKING_TAIL.has(at(context, verb))) {
    verb -= 1;
  }
  if (!SPEAKING.has(at(context, verb))) {
    return false;
  }
  const word = wordEndingAt(context, verb + 1, 2);
  if (word !== undefined && NOT_SPEAKING.has(word)) {
    return false;
  }
  if (ASKING.has(at(context, verb - 2)) && at(context, verb - 1) === "我") {
    return false;
  }
  const manner = wordEndingAt(context, verb, 2);
  return manner === undefined || !MANNER.has(manner);
}

/**
 * Whether the 的 follows a kind of words a verb of speaking is saying.
 *
 * 说这样的话, 说过那样的话 and 讲同样的话.
 */
export function saysKind(context: EdgeContext, from: number): boolean {
  const kind = wordEndingAt(context, from, 2);
  if (kind === undefined || !KIND.has(kind)) {
    return false;
  }
  let verb = from - toCharacters(kind).length - 1;
  if (SPEAKING_TAIL.has(at(context, verb))) {
    verb -= 1;
  }
  return SPEAKING.has(at(context, verb));
}

/**
 * Whether a 句, or a 些 after a verb of speaking, counts the words.
 *
 * 句 is the classifier of 话 and of little else a 的话 could follow, so one in
 * the few characters before the 的 is counting the head: 一句感谢的话,
 * 说句简单的话. 些 counts anything, 有些人不来的话 among them, so it counts the
 * words only when it is what is said: 说些傻乎乎的话, 说一些下流的话.
 */
export function isCounted(context: EdgeContext, from: number): boolean {
  for (let index = from - 1; index >= Math.max(0, from - 4); index--) {
    const character = at(context, index);
    if (character === "的") {
      return false;
    }
    if (character === "句") {
      return true;
    }
    if (character === "些") {
      const verb = at(context, index - 1) === "一" ? index - 2 : index - 1;
      return SPEAKING.has(at(context, verb));
    }
  }
  return false;
}
