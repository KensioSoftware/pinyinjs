/**
 * Giving a compound the 國語 reading its constituents already carry.
 *
 * Which compounds may be asked at all is `locale-candidates.ts`; what is here
 * is what a compound inherits once it has been asked, and the rounds of the
 * pass that let an inheritance itself be inherited.
 */
import { isSingleCharacter } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { type DictionaryEntry, isSameReading } from "./entry.js";
import { hasMarkedConstituent, isComposable } from "./locale-candidates.js";
import { ConstituentIndex, keysOf, type Segment } from "./locale-segments.js";

export { LOCALE_COMPOSITION_EXCLUSIONS } from "./locale-candidates.js";
/**
 * The 國語 reading a compound inherits from its constituents, or undefined.
 *
 * Only a **multi-character** constituent may contribute. A character's delta
 * reaches every compound that character appears in, and surviving the merge's
 * sense test — see `isOwnSense` — does not make one locale-wide. 期 carries
 * `qí`, which 國語 really does read everywhere, but 會 carries `huǐ`, and
 * propagating it would rewrite 三合会 as `sānhéhuǐ`. Measured on the full
 * dictionary, allowing characters to contribute composes 3,743 entries against
 * the 101 that multi-character words compose.
 */
function composedReading(
  entry: DictionaryEntry,
  path: readonly Segment[],
  settled: ReadonlyMap<string, readonly Syllable[]>,
): readonly Syllable[] | undefined {
  const reading = entry.readings.cn;
  const composed: Syllable[] = [];
  let isContributed = false;

  for (const part of path) {
    const span = reading.slice(part.from, part.to);
    // A constituent an earlier round composed counts as carrying a delta, which
    // is what lets 中看不中用 inherit through 不中用.
    const taiwan = settled.get(part.entry.hans) ?? part.entry.readings.tw;
    if (taiwan === undefined || isSingleCharacter(part.text)) {
      composed.push(...span);
      continue;
    }
    // The compound has to read this constituent the way the constituent's own
    // entry reads it. Where it does not, the compound is using another sense —
    // 浑身解数 is `xiè shù` and 解数 is a word, but a compound reading `jiě shù`
    // there would be a different word wearing the same characters, and its
    // 國語 reading says nothing about this one.
    if (!isSameReading(part.entry.readings.cn, span)) {
      return undefined;
    }
    composed.push(...taiwan);
    isContributed = true;
  }

  return isContributed ? composed : undefined;
}

/**
 * What the composition pass changed.
 */
export interface LocaleComposition {
  readonly entries: readonly DictionaryEntry[];
  /** Compounds given a zh-TW delta they had no source for. */
  readonly composed: number;
}

/**
 * How many times the pass may feed its own output back in.
 *
 * 中看不中用 needs two rounds: 不中用 is itself a compound with no delta of its
 * own, so only once it has been composed can the phrase containing it inherit
 * one. Nothing measured needs a third, and the bound is what stops a cycle in
 * the data from turning into a loop here.
 */
const ROUNDS = 4;

/**
 * Give a compound the 國語 reading its constituents already carry.
 *
 * The gap this closes: `zh-TW` is a delta over `zh-CN`, and a source marks that
 * delta on whichever headword it happened to list. CC-CEDICT marks 垃圾 and
 * 垃圾桶 but not 垃圾分类, and because the decoder prefers the longest word it
 * finds, 垃圾分类 is decoded whole and 垃圾's delta is never consulted — so a
 * locale switch that visibly works on 垃圾 appears to do nothing on 垃圾分类.
 * Patching the entries a source missed would be endless; the compounds are
 * open-class and the marked words are not.
 *
 * Three things keep it from overreaching, and all three are load-bearing:
 *
 * 1. **Segmentation, not substring.** 运行状况 contains 行状, which carries a
 *    delta, but cuts as 运行 + 状况 and never as 运 + 行状 + 况.
 * 2. **The constituent must be read here as its own entry reads it**, or the
 *    compound means something else by those characters.
 * 3. **Only whole words contribute**, never single characters — see
 *    {@link composedReading} for what allowing them costs.
 *
 * What survives all three is a homograph the data cannot see, which is what
 * {@link LOCALE_COMPOSITION_EXCLUSIONS} is for.
 */
export function composeLocaleDeltas(
  entries: readonly DictionaryEntry[],
): LocaleComposition {
  const index = new ConstituentIndex(entries);

  // Only a compound containing a delta-carrying word can gain one, and there
  // are a few hundred such words against 461,555 entries. Enumerating each
  // entry's substrings against that set costs far less than segmenting every
  // entry would.
  const marked = new Set<string>();
  for (const entry of entries) {
    if (entry.readings.tw !== undefined && !isSingleCharacter(entry.hans)) {
      for (const key of keysOf(entry)) {
        marked.add(key);
      }
    }
  }

  // Candidates are fixed after the first sweep: composing a delta never makes a
  // new compound eligible, only changes what an eligible one inherits.
  const candidates = entries.filter(
    (entry) =>
      entry.readings.tw === undefined &&
      isComposable(entry) &&
      hasMarkedConstituent(entry.hans, marked),
  );

  const settled = new Map<string, readonly Syllable[]>();

  /**
   * Settle one compound, reporting whether that changed what it reads.
   */
  const didCompose = (entry: DictionaryEntry): boolean => {
    const path = index.segment(entry.hans);
    const reading =
      path === undefined ? undefined : composedReading(entry, path, settled);
    // A composition that comes back identical to the 普通话 reading is not a
    // delta at all, and one identical to the last round's is not news.
    if (reading === undefined || isSameReading(reading, entry.readings.cn)) {
      return false;
    }
    const held = settled.get(entry.hans);
    if (held !== undefined && isSameReading(held, reading)) {
      return false;
    }
    settled.set(entry.hans, reading);
    return true;
  };

  for (let round = 0; round < ROUNDS; round++) {
    const changed = candidates.filter((entry) => didCompose(entry)).length;
    if (changed === 0) {
      break;
    }
  }

  const composed = entries.map((entry) => {
    const reading = settled.get(entry.hans);
    return reading === undefined
      ? entry
      : { ...entry, readings: { ...entry.readings, tw: reading } };
  });

  return { entries: composed, composed: settled.size };
}
