import { toCharacters } from "../script/characters.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import { isSameReading } from "./entry.js";
import { FrequencyTable } from "./frequency-table.js";
import { KeyIndex } from "./key-index.js";

/**
 * Separator between a line's columns.
 */
const COLUMN = "\t";

/**
 * Separator between lines, matching the key index's own separator.
 */
const LINE = "\n";

/**
 * Separator between the alternate readings of a character.
 */
const ALTERNATE = ",";

/**
 * The flag marking a proper noun.
 */
const PROPER_NOUN_FLAG = "p";

/**
 * Where a proper name divides, written after the proper-noun flag.
 *
 * `p` alone is a proper noun whose parts CC-CEDICT does not divide; `p1` is one
 * that divides after the first character, `p2.4` after the second and fourth.
 * The positions are decimal and dot-separated rather than one digit each,
 * because the longest word carrying any is 19 characters.
 *
 * It rides in the flags column rather than taking a column of its own because
 * it is only ever present on a proper noun, and only 8,205 of 723,139 keys
 * carry one — a sixth column would cost a separator on every line to say
 * nothing on almost all of them. *
 * `security/detect-unsafe-regex` flags the nested quantifier, and there is no
 * ambiguity behind it: a literal `.` separates `\d+` from `(?:\.\d+)*`, so no
 * input can be split between them two ways. Timed on a string of digits and
 * dots that cannot match, it is linear — 8k to 128k characters doubles the time
 * for each doubling of the input, 39µs to 607µs.
 */
const NAME_BOUNDARIES = /^p(?<at>\d+(?:\.\d+)*)$/u;

const BOUNDARY_SEPARATOR = ".";

/**
 * The boundaries a flags column states, empty where it states none.
 */
function nameBoundariesIn(flags: string): readonly number[] {
  const at = NAME_BOUNDARIES.exec(flags)?.groups?.["at"];
  return at === undefined ? [] : at.split(BOUNDARY_SEPARATOR).map(Number);
}

/**
 * A compiled dictionary, in the form it is written to disk and read back.
 *
 * Three parallel pieces, all indexed by the same position: search `keys` for a
 * word, and the line at that position in `entries` describes it. Nothing is
 * parsed on load beyond scanning for separators — see BROWSER.md, where the
 * measurement behind that choice is recorded.
 */
export interface DictionaryArtifact {
  /** Sorted keys, newline-joined: the {@link KeyIndex} blob. */
  readonly keys: string;
  /** One line per key, in key order. */
  readonly entries: string;
  /** Quantised frequencies, packed two per byte. */
  readonly frequencies: Uint8Array;
}

/**
 * Write a reading in tone-numbered notation.
 *
 * Numbered rather than tone-marked because it is ASCII, so it survives any
 * encoding, and because the tone is then a character rather than a combining
 * mark that normalisation could move.
 */
export function encodeReading(syllables: readonly Syllable[]): string {
  return syllables
    .map((syllable) => writeSyllable(syllable, "numbers"))
    .join(" ");
}

/**
 * Read a reading back, or return undefined if any syllable is malformed.
 */
export function decodeReading(text: string): readonly Syllable[] | undefined {
  if (text === "") {
    return undefined;
  }
  const syllables = text.split(" ").map((token) => readSyllable(token));
  return syllables.includes(undefined)
    ? undefined
    : (syllables as readonly Syllable[]);
}

/**
 * Order two keys the way {@link KeyIndex} requires them: by UTF-16 code unit.
 */
