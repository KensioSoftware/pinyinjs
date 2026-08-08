import { isSingleCharacter, toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import { type DictionaryEntry, isSameReading } from "./entry.js";
import { FrequencyTable } from "./frequency-table.js";

/**
 * Compounds whose constituent's 國語 reading must not be carried over.
 *
 * The composition below only fires where the compound reads its constituent
 * exactly as that constituent's own entry does, which rules out most of the ways
 * it could be wrong. What it cannot rule out is a homograph: two words spelled
 * and read identically in 普通话, of which only one shifts in 國語. 相亲 is
 * `xiāngqīn` either way when it means "mutually close" and `xiàngqīn` in Taiwan
 * when it means a matchmaking meeting, and nothing in the data distinguishes the
 * two senses.
 *
 * **Keep this small**, for the same reason
 * {@link import("./overrides.js").READING_OVERRIDES} is kept small. Three
 * exclusions against the 100 compounds the composition settles is the measured
 * ratio; a list growing much past that would mean the alignment check has
 * stopped carrying its weight and the rule itself needs revisiting.
 */
export const LOCALE_COMPOSITION_EXCLUSIONS: readonly {
  readonly word: string;
  readonly reason: string;
}[] = [
  {
    word: "相亲相爱",
    reason:
      "相亲 here is 相 + 亲 in the reciprocal sense, `xiāngqīn`, not the matchmaking word that reads `xiàngqīn` in 國語.",
  },
  {
    word: "腹背相亲",
    reason: "The same reciprocal 相亲, so the same reading in both locales.",
  },
  {
    word: "洋为中用",
    reason:
      "中 is 中国 and 用 is its own verb: 洋为中用 is not built on the word 中用, which is what reads `zhòngyòng` in 國語.",
  },
];

/**
 * The exclusions as a set, for the composition to consult.
 */
const EXCLUDED: ReadonlySet<string> = new Set(
  LOCALE_COMPOSITION_EXCLUSIONS.map((exclusion) => exclusion.word),
);

/**
 * What each word in a segmentation costs on top of its frequency.
 *
 * The same charge, and for the same reason, as `READING_CHARGE` in
 * `src/decode/lattice.ts`: it orders candidate segmentations by fewest words
 * first and frequency second. That ordering is what decides 皮夹克 is 皮 + 夹克
 * rather than 皮夹 + 克, which is the difference between leaving `pí jiákè`
 * alone and mistaking it for the wallet 皮夹 that reads `pí jiá` in 國語.
 *
 * Duplicated rather than imported because the decoder sits above the dictionary
 * and must not be depended on from inside it. The two are kept in step by
 * `src/dictionary/locale.test.ts`, which asserts the segmentations this value
 * produces rather than the value itself.
 */
const WORD_CHARGE = 16;

/**
 * One word of a segmentation, and where in the compound it falls.
 */
interface Segment {
  readonly entry: DictionaryEntry;
  readonly text: string;
  /** First character covered. */
  readonly from: number;
  /** One past the last character covered. */
  readonly to: number;
}

/**
 * Every key an entry answers to, under either script.
 */
function keysOf(entry: DictionaryEntry): readonly string[] {
  return [entry.hans, entry.hant, ...(entry.hantVariants ?? [])];
}

/**
 * A compound's constituent words, and the readings they carry.
 *
 * Indexed by every key an entry claims, so that a 繁體 headword segments into
 * 繁體 constituents. Headwords are set first and never displaced, which is the
 * same precedence the artifact and the build assertions use: 发 and 髮 both claim
 * 发, and the entry the key names has to win.
 */
class ConstituentIndex {
  readonly #byKey: ReadonlyMap<string, DictionaryEntry>;
  readonly #cost: ReadonlyMap<string, number>;

  /**
   * Index entries by key, quantising their frequencies the way the decoder will.
   */
  constructor(entries: readonly DictionaryEntry[]) {
    const byKey = new Map<string, DictionaryEntry>();
    for (const entry of entries) {
      byKey.set(entry.hans, entry);
    }
    for (const entry of entries) {
      for (const form of keysOf(entry)) {
        if (!byKey.has(form)) {
          byKey.set(form, entry);
        }
      }
    }

    // Costs come from the same quantised table the artifact ships, so that a
    // segmentation decided here is the one the decoder would have reached.
    const table = FrequencyTable.build(entries.map((entry) => entry.frequency));
    const byEntry = new Map<DictionaryEntry, number>();
    for (const [at, entry] of entries.entries()) {
      byEntry.set(entry, table.costOf(at));
    }
    const cost = new Map<string, number>();
    for (const [key, entry] of byKey) {
      /* c8 ignore next -- every key was indexed from one of these entries */
      cost.set(key, (byEntry.get(entry) ?? 0) + WORD_CHARGE);
    }

    this.#byKey = byKey;
    this.#cost = cost;
  }

  /**
   * Relax every word starting at one position, improving the costs it reaches.
   *
   * One step of the shortest-path scan, lifted out of its enclosing loop.
   */
  #relaxFrom(
    word: string,
    characters: readonly string[],
    from: number,
    best: number[],
    previous: (Segment | undefined)[],
  ): void {
    /* c8 ignore next -- the caller only relaxes from a position in range */
    const reached = best[from] ?? Infinity;
    let candidate = "";
    for (let to = from; to < characters.length; to++) {
      /* c8 ignore next -- the loop condition keeps the index in range */
      candidate += characters[to] ?? "";
      // The whole word is not a segmentation of itself.
      const entry = candidate === word ? undefined : this.#byKey.get(candidate);
      const total = reached + this.costOf(candidate);
      /* c8 ignore next -- `to + 1` is at most `length`, which `best` holds */
      if (entry !== undefined && total < (best[to + 1] ?? Infinity)) {
        best[to + 1] = total;
        previous[to + 1] = { entry, text: candidate, from, to: to + 1 };
      }
    }
  }

  /**
   * What a key costs a segmentation that uses it.
   */
  costOf(key: string): number {
    /* c8 ignore next -- only asked about keys the index just returned */
    return this.#cost.get(key) ?? WORD_CHARGE;
  }

  /**
   * The likeliest way to cut a word into *other* dictionary words.
   *
   * The whole word is excluded from its own segmentation, which is the point:
   * 垃圾分类 is a dictionary word, so a decoder handed the text would stop there
   * and never ask what it is made of. This asks anyway.
   *
   * Returns undefined when no path of known words covers the word, which is
   * common — most compounds contain a character no shorter word claims.
   */
  segment(word: string): readonly Segment[] | undefined {
    const characters = toCharacters(word);
    const length = characters.length;
    const best = Array.from({ length: length + 1 }, () => Infinity);
    const previous = Array.from<Segment | undefined>({ length: length + 1 });
    best[0] = 0;

    for (let from = 0; from < length; from++) {
      /* c8 ignore next -- the loop condition keeps the index in range */
      if ((best[from] ?? Infinity) !== Infinity) {
        this.#relaxFrom(word, characters, from, best, previous);
      }
    }

    /* c8 ignore next -- `best` is built one longer than the word */
    if ((best[length] ?? Infinity) === Infinity) {
      return undefined;
    }

    const path: Segment[] = [];
    let at = length;
    while (at > 0) {
      const step = previous[at];
      /* c8 ignore next 3 -- a finite cost at `at` means a step reached it */
      if (step === undefined) {
        return undefined;
      }
      path.unshift(step);
      at = step.from;
    }
    return path;
  }
}

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
 * Whether a compound can be asked what it is made of at all.
 *
 * A reading of one syllable per character is what lets a character span be cut
 * out of the compound's reading and replaced. 儿化 folds two characters into one
 * syllable and punctuation reads as none, so neither lines up and both are left
 * alone.
 */
function isComposable(entry: DictionaryEntry): boolean {
  const characters = toCharacters(entry.hans);
  return (
    characters.length > 2 &&
    entry.readings.cn.length === characters.length &&
    !EXCLUDED.has(entry.hans) &&
    !EXCLUDED.has(entry.hant)
  );
}

/**
 * Whether any delta-carrying word appears inside this one.
 *
 * A cheap filter ahead of the segmentation: only a few hundred words carry a
 * delta, against 461,555 entries, and enumerating one word's substrings costs
 * far less than segmenting it.
 */
function hasMarkedConstituent(
  word: string,
  marked: ReadonlySet<string>,
): boolean {
  const characters = toCharacters(word);
  return characters.some((_, from) => {
    let candidate = "";
    return characters.slice(from).some((character) => {
      candidate += character;
      return candidate !== word && marked.has(candidate);
    });
  });
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
