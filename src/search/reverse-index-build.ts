/**
 * Deriving the reverse index a slice at a time.
 *
 * The full tier costs about half a second to derive, so the build is handed
 * back as a stepper a caller can drive from an idle callback rather than a
 * function that blocks. What each pass does is `reverse-index-state.ts`; what
 * is here is how much of it one step is worth.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { FREQUENCY_BUCKETS } from "../dictionary/frequency-table.js";
import { ReverseIndex } from "./reverse-index.js";
import { LINE, readingKey, STEP } from "./reverse-index-format.js";
import { progressOf, type ReverseIndexBuild } from "./reverse-index-passes.js";
import {
  countPass,
  fillPass,
  orderPass,
  rankPass,
  startState,
} from "./reverse-index-state.js";

export { readingKey, type ReverseIndexData } from "./reverse-index-format.js";

/**
 * The streaming build, which never holds every reading at once.
 *
 * Three passes over the dictionary — count the groups, fill them, rank them —
 * with a fourth between the first two that lays the groups out. The only things
 * about them that need the dictionary are the two functions they are driven by:
 * what a position is read as, and how common the word there is.
 */
export function startBuild(dictionary: Dictionary): ReverseIndexBuild {
  const readings = dictionary.readingsInOrder();
  const state = startState();

  /** The reading key at a position, or the empty string where there is none. */
  const keyAt = (position: number): string =>
    readingKey(readings.readingAt(position));

  /** Where a position sorts, commonest first: the bucket, counted downwards. */
  const rankOf = (position: number): number =>
    FREQUENCY_BUCKETS - 1 - dictionary.frequencyAt(position);

  return {
    get progress(): number {
      return progressOf(
        state.pass,
        state.at,
        readings.size,
        state.layout.keys.length,
      );
    },
    step(positions: number = STEP): ReverseIndex | undefined {
      switch (state.pass) {
        case "counting": {
          countPass(state, readings.size, keyAt, positions);
          return undefined;
        }
        case "ordering": {
          orderPass(state);
          return undefined;
        }
        case "filling": {
          fillPass(state, readings.size, keyAt, positions);
          return undefined;
        }
        case "ranking": {
          return rankPass(state, positions, rankOf)
            ? ReverseIndex.from(dictionary, {
                keys: state.layout.keys.join(LINE),
                postings: state.layout.postings,
                starts: state.layout.starts,
              })
            : undefined;
        }
        /* c8 ignore next 3 -- a finished build is not stepped again */
        case "done": {
          return undefined;
        }
      }
    },
  };
}

/**
 * Derive the whole index in one go, which is {@link ReverseIndex.of}.
 *
 * Stepped without a bound rather than built by a separate path, so there is one
 * implementation of the build and the two entry points differ only in how much
 * of it they ask for at a time.
 */
export function buildAll(dictionary: Dictionary): ReverseIndex {
  const build = startBuild(dictionary);
  let index = build.step(Number.POSITIVE_INFINITY);
  while (index === undefined) {
    index = build.step(Number.POSITIVE_INFINITY);
  }
  return index;
}
