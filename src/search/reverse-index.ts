import type { Dictionary } from "../dictionary/dictionary.js";
import { FREQUENCY_BUCKETS } from "../dictionary/frequency-table.js";
import { KeyIndex } from "../dictionary/key-index.js";

/**
 * The separator between reading keys, matching what {@link KeyIndex} expects.
 */
const LINE = "\n";

const SPACE = 32;

const ZERO = 48;

const FIVE = 53;

const UMLAUT_U = "ü";

const PLAIN_U = "u";

/**
 * How many positions one {@link ReverseIndexBuild.step} covers by default.
 *
 * Sized so that a step is a frame rather than several: the full tier's build is
 * about 540 ms of work over 723,147 keys, so 20,000 keys is roughly 15 ms of it.
 * A caller with a frame budget of its own should pass its own number rather than
 * trust this one.
 */
const STEP = 20_000;

/**
 * Fold a stored reading into the key a typist's spelling reaches it by.
 *
 * `yin2 hang2` becomes `yinhang` and `lü4 se4` becomes `luse`. Three things go:
 * the spaces, because nobody types them; the tone digits, because a typist
 * mostly does not write tones and a toned query is answered by filtering a
 * toneless list rather than by a second index; and the umlaut, because `lu` and
 * `lv` both have to reach 绿 and the only spelling both of them fold to is `lu`.
 *
 * The 儿化 r **stays**, so 玩儿 is keyed `wanr` and not `wan`. It is a letter a
 * typist writes, and the query side reaches the key from both directions by
 * searching `wan` and `wanr` alike — see `candidates`.
 *
 * Nothing here parses a syllable, which is what keeps a pass over every key in
 * the dictionary affordable.
 */
export function readingKey(reading: string): string {
  let key = "";
  for (let at = 0; at < reading.length; at++) {
    /* c8 ignore next -- `at` is inside the string, so the fallback cannot fire */
    const code = reading.codePointAt(at) ?? 0;
    if (code === SPACE || (code >= ZERO && code <= FIVE)) {
      continue;
    }
    const character = reading.charAt(at);
    key += character === UMLAUT_U ? PLAIN_U : character;
  }
  return key;
}

/**
 * A reverse index in the form it can be handed between threads.
 *
 * Three pieces, the same shape the forward index has: the reading keys as one
 * sorted newline-joined blob, the dictionary positions grouped under them, and
 * where each group begins. The two arrays are transferable and the blob is a
 * string, so a worker can build this and post it back with no copy of the
 * postings — which is the point, since the full tier's build is over half a
 * second and does not belong on the main thread.
 */
export interface ReverseIndexData {
  /** Sorted reading keys, newline-joined: a {@link KeyIndex} blob. */
  readonly keys: string;
  /** Dictionary positions, grouped by reading key, likeliest first. */
  readonly postings: Uint32Array;
  /** Where each key's postings begin, with one past the end on the tail. */
  readonly starts: Uint32Array;
}

/**
 * A reverse index being built, a slice at a time.
 *
 * The full tier costs about 540 ms to derive, which is thirty-odd frames, so the
 * build is a state machine a caller can drive from `requestIdleCallback` rather
 * than a function that takes the thread. `core` is 4 ms and `standard` is 65 ms,
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
type Pass = "counting" | "ordering" | "filling" | "ranking" | "done";

/**
 * What share of the build each pass is worth, for {@link ReverseIndexBuild.progress}.
 */
const SHARE = { counting: 0.45, filling: 0.45, ranking: 0.1 };

/**
 * The empty posting list, shared rather than allocated per miss.
 */
const NONE = new Uint32Array(0);

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
function readAt(values: Uint32Array, at: number): number {
  return values[at] ?? 0;
}

/**
 * Which readings each word in the dictionary can be reached by.
 *
 * Every index in the package runs hanzi → reading; this is the other direction,
 * and it is **derived on load rather than downloaded**. The measurement is in
 * issue #71 and the summary is that shipping it would add 1,924 KB to the full
 * tier — an 81% increase — to save under 60% of a build the client can do from
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
   * About 4 ms on `core`, 65 ms on `standard` and 540 ms on `full`, measured on
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

/**
 * The streaming build, which never holds every reading at once.
 *
 * Three passes over the dictionary — count the groups, fill them, rank them —
 * with each key's reading recomputed in the fill pass rather than kept from the
 * count pass. That trade is the whole reason this is safe on a phone: keeping
 * all 723,147 readings costs 39 MB retained and peaks at 65 MB, where
 * recomputing them peaks at 25 MB for a 2 MB result.
 *
 * A closure rather than a class because the state is a cursor and four buffers
 * that only the passes below ever touch, and because two of them are dropped
 * part way through: what is live during counting is not what is live during
 * ranking.
 */
