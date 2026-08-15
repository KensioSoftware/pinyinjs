/**
 * Where each reading's postings go, and what order they go in.
 *
 * The two parts of the build that are about a group rather than about a pass:
 * laying the groups out once the counts are in, and sorting one of them
 * likeliest-first. Both are ordinary functions over arrays, and neither knows
 * anything about the state machine that calls them.
 */
import { readAt } from "./reverse-index-passes.js";

/**
 * The layout the fill and rank passes are written against.
 */
export interface GroupLayout {
  /** The reading keys, sorted by code unit, which is `KeyIndex` order. */
  readonly keys: readonly string[];
  /** Where each group begins, with one past the end on the tail. */
  readonly starts: Uint32Array;
  /** Which group a reading key is, for the fill pass. */
  readonly slots: Map<string, number>;
  /** The largest group, which is how big the ranking scratch must be. */
  readonly widest: number;
  /** Where the fill pass has got to within each group. */
  readonly cursors: Uint32Array;
  /** The postings themselves, empty until the fill pass runs. */
  readonly postings: Uint32Array;
}

/**
 * Sort the reading keys and lay out where each group's postings go.
 *
 * Sorted as pairs rather than by key and looked up again, and by code unit
 * rather than by locale, which is the order `KeyIndex` searches in.
 */
export function layOutGroups(counts: ReadonlyMap<string, number>): GroupLayout {
  const ordered = [...counts].toSorted(([left], [right]) =>
    left < right ? -1 : Number(left > right),
  );
  const keys = ordered.map(([key]) => key);
  const starts = new Uint32Array(keys.length + 1);
  const slots = new Map<string, number>();
  let running = 0;
  let widest = 0;
  for (const [group, [key, held]] of ordered.entries()) {
    slots.set(key, group);
    starts[group] = running;
    running += held;
    widest = Math.max(widest, held);
  }
  starts[keys.length] = running;
  return {
    keys,
    starts,
    slots,
    widest,
    cursors: starts.slice(0, keys.length),
    postings: new Uint32Array(running),
  };
}

/**
 * Sort one group likeliest-first, which is a counting sort on the bucket.
 *
 * Buckets run 0 to 15, so there is nothing to compare: tally the group, turn
 * the tally into offsets, and deal the postings out. Stable, so two words in
 * the same bucket keep the dictionary's own order and the result does not
 * depend on how the fill pass happened to lay the postings down.
 *
 * The scratch and tally arrays are the caller's, so that ranking 723,147
 * postings allocates twice rather than twice per group.
 */
export function rankGroup(
  postings: Uint32Array,
  from: number,
  to: number,
  scratch: Uint32Array,
  tally: Uint32Array,
  rankOf: (position: number) => number,
): void {
  tally.fill(0);
  for (let cursor = from; cursor < to; cursor++) {
    const position = readAt(postings, cursor);
    scratch[cursor - from] = position;
    const bucket = rankOf(position);
    tally[bucket] = readAt(tally, bucket) + 1;
  }
  let running = from;
  for (let bucket = 0; bucket < tally.length; bucket++) {
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
