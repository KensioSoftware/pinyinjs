/**
 * How the reverse index is laid out on disk.
 *
 * The key a reading is stored under and the packed arrays behind it.
 * `reverse-index.ts` is the index built on top of both.
 */

/**
 * The separator between reading keys, matching what {@link KeyIndex} expects.
 */
export const LINE = "\n";

export const SPACE = 32;

export const ZERO = 48;

export const FIVE = 53;

export const UMLAUT_U = "ü";

export const PLAIN_U = "u";

/**
 * How many positions one {@link ReverseIndexBuild.step} covers by default.
 *
 * Sized so that a step is a frame rather than several: the full tier's build is
 * about 510 ms of work over 723,147 keys, so 20,000 keys is roughly 14 ms of it.
 * A caller with a frame budget of its own should pass its own number rather than
 * trust this one.
 */
export const STEP = 20_000;

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
