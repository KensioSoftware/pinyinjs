/**
 * Deriving the reverse index a slice at a time.
 *
 * The full tier costs about half a second to derive, so the build is handed
 * back as a stepper a caller can drive from an idle callback rather than a
 * function that blocks.
 */
import {
  NONE,
  readAt,
  type Pass,
  ReverseIndex,
  type ReverseIndexBuild,
  SHARE,
} from "./reverse-index.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { FREQUENCY_BUCKETS } from "../dictionary/frequency-table.js";
import { LINE, readingKey, STEP } from "./reverse-index-format.js";

export { readingKey, type ReverseIndexData } from "./reverse-index-format.js";

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
export function startBuild(dictionary: Dictionary): ReverseIndexBuild {
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
