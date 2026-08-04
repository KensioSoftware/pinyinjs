/**
 * What a single search of a {@link KeyIndex} discovered.
 */
export interface KeyLookup {
  /** Whether the needle is itself a key. */
  readonly isKey: boolean;
  /** Whether any key begins with the needle, which an exact match satisfies. */
  readonly isPrefix: boolean;
  /**
   * Position of the first key at or after the needle.
   *
   * When `isKey` is true this is the needle's own position, which is what
   * indexes into the parallel arrays holding its readings and metadata.
   */
  readonly index: number;
}

/**
 * The separator between keys in the serialised form.
 */
const SEPARATOR = "\n";

const NOT_FOUND: KeyLookup = { isKey: false, isPrefix: false, index: 0 };

/**
 * Order two keys by UTF-16 code unit, which is the order the search relies on.
 *
 * Spelled out rather than left to the default sort so that it cannot drift into
 * a locale-aware comparison: `localeCompare` and `Intl.Collator` order Chinese
 * by pronunciation or stroke count, either of which would silently break every
 * lookup.
 */
function byCodeUnit(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * A sorted set of dictionary keys held as one string, searched by binary search.
 *
 * Measured against the alternatives on the full 412k-word list, this holds the
 * complete dictionary in 2.9 MB of heap where a `Map` with a prefix `Set`
 * beside it needs 22.6 MB. The reason is that building the lattice asks "does
 * any word start here?" rather than "is this a word?", and binary search answers
 * both from one search — a `Map` needs a second structure for the first
 * question.
 *
 * The serialised form is the in-memory form: nothing is parsed on load beyond
 * scanning for the separators.
 */
export class KeyIndex {
  /**
   * Scan a serialised key blob: keys separated by newlines, sorted ascending.
   *
   * **The blob must already be sorted** by {@link byCodeUnit}. Sortedness is
   * asserted where the blob is built rather than here, so that the cost is paid
   * once at build time rather than on every page load.
   */
  static from(keys: string): KeyIndex {
    if (keys === "") {
      return new this("", new Uint32Array([0]));
    }

    const starts: number[] = [0];
    let separator = keys.indexOf(SEPARATOR);
    while (separator !== -1) {
      starts.push(separator + 1);
      separator = keys.indexOf(SEPARATOR, separator + 1);
    }
    // One past the end, so that every key ends at the next start minus one.
    starts.push(keys.length + 1);

    return new this(keys, Uint32Array.from(starts));
  }

  /**
   * Build an index from keys in any order.
   *
   * Duplicates are kept; the caller should remove them if that matters.
   */
  static fromKeys(keys: readonly string[]): KeyIndex {
    return this.from([...keys].toSorted(byCodeUnit).join(SEPARATOR));
  }

  readonly #keys: string;
  readonly #offsets: Uint32Array;

  /**
   * Wrap an already-scanned blob. Use {@link KeyIndex.from} instead.
   */
  private constructor(keys: string, offsets: Uint32Array) {
    this.#keys = keys;
    this.#offsets = offsets;
  }

  /**
   * How many keys the index holds.
   */
  get size(): number {
    return this.#offsets.length - 1;
  }

  /**
   * The key at a position, or the empty string when the position is out of
   * range.
   */
  keyAt(index: number): string {
    const start = this.#offsets[index];
    const nextStart = this.#offsets[index + 1];
    if (start === undefined || nextStart === undefined) {
      return "";
    }
    return this.#keys.slice(start, nextStart - 1);
  }

  /**
   * Find a needle, reporting both whether it is a key and whether any key
   * begins with it.
   *
   * Both answers come from one search: the first key at or after the needle is
   * the only candidate that can begin with it, since every key that does is
   * itself greater than or equal to the needle.
   */
  lookup(needle: string): KeyLookup {
    if (needle === "" || this.size === 0) {
      return NOT_FOUND;
    }

    let low = 0;
    let high = this.size - 1;
    let bound = this.size;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (this.keyAt(middle) >= needle) {
        bound = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }

    if (bound >= this.size) {
      return NOT_FOUND;
    }

    /* c8 ignore next -- the fallback is unreachable; bound is always in range */
    const start = this.#offsets[bound] ?? 0;
    // Matched against the blob directly rather than a sliced key: a needle
    // longer than the key runs into the separator and fails, and needles never
    // contain one.
    const isPrefix = this.#keys.startsWith(needle, start);
    const isKey = isPrefix && this.keyAt(bound).length === needle.length;
    return { isKey, isPrefix, index: bound };
  }

  /**
   * Whether the needle is one of the keys.
   */
  has(needle: string): boolean {
    return this.lookup(needle).isKey;
  }

  /**
   * Whether any key begins with the needle. An exact match counts.
   */
  hasPrefix(needle: string): boolean {
    return this.lookup(needle).isPrefix;
  }

  /**
   * The serialised form, ready to be written out or hashed.
   */
  serialise(): string {
    return this.#keys;
  }
}
