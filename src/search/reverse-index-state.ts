/**
 * The build as a state machine: what it holds, and what each pass does to it.
 *
 * Held as one record rather than as a closure's variables so that the four
 * transitions can be written as functions and read in order. Two of the fields
 * are dropped part way through — what is live during counting is not what is
 * live during ranking — which is the reason the build streams at all: keeping
 * all 723,147 readings costs 39 MB retained and peaks at 65 MB, where
 * recomputing them in the fill pass peaks at 25 MB for a 2 MB result.
 */
import { FREQUENCY_BUCKETS } from "../dictionary/frequency-table.js";
import {
  type GroupLayout,
  layOutGroups,
  rankGroup,
} from "./reverse-index-groups.js";
import { NONE, type Pass, readAt } from "./reverse-index-passes.js";

/**
 * Everything the passes share.
 */
export interface BuildState {
  pass: Pass;
  /** A dictionary position while counting and filling, a group while ranking. */
  at: number;
  /** How many words each reading has; dropped once the groups are laid out. */
  counts: Map<string, number>;
  /** Where the postings go, which the ordering pass settles. */
  layout: GroupLayout;
}

/** A layout with nothing in it, before the ordering pass has run. */
const NO_LAYOUT: GroupLayout = {
  keys: [],
  starts: new Uint32Array(1),
  slots: new Map(),
  widest: 0,
  cursors: new Uint32Array(0),
  postings: NONE,
};

/**
 * A build that has done nothing yet.
 */
export function startState(): BuildState {
  return { pass: "counting", at: 0, counts: new Map(), layout: NO_LAYOUT };
}

/**
 * Count how many words each reading has, so the postings can be one array.
 */
export function countPass(
  state: BuildState,
  size: number,
  keyAt: (position: number) => string,
  positions: number,
): void {
  const end = Math.min(size, state.at + positions);
  for (; state.at < end; state.at++) {
    const key = keyAt(state.at);
    if (key !== "") {
      state.counts.set(key, (state.counts.get(key) ?? 0) + 1);
    }
  }
  if (state.at >= size) {
    state.pass = "ordering";
  }
}

/**
 * Lay the groups out, which is one step of its own because a sort cannot be
 * resumed part way through.
 */
export function orderPass(state: BuildState): void {
  state.layout = layOutGroups(state.counts);
  state.counts = new Map();
  state.at = 0;
  state.pass = "filling";
}

/**
 * Place each position in its reading's group, recomputing the reading.
 */
export function fillPass(
  state: BuildState,
  size: number,
  keyAt: (position: number) => string,
  positions: number,
): void {
  const end = Math.min(size, state.at + positions);
  for (; state.at < end; state.at++) {
    const key = keyAt(state.at);
    const group = key === "" ? undefined : state.layout.slots.get(key);
    if (group === undefined) {
      continue;
    }
    const cursor = readAt(state.layout.cursors, group);
    state.layout.postings[cursor] = state.at;
    state.layout.cursors[group] = cursor + 1;
  }
  if (state.at >= size) {
    // The slots and the cursors are the fill pass's own, and the ranking pass
    // is about to walk arrays as big as the dictionary. Dropped rather than
    // carried, which on the full tier is 42 MB the build never holds.
    state.layout = { ...state.layout, slots: new Map(), cursors: NONE };
    state.at = 0;
    state.pass = "ranking";
  }
}

/**
 * Sort some groups likeliest-first, and say whether that was the last of them.
 */
export function rankPass(
  state: BuildState,
  groups: number,
  rankOf: (position: number) => number,
): boolean {
  const { keys, starts, postings, widest } = state.layout;
  const scratch = new Uint32Array(widest);
  const tally = new Uint32Array(FREQUENCY_BUCKETS);
  const end = Math.min(keys.length, state.at + groups);
  for (; state.at < end; state.at++) {
    rankGroup(
      postings,
      readAt(starts, state.at),
      readAt(starts, state.at + 1),
      scratch,
      tally,
      rankOf,
    );
  }
  if (state.at < keys.length) {
    return false;
  }
  state.pass = "done";
  return true;
}
