/**
 * Number of distinct frequency levels stored.
 *
 * Four bits, so two entries fit in a byte. Measured against the alternatives on
 * the real word list, 16 log-spaced buckets compress to 9 KB where raw
 * single-byte counts take 23 KB, and the resolution lost is far finer than
 * anything the decoder can act on: it only ever compares one candidate word
 * against another.
 */
export const FREQUENCY_BUCKETS = 16;

const MAX_BUCKET = FREQUENCY_BUCKETS - 1;

/**
 * What every word in a decoded path costs before its frequency is counted.
 *
 * A bucket is `log f` on a scale where the most frequent word in the corpus
 * reaches {@link MAX_BUCKET}, so bucket *b* stands for `log f = b · L / 15`
 * where `L = log(1 + f_max)`. The decoder wants `−log P = log N − log f`, which
 * on that same scale is `15 · log N / L − b` — so the constant term is
 * `15 · (log N / L − 1)` rather than the 1 that was here before.
 *
 * The shipped corpus makes that concrete: 60,101,967 counts over 349,046
 * entries with a maximum of 883,634, giving `log N = 17.91`, `L = 13.69` and a
 * charge of 4.62. Only the *ratio* of the two logarithms matters, and it moves
 * slowly — doubling every count in the corpus shifts it by 0.05.
 *
 * The value is load-bearing. At the old charge of 1 the lattice decoder read
 * 还给 as 还 + 给 and 还是 as 还 + 是, because two common characters summed to
 * less than one uncommon word; at the derived charge both stay whole.
 */
const WORD_CHARGE = 4.62;

/**
 * Quantised word frequencies, packed two to a byte.
 *
 * Frequencies are stored on a log scale because that is how they are used: the
 * decoder wants `−log P`, and the gap between a word seen 10 times and one seen
 * 100 matters as much as the gap between 1,000 and 10,000.
 */
export class FrequencyTable {
  /**
   * Quantise and pack raw frequency counts.
   *
   * Counts are positional: entry *n* describes the key at position *n* of the
   * matching {@link import("./key-index.js").KeyIndex}. A count of zero means
   * the word was not attested, which still earns the lowest bucket rather than
   * being excluded — an unattested word in the dictionary is rare, not
   * impossible.
   */
  static build(frequencies: readonly number[]): FrequencyTable {
    // Looped rather than `Math.max(0, ...frequencies)`, which passes one
    // argument per entry and overflows the call stack somewhere above a hundred
    // thousand of them — well short of the 461,623 the full dictionary holds.
    let highest = 0;
    for (const frequency of frequencies) {
      if (frequency > highest) {
        highest = frequency;
      }
    }
    const scale = highest === 0 ? 0 : MAX_BUCKET / Math.log1p(highest);

    const packed = new Uint8Array(Math.ceil(frequencies.length / 2));
    for (const [index, frequency] of frequencies.entries()) {
      const attested = Math.max(0, frequency);
      const bucket = Math.min(
        MAX_BUCKET,
        Math.round(Math.log1p(attested) * scale),
      );
      const byteIndex = index >> 1;
      const existing = packed[byteIndex] ?? 0;
      packed[byteIndex] =
        index % 2 === 0
          ? (bucket << 4) | (existing & 0xf)
          : (existing & 0xf0) | bucket;
    }

    return new FrequencyTable(packed, frequencies.length);
  }

  /**
   * Wrap packed bytes read back from an artifact.
   */
  static from(packed: Uint8Array, size: number): FrequencyTable {
    return new FrequencyTable(packed, size);
  }

  readonly #packed: Uint8Array;
  readonly #size: number;

  /**
   * Wrap already-packed bytes. Use {@link FrequencyTable.build} or
   * {@link FrequencyTable.from}.
   */
  private constructor(packed: Uint8Array, size: number) {
    this.#packed = packed;
    this.#size = size;
  }

  /**
   * How many entries the table describes.
   */
  get size(): number {
    return this.#size;
  }

  /**
   * The frequency bucket of an entry, from 0 (rarest) to 15 (most common).
   *
   * Positions outside the table report the rarest bucket, so that a missing
   * entry is treated as unlikely rather than as an error.
   */
  bucketOf(index: number): number {
    if (index < 0 || index >= this.#size) {
      return 0;
    }
    const byte = this.#packed[index >> 1] ?? 0;
    return index % 2 === 0 ? byte >> 4 : byte & 0xf;
  }

  /**
   * The decoding cost of an entry, where lower means more likely.
   *
   * A quantised `−log P`, and {@link WORD_CHARGE} is not a tuning knob but the
   * missing half of it: a bucket records `log f`, and `−log P` is
   * `log N − log f`, so the charge is what turns one into the other. Getting it
   * wrong is what makes a decoder split words that should stay whole, because
   * every extra word in a path pays the charge again.
   */
  costOf(index: number): number {
    return MAX_BUCKET - this.bucketOf(index) + WORD_CHARGE;
  }

  /**
   * The packed bytes, ready to be written out.
   */
  serialise(): Uint8Array {
    return this.#packed;
  }
}
