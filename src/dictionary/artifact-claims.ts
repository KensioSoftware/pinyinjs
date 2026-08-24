/**
 * Which entry owns each key, since an entry claims both its scripts.
 *
 * Settled before a single line is written, and separately from writing them,
 * because it is the one place the artifact resolves a disagreement rather than
 * recording one: 发 and 髮 both claim 发 and read it differently, and something
 * has to say which of them the key means.
 */
import type { DictionaryEntry } from "./entry.js";
import { byCodeUnit, traditionalForms } from "./artifact-format.js";

/**
 * Let one entry claim each of its 繁體 spellings, where nothing outranks it.
 *
 * A spelling equal to the 简体 headword is already claimed, and a spelling that
 * is some entry's own headword belongs to that entry — 发 and 髮 disagree about
 * the reading, and the one the key names has to win.
 */
function claimTraditional(
  claimed: Map<string, DictionaryEntry>,
  entry: DictionaryEntry,
): void {
  for (const form of traditionalForms(entry)) {
    const held = claimed.get(form);
    const isTaken = form === entry.hans || held?.hans === form;
    if (!isTaken && (held === undefined || entry.frequency > held.frequency)) {
      claimed.set(form, entry);
    }
  }
}

/**
 * Decide which entry owns each key, since an entry claims both its scripts.
 *
 * Entries overlap: 头 claims 頭 as its 繁體 key, and 頭 is also a character
 * entry of its own. They agree, so the conflict is harmless there — but 发 and
 * 髮 both claim 发, and they emphatically do not agree, one reading `fā` and the
 * other `fà`. The entry whose own headword *is* the key wins, which is what
 * keeps 发 on its own reading rather than the one that reached it sideways.
 *
 * An entry claims every 繁體 spelling a source attests for it, not only the one
 * it stores as {@link DictionaryEntry.hant}: 重复 claims 重複 and 重覆 alike,
 * since a reader typing either expects `chóngfù` rather than the character by
 * character reading a missing key falls back to.
 */
export function claimKeys(
  entries: readonly DictionaryEntry[],
): ReadonlyMap<string, DictionaryEntry> {
  const claimed = new Map<string, DictionaryEntry>();

  // Headwords first, so that the second pass can never displace one: a 繁體
  // alias reaching a key sideways must not outrank the entry that key names.
  for (const entry of entries) {
    const held = claimed.get(entry.hans);
    if (held === undefined || entry.frequency > held.frequency) {
      claimed.set(entry.hans, entry);
    }
  }

  for (const entry of entries) {
    claimTraditional(claimed, entry);
  }

  return claimed;
}

/**
 * The claimed keys in the order the artifact writes them.
 *
 * Sorted once, so that each of the files built from these keys is written from
 * the entry it belongs to rather than from a second search for it, and so that
 * they agree about which position holds which word.
 */
export function orderedClaims(
  claimed: ReadonlyMap<string, DictionaryEntry>,
): readonly (readonly [string, DictionaryEntry])[] {
  return [...claimed].toSorted(([left], [right]) => byCodeUnit(left, right));
}