function byCodeUnit(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * Every 繁體 spelling an entry claims a key for.
 */
export function traditionalForms(entry: DictionaryEntry): readonly string[] {
  return [entry.hant, ...(entry.hantVariants ?? [])];
}

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
function claimKeys(
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

/**
 * Read an artifact back into entries, for tests and for the loader.
 *
 * The reverse of {@link buildArtifact} but for the two things it does not
 * store: frequency comes back as a bucket rather than a count, since it is
 * quantised on the way out, and 简体/繁體 pairing is absent, so every entry
 * reports its key as both. Entries are returned in key order.
 */
export function readArtifact(
  artifact: DictionaryArtifact,
): readonly DictionaryEntry[] {
  const index = KeyIndex.from(artifact.keys);
  const lines = artifact.entries === "" ? [] : artifact.entries.split(LINE);
  const frequencies = FrequencyTable.from(artifact.frequencies, index.size);

  // Two passes: a derivable reading needs its characters' readings, which are
  // themselves entries in the same artifact.
  const defaults = new Map<string, string>();
  for (let at = 0; at < index.size; at++) {
    const key = index.keyAt(at);
    const reading = (lines[at] ?? "").split(COLUMN)[0] ?? "";
    if (toCharacters(key).length === 1 && reading !== "") {
      defaults.set(key, reading);
    }
  }

  const entries: DictionaryEntry[] = [];
  for (let at = 0; at < index.size; at++) {
    const key = index.keyAt(at);
    const [
      reading = "",
      taiwan = "",
      partOfSpeech = "",
      flags = "",
      alternates = "",
    ] = (lines[at] ?? "").split(COLUMN);
    const nameBoundaries = nameBoundariesIn(flags);

    const stored =
      reading === ""
        ? toCharacters(key)
            .map((character) => defaults.get(character) ?? "")
            .join(" ")
        : reading;
    const cn = decodeReading(stored);
    if (cn === undefined) {
      throw new Error(`artifact entry for ${key} has no readable reading`);
    }
    const tw = decodeReading(taiwan);

    // The artifact stores keys, not pairs, so a key read back is both scripts
    // as far as it knows. See buildArtifact for what that leaves out and why.
    entries.push({
      hans: key,
      hant: key,
      readings: { cn, ...(tw !== undefined && { tw }) },
      frequency: frequencies.bucketOf(at),
      partOfSpeech,
      isProperNoun: flags.includes(PROPER_NOUN_FLAG),
      ...(nameBoundaries.length > 0 && { nameBoundaries }),
      ...(alternates !== "" && {
        alternates: alternates
          .split(ALTERNATE)
          .map((text) => decodeReading(text))
          .filter((decoded) => decoded !== undefined),
      }),
    });
  }
  return entries;
}

/**
 * The reading every key in an artifact resolves to, in tone-numbered notation.
 *
 * Resolved rather than read off the line, since 87.8% of multi-character lines
 * store no reading at all and mean "the characters' defaults, in order" — and
 * those defaults are whatever *this* artifact holds. That is exactly what makes
 * the comparison between tiers worth doing: a tier missing a character does not
 * only lose that character, it changes every derived reading that stands on it.
 */
export function readingsByKey(
  artifact: DictionaryArtifact,
): ReadonlyMap<string, string> {
  const index = KeyIndex.from(artifact.keys);
  const readings = new Map<string, string>();
  for (const [at, entry] of readArtifact(artifact).entries()) {
    readings.set(index.keyAt(at), encodeReading(entry.readings.cn));
  }
  return readings;
}

/**
 * The first key an artifact does not read back the same, or undefined.
 *
 * Only the fields the artifact stores are compared: frequency is quantised on
 * the way out, and the 简体/繁體 labelling of a pair is not recoverable from a
 * key alone, so neither is checked here.
 *
 * Returns the offending key rather than a bare false so that a build failure
 * names the word to go and look at.
 */
export function findRoundTripFailure(
  entries: readonly DictionaryEntry[],
  artifact: DictionaryArtifact,
): string | undefined {
  const index = KeyIndex.from(artifact.keys);
  const read = readArtifact(artifact);
  const byKey = new Map<string, DictionaryEntry>();
  for (const [at, entry] of read.entries()) {
    byKey.set(index.keyAt(at), entry);
  }

  for (const [key, entry] of claimKeys(entries)) {
    const other = byKey.get(key);
    if (
      other === undefined ||
      !isSameReading(entry.readings.cn, other.readings.cn)
    ) {
      return key;
    }
  }
  return undefined;
}
