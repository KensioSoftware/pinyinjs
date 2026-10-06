/**
 * Whether a 干 means "to concern", which is `gān` and is written 干 in both
 * scripts.
 *
 * 干 has three senses. `gàn` is to do (幹), `gān` is dry (乾), and `gān` is
 * also to concern or to have to do with (干). The dictionary stores 干 as
 * `gàn`, and the third sense lives almost entirely in a handful of set frames:
 * 这不干你的事, 干你什么事, 与你无干 and 干卿底事.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";

/**
 * The character. 简体 and 繁體 both write the "to concern" sense this way.
 */
export const CONCERNING = "干";

/**
 * Whether a syllable is `gān`.
 */
export function isGan(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "g" && syllable.final === "an" && syllable.tone === 1
  );
}

/**
 * The pronouns a 干 frame concerns, in both scripts.
 */
const PRONOUNS = new Set(["你", "我", "他", "她", "它", "您", "咱", "俺"]);

/**
 * The plural suffix a pronoun can take, in both scripts.
 */
const PLURAL = new Set(["们", "們"]);

/**
 * What 干 + pronoun asks about in 干你什么事 and 干你屁事.
 */
const WHAT = ["什么", "什麼", "啥", "屁", "鸟", "鳥"];

/**
 * What 干卿 asks about, in 干卿何事 and 干卿底事.
 */
const WHICH = new Set(["何", "底", "甚"]);

/**
 * The negation in front of 无干, in both scripts.
 */
const WITHOUT = new Set(["无", "無"]);

/**
 * Where a pronoun starting at a position ends, or undefined where none starts
 * there.
 */
function pronounEndingFrom(
  characters: readonly string[],
  at: number,
): number | undefined {
  if (!PRONOUNS.has(characters[at] ?? "")) {
    return undefined;
  }
  return PLURAL.has(characters[at + 1] ?? "") ? at + 2 : at + 1;
}

/**
 * Whether the text from a position spells one of a list of words.
 */
function spellsAt(
  characters: readonly string[],
  at: number,
  word: string,
): boolean {
  return toCharacters(word).every(
    (character, offset) => characters[at + offset] === character,
  );
}

/**
 * 不干你的事 and 不干我事: 不 in front, a pronoun after, then (的)事.
 */
function isNotConcerning(characters: readonly string[], at: number): boolean {
  if (characters[at - 1] !== "不") {
    return false;
  }
  let after = pronounEndingFrom(characters, at + 1);
  if (after === undefined) {
    return false;
  }
  if (characters[after] === "的") {
    after++;
  }
  return characters[after] === "事";
}

/**
 * 干你什么事 and 干你屁事: a pronoun after, then what about it.
 *
 * The pronoun is what separates this from 你干什么事, which is the verb.
 */
function isAskingWhat(characters: readonly string[], at: number): boolean {
  const after = pronounEndingFrom(characters, at + 1);
  if (after === undefined) {
    return false;
  }
  return WHAT.some(
    (what) =>
      spellsAt(characters, after, what) &&
      characters[after + toCharacters(what).length] === "事",
  );
}

/**
 * 干卿何事 and 干卿底事.
 */
function isAskingWhich(characters: readonly string[], at: number): boolean {
  return (
    characters[at + 1] === "卿" &&
    WHICH.has(characters[at + 2] ?? "") &&
    characters[at + 3] === "事"
  );
}

/**
 * 与你无干: 无 in front, and no tagged word of 干's own after.
 *
 * 毫无干劲, 无干扰 and 无干粮 hold 干劲, 干扰 and 干粮, and those carry their
 * own readings.
 */
function isUnconcerned(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): boolean {
  if (!WITHOUT.has(characters[at - 1] ?? "")) {
    return false;
  }
  for (let to = at + 2; to <= Math.min(characters.length, at + 4); to++) {
    const word = characters.slice(at, to).join("");
    if ((dictionary.lookup(word)?.partOfSpeech ?? "") !== "") {
      return false;
    }
  }
  return true;
}

/**
 * Whether the 干 at a position means "to concern".
 *
 * Four frames, each matched as characters: 不干你的事, 干你什么事, 干卿何事
 * and 与你无干. A 干 with a pronoun after it is not enough on its own, because
 * 你干你的事 tells someone to get on with their own work and is `gàn`. 不 in
 * front or a question after is what makes it the other sense.
 */
export function isConcerningAt(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): boolean {
  if (characters[at] !== CONCERNING) {
    return false;
  }
  return (
    isNotConcerning(characters, at) ||
    isAskingWhat(characters, at) ||
    isAskingWhich(characters, at) ||
    isUnconcerned(dictionary, characters, at)
  );
}
