/**
 * Whether a 干 standing alone means "dry", which is `gān` and is written 乾
 * in 繁體.
 *
 * The dictionary stores 干 as `gàn`, to do, and a word settles most of the
 * dry ones: 干燥, 干净, 饼干, 晒干. A 干 that is a word of its own is dry far
 * less often than it is the verb, so the default stands, and these frames are
 * where the sentence says otherwise. Each is matched as characters, the way
 * the "to concern" frames in `gan-frames.ts` are.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { isWetThingDrying, spellsBefore } from "./dry-gan-subject.js";
import {
  DEGREE,
  DRYING,
  LIST_BREAK,
  MEASURES,
  POTENTIAL,
} from "./dry-gan-words.js";

/**
 * The character. 繁體 writes the dry sense 乾 and the verb 幹, so only the
 * 简体 is ambiguous.
 */
const DRY = "干";

/**
 * The 又 of 又干又冷, the "both … and" frame.
 */
const BOTH = "又";

/**
 * 又干又冷 and 又冷又干.
 *
 * The 又 straight after 干 is what separates 又干又冷 from 他又干了一天,
 * which is the verb.
 */
function isBothAnd(characters: readonly string[], at: number): boolean {
  if (characters[at - 1] !== BOTH) {
    return false;
  }
  if (characters[at + 1] === BOTH) {
    return true;
  }
  if (characters[at - 3] === BOTH) {
    return true;
  }
  return (
    LIST_BREAK.has(characters[at - 2] ?? "") && characters[at - 4] === BOTH
  );
}

/**
 * 很干 and 太干了: a degree word in front.
 */
function isGraded(characters: readonly string[], at: number): boolean {
  if (characters[at + 1] === "得") {
    return false;
  }
  for (const degree of DEGREE) {
    if (spellsBefore(characters, at, degree)) {
      return true;
    }
  }
  return false;
}

/**
 * 拧干 and 晾不干: a drying verb in front, with 不 or 得 between.
 */
function isDriedBy(characters: readonly string[], at: number): boolean {
  const before = characters[at - 1] ?? "";
  if (DRYING.has(before)) {
    return true;
  }
  return POTENTIAL.has(before) && DRYING.has(characters[at - 2] ?? "");
}

/**
 * 一条干毛巾: a measure word in front and a noun after.
 */
function isCountedThing(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): boolean {
  if (!MEASURES.has(characters[at - 1] ?? "")) {
    return false;
  }
  for (let to = Math.min(characters.length, at + 4); to > at + 1; to--) {
    const word = characters.slice(at + 1, to).join("");
    const tag = dictionary.lookup(word)?.partOfSpeech ?? "";
    if (tag !== "") {
      return tag.startsWith("n");
    }
  }
  return false;
}

/**
 * Whether a tagged word of more than one character starts at the 干.
 *
 * 很干练 is capable and 一条干渠 is a canal, and a word the dictionary tags
 * keeps its own reading. 干了 and 干啥 are held untagged, as the phrase
 * corpus wrote them, and do not count: 衣服干了 is dry.
 */
function startsTaggedWord(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): boolean {
  for (let to = Math.min(characters.length, at + 4); to > at + 1; to--) {
    const word = characters.slice(at, to).join("");
    if ((dictionary.lookup(word)?.partOfSpeech ?? "") !== "") {
      return true;
    }
  }
  return false;
}

/**
 * Whether the 干 at a position means "dry".
 *
 * Five frames: 又干又冷, a degree word in front (很干), a drying verb in front
 * (拧干), a measure word and a noun around it (一条干毛巾), and a wet thing as
 * its subject (衣服还没干).
 */
export function isDryAt(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): boolean {
  if (characters[at] !== DRY || startsTaggedWord(dictionary, characters, at)) {
    return false;
  }
  return (
    isBothAnd(characters, at) ||
    isGraded(characters, at) ||
    isDriedBy(characters, at) ||
    isCountedThing(dictionary, characters, at) ||
    isWetThingDrying(characters, at)
  );
}
