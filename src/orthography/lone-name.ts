/**
 * The one-character proper noun that is only a word.
 *
 * The dictionary flags 186 characters standing alone as proper nouns, because
 * they head more names than ordinary words in jieba's corpus (see
 * {@link import("../dictionary/name-mass.js").leadsNames}). That is a fact
 * about the words a character begins. It says nothing about the character met
 * on its own in running text, where 毛 is hair, 云 a cloud, 东 east and 熊 a
 * bear far more often than any of them is a surname.
 */
import type { DecodedWord } from "../decode/word.js";
import { characterCount } from "../script/characters.js";
import { ADDRESS_PREFIXES } from "./address-grouping.js";
import type { GroupingRule } from "./rule.js";
import {
  FAMILY_TITLES,
  STORY_ANIMALS,
  SURNAME_TITLES,
} from "./surname-titles.js";
import { isCountedAt, isDynastyAt, UNFLAGGED_SURNAMES } from "./surnames.js";

/**
 * The words that say the character after them is a surname.
 *
 * 老 and 小 are the address prefixes, and 姓 names the surname outright.
 */
const SURNAME_LEADS = new Set([...ADDRESS_PREFIXES, "姓"]);

/**
 * A lone character keeps its capital only where a name is meant.
 *
 * The character is a name when the words around it say so. That is 老, 小 or
 * 姓 in front of it (老王, 他姓毛), a title after it (王先生, 王奶奶, or
 * 李民先生 with a given name between), or a name part next to it (李华 and
 * 吉姆, which have no entries of their own). A dynasty is named by the word
 * after it (宋本, a Song edition). Everywhere else it is the ordinary word, and
 * 小猫的毛 is `xiǎomāo de máo`.
 *
 * A title or a dynasty word also gives a capital to a character the dictionary
 * does not flag, where that character is a common surname or a dynasty (马奶奶
 * is `Mǎ nǎinai`). That is one of
 * {@link UNFLAGGED_SURNAMES} or {@link DYNASTIES}, and only where no number or
 * demonstrative counts it, since 两张老师的照片 is two photos.
 *
 * A run that is the character and nothing else keeps the capital, since there
 * is nothing to read it against.
 *
 * Runs before {@link import("./address-grouping.js").ADDRESS_PREFIX}, which
 * reads the flag this leaves on the surname.
 */
export const LONE_NAME: GroupingRule = {
  name: "lone-name",
  apply: (words, _dictionary, context) => {
    if (words.length < 2) {
      return words;
    }
    const before = context?.before ?? [];
    const read = [...before, ...words, ...(context?.after ?? [])];
    return words.map((word, at) => nameOf(read, at + before.length) ?? word);
  },
};

/**
 * The character at a position with its capital settled, or undefined where it
 * stays as it is.
 *
 * The words read include those of the runs either side of a gloss (see
 * {@link import("./rule.js").GroupingContext}), so 门贾(假)氏 reads its 贾 as
 * a surname.
 */
function nameOf(
  words: readonly DecodedWord[],
  at: number,
): DecodedWord | undefined {
  const word = words[at];
  if (word === undefined || characterCount(word.text) !== 1) {
    return undefined;
  }
  if (word.isProperNoun) {
    return isNamedAt(words, at) ? undefined : { ...word, isProperNoun: false };
  }
  return isUnflaggedNameAt(words, at)
    ? { ...word, isProperNoun: true }
    : undefined;
}

/**
 * Whether an unflagged character is a surname before a title, or a dynasty.
 */
function isUnflaggedNameAt(words: readonly DecodedWord[], at: number): boolean {
  const word = words[at];
  /* c8 ignore next 3 -- the caller passes an index inside the array */
  if (word === undefined || isCountedAt(words, at)) {
    return false;
  }
  return (
    (UNFLAGGED_SURNAMES.has(word.text) && isTitledAt(words, at)) ||
    isDynastyAt(words, at)
  );
}

/**
 * Whether the words around a lone character mark it a name.
 */
function isNamedAt(words: readonly DecodedWord[], at: number): boolean {
  const before = words[at - 1];
  const after = words[at + 1];
  return (
    (before !== undefined &&
      (SURNAME_LEADS.has(before.text) || isNamePart(before))) ||
    (after !== undefined && isNamePart(after)) ||
    isTitledAt(words, at) ||
    (!isCountedAt(words, at) && isDynastyAt(words, at))
  );
}

/**
 * Whether a title follows the surname at a position.
 *
 * Directly (王先生), across the two words a title can decode as (王小二), or
 * after a one-character given name (李民先生). A kinship term does not make a
 * name of a story's animal, since 熊妈妈 is a mother bear.
 */
function isTitledAt(words: readonly DecodedWord[], at: number): boolean {
  const surname = words[at];
  const after = words[at + 1];
  if (surname === undefined || after === undefined) {
    return false;
  }
  const title = [after.text, after.text + (words[at + 2]?.text ?? "")].find(
    (text) => SURNAME_TITLES.has(text),
  );
  if (title !== undefined) {
    return !(FAMILY_TITLES.has(title) && STORY_ANIMALS.has(surname.text));
  }
  return isTitledGivenName(words.slice(at + 1, at + 3));
}

/**
 * jieba's tags for a name, and for a character it only knows inside one.
 *
 * 姆 is tagged `x`, and 樱 and 莎 `nr` without passing for names on their own.
 */
const NAME_PART_TAG = /^(?:n[rsz]|x$)/u;

/**
 * Whether a word next to the character says a name runs through it.
 *
 * A proper noun does (李华). So does a lone character jieba knows only as part
 * of a name, which is how a name the dictionary lacks decodes: 吉姆 is 吉 and
 * 姆, and 李樱 is 李 and 樱.
 */
function isNamePart(word: DecodedWord): boolean {
  return (
    word.isProperNoun ||
    (characterCount(word.text) === 1 && NAME_PART_TAG.test(word.partOfSpeech))
  );
}

/**
 * Whether the words after a surname are a one-character given name and a
 * title, as in 李民先生.
 *
 * A given name the dictionary lacks decodes as a character of its own, which
 * puts the title two words along.
 */
function isTitledGivenName(following: readonly DecodedWord[]): boolean {
  const [given, title] = following;
  return (
    given !== undefined &&
    title !== undefined &&
    characterCount(given.text) === 1 &&
    SURNAME_TITLES.has(title.text)
  );
}
