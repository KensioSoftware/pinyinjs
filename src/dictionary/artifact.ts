import { toCharacters } from "../script/characters.js";
export {
  findRoundTripFailure,
  readArtifact,
  readingsByKey,
} from "./artifact-read.js";
import type { DictionaryEntry } from "./entry.js";
import { FrequencyTable } from "./frequency-table.js";
import { KeyIndex } from "./key-index.js";
import {
  ALTERNATE,
  BOUNDARY_SEPARATOR,
  byCodeUnit,
  COLUMN,
  type DictionaryArtifact,
  encodeReading,
  LINE,
  PROPER_NOUN_FLAG,
  traditionalForms,
} from "./artifact-format.js";

export {
  decodeReading,
  type DictionaryArtifact,
  encodeReading,
  traditionalForms,
} from "./artifact-format.js";
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
 * The default reading of each single character, as the artifact records it.
 */
function characterDefaults(
  claimed: ReadonlyMap<string, DictionaryEntry>,
): ReadonlyMap<string, string> {
  const defaults = new Map<string, string>();
  for (const [key, entry] of claimed) {
    if (toCharacters(key).length === 1) {
      defaults.set(key, encodeReading(entry.readings.cn));
    }
  }
  return defaults;
}

/**
 * Whether a word's reading is just its characters' default readings in order.
 *
 * 87.8% of multi-character entries answer yes, measured on the real merge, and
 * those need no stored reading at all — which is where most of the artifact's
 * bytes were going. Single characters are excluded because they *are* the
 * defaults, so deriving them would be circular.
 */
function isDerivable(
  key: string,
  reading: string,
  defaults: ReadonlyMap<string, string>,
): boolean {
  const parts = toCharacters(key);
  if (parts.length < 2) {
    return false;
  }
  const derived: string[] = [];
  for (const character of parts) {
    const value = defaults.get(character);
    if (value === undefined) {
      return false;
    }
    derived.push(value);
  }
  return derived.join(" ") === reading;
}

/**
 * Drop trailing empty columns, which is most of them on a typical line.
 */
function trimColumns(columns: readonly string[]): string {
  let end = columns.length;
  while (end > 0 && columns[end - 1] === "") {
    end--;
  }
  return columns.slice(0, end).join(COLUMN);
}

/**
 * Compile merged entries into the artifact written to `data/`.
 *
 * One thing the merge computes is deliberately **not** stored: which 简体 form
 * pairs with which 繁體 one. Both scripts are keys and both find the same
 * reading, so conversion never needs the pairing — only `toSimplified` and
 * `toTraditional` do, and SCRIPTS-AND-LOCALES.md keeps those well away from the
 * conversion path. Measured on the full tier, storing it costs 1,493 KB brotli
 * of what would be a 2,455 KB download: two thirds of the entries file, for a
 * feature this package does not yet offer. {@link DictionaryEntry.hant} is
 * still populated and asserted, so a later phase can emit it as its own file
 * without the conversion path paying for it.
 */
export function buildArtifact(
  entries: readonly DictionaryEntry[],
): DictionaryArtifact {
  const claimed = claimKeys(entries);
  const defaults = characterDefaults(claimed);
  // Sorted here rather than looked up per key, so that each line is written
  // from the entry it belongs to rather than from a second search for it.
  const ordered = [...claimed].toSorted(([left], [right]) =>
    byCodeUnit(left, right),
  );
  const index = KeyIndex.from(ordered.map(([key]) => key).join(LINE));

  const lines: string[] = [];
  const frequencies: number[] = [];
  for (const [key, entry] of ordered) {
    const reading = encodeReading(entry.readings.cn);

    lines.push(
      trimColumns([
        isDerivable(key, reading, defaults) ? "" : reading,
        entry.readings.tw === undefined ? "" : encodeReading(entry.readings.tw),
        entry.partOfSpeech,
        entry.isProperNoun
          ? PROPER_NOUN_FLAG +
            (entry.nameBoundaries ?? []).join(BOUNDARY_SEPARATOR)
          : "",
        (entry.alternates ?? [])
          .map((alternate) => encodeReading(alternate))
          .join(ALTERNATE),
      ]),
    );
    frequencies.push(entry.frequency);
  }

  return {
    keys: index.serialise(),
    entries: lines.join(LINE),
    frequencies: FrequencyTable.build(frequencies).serialise(),
  };
}
