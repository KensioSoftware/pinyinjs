import type { Dictionary } from "../dictionary/dictionary.js";
import { startBuild } from "./reverse-index-build.js";
import { KeyIndex } from "../dictionary/key-index.js";
import type { ReverseIndexData } from "./reverse-index-format.js";

export { readingKey, type ReverseIndexData } from "./reverse-index-format.js";

/**
 * A reverse index being built, a slice at a time.
 *
 * The full tier costs about 510 ms to derive, which is thirty-odd frames, so the
 * build is a state machine a caller can drive from `requestIdleCallback` rather
 * than a function that takes the thread. `core` is 4 ms and `standard` is 62 ms,
 * and both can simply be built with {@link ReverseIndex.of}.
 *
 * ```ts
 * const build = ReverseIndex.building(dictionary);
 * const tick = (): void => {
 *   const index = build.step();
 *   if (index === undefined) {
 *     requestIdleCallback(tick);
 *   }
 * };
 * requestIdleCallback(tick);
 * ```
 */
export interface ReverseIndexBuild {
  /**
   * How much of the build is done, from 0 to 1.
   */
  readonly progress: number;
  /**
   * Do some more of the work, returning the index once there is none left.
   *
   * `positions` bounds a step to that many dictionary positions, or that many
   * reading groups while the last pass is ranking them. It is a bound rather
   * than a promise: the pass that sorts the reading keys cannot be divided, and
   * is one step of its own.
   */
  readonly step: (positions?: number) => ReverseIndex | undefined;
}

/**
 * Which pass a build is on.
 */
export type Pass = "counting" | "ordering" | "filling" | "ranking" | "done";

/**
 * What share of the build each pass is worth, for {@link ReverseIndexBuild.progress}.
 */
export const SHARE = { counting: 0.45, filling: 0.45, ranking: 0.1 };

/**
 * The empty posting list, shared rather than allocated per miss.
 */
export const NONE = new Uint32Array(0);

/**
 * Read a `Uint32Array` at an index that is in range by construction.
 *
 * `noUncheckedIndexedAccess` types every read as possibly undefined, and every
 * one below is bounded by the layout of the array it indexes — a group start, a
 * cursor inside a group, a bucket between 0 and 15. Gathered here rather than
 * written as a fallback at each of them, since a fallback that cannot happen
 * reads as a case somebody considered.
 */
/* c8 ignore next 3 -- the fallback is unreachable; see above */
export function readAt(values: Uint32Array, at: number): number {
  return values[at] ?? 0;
}

/**
 * Which readings each word in the dictionary can be reached by.
 *
 * Every index in the package runs hanzi → reading; this is the other direction,
 * and it is **derived on load rather than downloaded**. The measurement is in
 * issue #71 and the summary is that shipping it would add 1,995 KB to the full
 * tier — an 84% increase — to save under 60% of a build the client can do from
 * bytes it already holds. Nothing new is fetched and no artifact exists.
 *
 * Held the way the forward index is held, and for the same reason: the reading
 * keys are one sorted blob searched by binary search, and the postings are a
 * `Uint32Array` of dictionary positions. That is 2.03 MB on the full tier where
 * a `Map<string, number[]>` of the same content is 47.83 MB.
 *
 * A posting is a position rather than a word, which is what makes ranking free:
 * a position indexes the frequency table directly, so the groups are sorted
 * likeliest-first during the build and a query pays nothing for its order.
 */
export class ReverseIndex {
  /**
   * Derive the whole index in one go.
   *
   * About 4 ms on `core`, 62 ms on `standard` and 510 ms on `full`, measured on
   * a machine roughly 2.5× a mid-range laptop. Use {@link ReverseIndex.building}
   * for anything that has a frame to hold on to.
   */
  static of(dictionary: Dictionary): ReverseIndex {
    const build = this.building(dictionary);
    let index = build.step(Number.POSITIVE_INFINITY);
    while (index === undefined) {
      index = build.step(Number.POSITIVE_INFINITY);
    }
    return index;
  }

  /**
   * Start a build that can be driven a slice at a time.
   */
  static building(dictionary: Dictionary): ReverseIndexBuild {
    return startBuild(dictionary);
  }

  /**
   * Wrap what a worker built and posted back.
   *
   * The dictionary is passed again rather than travelling with the data,
   * because the positions are only meaningful against the artifact they were
   * derived from — a dictionary of a different tier would resolve them to the
   * wrong words.
   */
  static from(dictionary: Dictionary, data: ReverseIndexData): ReverseIndex {
    return new ReverseIndex(
      dictionary,
      KeyIndex.from(data.keys),
      data.postings,
      data.starts,
    );
  }

  readonly #dictionary: Dictionary;
  readonly #keys: KeyIndex;
  readonly #postings: Uint32Array;
  readonly #starts: Uint32Array;

  /**
   * Wrap already-grouped postings. Use {@link ReverseIndex.of} or
   * {@link ReverseIndex.from}.
   */
  private constructor(
    dictionary: Dictionary,
    keys: KeyIndex,
    postings: Uint32Array,
    starts: Uint32Array,
  ) {
    this.#dictionary = dictionary;
    this.#keys = keys;
    this.#postings = postings;
    this.#starts = starts;
  }

  /**
   * The dictionary the index was derived from, and resolves its postings
   * against.
   */
  get dictionary(): Dictionary {
    return this.#dictionary;
  }

  /**
   * How many distinct readings the index holds, which is its key count.
   */
  get size(): number {
    return this.#keys.size;
  }

  /**
   * The dictionary positions read as a key, likeliest first.
   *
   * The key is the folded spelling {@link readingKey} produces — toneless, no
   * spaces, ü written u — not a query. `candidates` is what turns what somebody
   * types into one of these.
   *
   * A view onto the postings rather than a copy, so asking is free.
   */
  positionsFor(key: string): Uint32Array {
    const found = this.#keys.lookup(key);
    if (!found.isKey) {
      return NONE;
    }
    return this.#postings.subarray(
      readAt(this.#starts, found.index),
      readAt(this.#starts, found.index + 1),
    );
  }

  /**
   * The pieces, ready to be posted to another thread or held elsewhere.
   */
  serialise(): ReverseIndexData {
    return {
      keys: this.#keys.serialise(),
      postings: this.#postings,
      starts: this.#starts,
    };
  }
}
