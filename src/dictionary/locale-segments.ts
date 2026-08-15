/**
 * Cutting a compound into the constituents a 國語 delta can be composed from.
 *
 * The segmentation the composition runs on: which pieces a word divides into,
 * and what each of them costs, so that the division a reader would make is
 * the one that wins.
 */
import { toCharacters } from "../script/characters.js";
import type { DictionaryEntry } from "./entry.js";
import { FrequencyTable } from "./frequency-table.js";

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
export interface Segment {
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
export function keysOf(entry: DictionaryEntry): readonly string[] {
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
export class ConstituentIndex {
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
