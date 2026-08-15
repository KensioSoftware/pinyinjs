/**
 * The passes a reverse index build runs, and how far along it is.
 *
 * A leaf both the build and the index import, rather than either importing the
 * other: what the stepper is, what it is doing and how far along it is, plus
 * the empty posting list and the checked read that both sides use.
 */

import type { ReverseIndex } from "./reverse-index.js";

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
 * What share of the build each pass is worth, for
 * {@link import("./reverse-index.js").ReverseIndexBuild.progress}.
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
 * How much of the build is done, from 0 to 1.
 *
 * The counting and filling passes are measured in dictionary positions and the
 * ranking pass in reading groups, so the two counts are both taken and each
 * pass reports against the one it is walking.
 */
export function progressOf(
  pass: Pass,
  at: number,
  positions: number,
  groups: number,
): number {
  const size = Math.max(1, positions);
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
        (SHARE.ranking * at) / Math.max(1, groups)
      );
    }
    case "done": {
      return 1;
    }
  }
}