function startBuild(dictionary: Dictionary): ReverseIndexBuild {
  const readings = dictionary.readingsInOrder();
  let counts = new Map<string, number>();
  let pass: Pass = "counting";
  let at = 0;
  let keys: readonly string[] = [];
  let slots = new Map<string, number>();
  let starts = new Uint32Array(1);
  let cursors = new Uint32Array(0);
  let postings = NONE;
  let widest = 0;

  /** The reading key at a position, or the empty string where there is none. */
  const keyAt = (position: number): string =>
    readingKey(readings.readingAt(position));

  /** Where a position sorts, commonest first: the bucket, counted downwards. */
  const rankOf = (position: number): number =>
    FREQUENCY_BUCKETS - 1 - dictionary.frequencyAt(position);

  /** Count how many words each reading has, so the postings can be one array. */
  const count = (positions: number): void => {
    const end = Math.min(readings.size, at + positions);
    for (; at < end; at++) {
      const key = keyAt(at);
      if (key !== "") {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    if (at >= readings.size) {
      pass = "ordering";
    }
  };

  /**
   * Sort the reading keys and lay out where each group's postings go.
   *
   * One step of its own, because a sort cannot be resumed part way through.
   */
  const order = (): void => {
    // Sorted as pairs rather than by key and looked up again, and by code unit
    // rather than by locale, which is the order `KeyIndex` searches in.
    const ordered = [...counts].toSorted(([left], [right]) =>
      left < right ? -1 : Number(left > right),
    );
    keys = ordered.map(([key]) => key);
    starts = new Uint32Array(keys.length + 1);
    let running = 0;
    for (const [group, [key, held]] of ordered.entries()) {
      slots.set(key, group);
      starts[group] = running;
      running += held;
      widest = Math.max(widest, held);
    }
    starts[keys.length] = running;
    counts = new Map();

    cursors = starts.slice(0, keys.length);
    postings = new Uint32Array(running);
    at = 0;
    pass = "filling";
  };

  /** Place each position in its reading's group, recomputing the reading. */
  const fill = (positions: number): void => {
    const end = Math.min(readings.size, at + positions);
    for (; at < end; at++) {
      const key = keyAt(at);
      const group = key === "" ? undefined : slots.get(key);
      if (group === undefined) {
        continue;
      }
      const cursor = readAt(cursors, group);
      postings[cursor] = at;
      cursors[group] = cursor + 1;
    }
    if (at >= readings.size) {
      slots = new Map();
      cursors = new Uint32Array(0);
      at = 0;
      pass = "ranking";
    }
  };

  /**
   * Sort each group likeliest-first, which is a counting sort on the bucket.
   *
   * Buckets run 0 to 15, so there is nothing to compare: tally the group, turn
   * the tally into offsets, and deal the postings out. Stable, so two words in
   * the same bucket keep the dictionary's own order and the result does not
   * depend on how the fill pass happened to lay the postings down.
   */
  const rank = (groups: number): ReverseIndex | undefined => {
    const scratch = new Uint32Array(widest);
    const tally = new Uint32Array(FREQUENCY_BUCKETS);
    const end = Math.min(keys.length, at + groups);
    for (; at < end; at++) {
      const from = readAt(starts, at);
      const to = readAt(starts, at + 1);
      tally.fill(0);
      for (let cursor = from; cursor < to; cursor++) {
        const position = readAt(postings, cursor);
        scratch[cursor - from] = position;
        const bucket = rankOf(position);
        tally[bucket] = readAt(tally, bucket) + 1;
      }
      let running = from;
      for (let bucket = 0; bucket < FREQUENCY_BUCKETS; bucket++) {
        const held = readAt(tally, bucket);
        tally[bucket] = running;
        running += held;
      }
      for (let cursor = 0; cursor < to - from; cursor++) {
        const position = readAt(scratch, cursor);
        const bucket = rankOf(position);
        postings[readAt(tally, bucket)] = position;
        tally[bucket] = readAt(tally, bucket) + 1;
      }
    }
    if (at < keys.length) {
      return undefined;
    }

    pass = "done";
    return ReverseIndex.from(dictionary, {
      keys: keys.join(LINE),
      postings,
      starts,
    });
  };

  return {
    get progress(): number {
      const size = Math.max(1, readings.size);
      switch (pass) {
        case "counting": {
          return (SHARE.counting * at) / size;
        }
        case "ordering": {
          return SHARE.counting;
        }
        case "filling": {
          return SHARE.counting + (SHARE.filling * at) / size;
        }
        case "ranking": {
          return (
            SHARE.counting +
            SHARE.filling +
            (SHARE.ranking * at) / Math.max(1, keys.length)
          );
        }
        case "done": {
          return 1;
        }
      }
    },
    step(positions: number = STEP): ReverseIndex | undefined {
      switch (pass) {
        case "counting": {
          count(positions);
          return undefined;
        }
        case "ordering": {
          order();
          return undefined;
        }
        case "filling": {
          fill(positions);
          return undefined;
        }
        case "ranking": {
          return rank(positions);
        }
        /* c8 ignore next 3 -- a finished build is not stepped again */
        case "done": {
          return undefined;
        }
      }
    },
  };
}
