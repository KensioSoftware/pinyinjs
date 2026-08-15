/**
 * The reverse index itself: reading key → the words read that way.
 *
 * How it is derived is `reverse-index-build.ts`, and the vocabulary the two
 * share sits below both in `reverse-index-passes.ts`.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { buildAll, startBuild } from "./reverse-index-build.js";
import { KeyIndex } from "../dictionary/key-index.js";
import type { ReverseIndexData } from "./reverse-index-format.js";
import {
  NONE,
  readAt,
  type ReverseIndexBuild,
} from "./reverse-index-passes.js";

export type { ReverseIndexBuild } from "./reverse-index-passes.js";

export { readingKey, type ReverseIndexData } from "./reverse-index-format.js";

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
    return buildAll(dictionary);
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
