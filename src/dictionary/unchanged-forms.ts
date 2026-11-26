/**
 * The 简体 characters 繁體 also writes unchanged, as two sources agree.
 *
 * 后 is 後 in 以后 and 后来, and stays 后 in 皇后 and 太后. The pairing tally
 * sees both, but 后 written as itself is 30 words against 985, under the share
 * a rival needs. 价, 广 and 厂 have it worse. Their unchanged senses (a
 * messenger, two radicals) live in CC-CEDICT's one-character entries, and the
 * merge folds each into a single 简体 entry written 價, 廣 and 廠.
 */
import { toCharacters } from "../script/characters.js";
import { type CharacterConversion, formsOf } from "../script/conversion.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { OpenCcTable } from "../sources/opencc.js";

/**
 * A definition that only points at another character.
 *
 * CC-CEDICT records 虫 as `variant of 蟲|虫[chong2]`. That entry says 虫 can
 * stand for 蟲 (a cross-reference), and gives no sense of its own that 繁體
 * writes as 虫.
 */
const CROSS_REFERENCE =
  /^(old |archaic |ancient |erroneous |Japanese )?variant of /u;

/**
 * Whether an entry has a sense of its own beyond pointing at a variant.
 */
function hasOwnSense(entry: CedictEntry): boolean {
  return entry.definitions.some(
    (definition) => !CROSS_REFERENCE.test(definition),
  );
}

/**
 * The characters CC-CEDICT writes unchanged in its 繁體 column.
 *
 * Counted by position, in entries whose two forms have the same length and
 * that carry a sense of their own.
 */
function writtenUnchanged(cedict: readonly CedictEntry[]): Set<string> {
  const unchanged = new Set<string>();
  for (const entry of cedict) {
    const hans = toCharacters(entry.simplified);
    const hant = toCharacters(entry.traditional);
    if (hans.length !== hant.length || !hasOwnSense(entry)) {
      continue;
    }
    hans.forEach((character, at) => {
      if (hant[at] === character) {
        unchanged.add(character);
      }
    });
  }
  return unchanged;
}

/**
 * The characters both OpenCC and CC-CEDICT write unchanged in 繁體.
 *
 * OpenCC lists 后 among its own 繁體 forms (its line for 后 reads `後 后`).
 * CC-CEDICT writes 后 unchanged in 皇后. Either source alone lets through too
 * much. OpenCC also lists 种 and 胜 as their own forms for senses no corpus
 * here writes, and CC-CEDICT pairs 凄 and 听 with themselves for literary
 * senses OpenCC leaves out.
 *
 * Most characters in the result never change at all, and the script tables
 * hold no entry for them. `withUnchangedForms` skips those.
 */
export function unchangedTraditional(
  openCc: OpenCcTable,
  cedict: readonly CedictEntry[],
): ReadonlySet<string> {
  const attested = writtenUnchanged(cedict);
  const unchanged = new Set<string>();
  for (const [character, forms] of openCc) {
    if (forms.includes(character) && attested.has(character)) {
      unchanged.add(character);
    }
  }
  return unchanged;
}

/**
 * Add each character's own form to its rivals, where 繁體 also writes it.
 *
 * Only `also` changes. The default and the readings stay as the tally made
 * them, so 以后 still converts to 以後 and the word exceptions are unchanged.
 * What moves is the report. 后 now names 后 as the road not taken, and a
 * caller asking for every form 后 takes gets both.
 */
export function withUnchangedForms(
  table: ReadonlyMap<string, CharacterConversion>,
  unchanged: ReadonlySet<string>,
): ReadonlyMap<string, CharacterConversion> {
  const widened = new Map(table);
  for (const character of unchanged) {
    const conversion = table.get(character);
    if (conversion === undefined || formsOf(conversion).includes(character)) {
      continue;
    }
    widened.set(character, {
      ...conversion,
      also: [...(conversion.also ?? []), character],
    });
  }
  return widened;
}
