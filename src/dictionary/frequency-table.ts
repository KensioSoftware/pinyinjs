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
 * on that same scale is `15 · log N / L − b`, so the constant term is
 * `15 · (log N / L − 1)` rather than the 1 that was here before. That
 * arithmetic is {@link derivedWordCharge}, and the build holds this constant to
 * it, since a constant in `src/` is the one thing a corpus refresh cannot
 * bring with it.
 *
 * **`N` is jieba's corpus**, which is where every count in the dictionary comes
 * from. As the build parses it, 60,101,964 occurrences over 349,045 words with
 * 了 the busiest at 883,634, giving `log N = 17.91`, `L = 13.69` and a charge
 * of 4.62. Only the *ratio* of the two logarithms matters, and it moves slowly.
 * Doubling every count in the corpus shifts it by 0.05.
 *
 * **Summing `full.counts` gives 82,372,768, and that is not `N`.** The artifact
 * attributes one corpus to more keys than jieba has words. A 繁體 spelling
 * claims its 简体 entry's count, and `traditional-carry.ts` lends a count to a
 * 繁體 character holding an entry of its own. 银行 and 銀行 are one word met
 * once and two keys counted twice, and 20,447,271 of that total sits on keys
 * jieba does not list at all.
 *
 * The value is load-bearing. At the old charge of 1 the lattice decoder read
 * 还给 as 还 + 给 and 还是 as 还 + 是, because two common characters summed to
 * less than one uncommon word. At the derived charge both stay whole.
 *
 * **Its exact value inside a unit is not.** Buckets are integers, so a path
 * carrying *k* words more than its rival turns on where `k · charge` falls
 * between two of them. 4.62 and 4.97 agree at `k` of 1 and 2 and first differ
 * at 3. Converted at 4.97, 63 of the 139,682 Han runs in 88,866 lines of
 * Tatoeba and zh.wikipedia come out differently, and every one of the 63
 * decodes into as many words as it did before. They are exact ties in the
 * bucket sum, re-broken by the order the floats happened to be added in.
 */
export const WORD_CHARGE = 4.62;

/**
 * The count a name the corpus never counted is quantised at.
 *
 * A count of zero earns bucket 0, and {@link FrequencyTable.costOf} reads that
 * as `−log P` with `P` of `1/N`. On jieba's corpus the flat cost it produces is
 * 19.62, and two mid-frequency characters come to less. 脸书 cost 19.62 where
 * 脸 and 书 together cost 18.24, and `decodeRun` read Facebook as a face and a
 * book. 推特, 高雄, 乐高 and 网飞 all went the same way, and 671 of the 5,039
 * uncounted names of two or three characters came apart when read on their
 * own. 谷歌 survived on an exact tie.
 *
 * **Zero is the wrong count for a name jieba's list never held.** The list has
 * no frequency floor to be under. It carries 一万一千五百二十颗 on two
 * occurrences. A word missing from it was left out of the lexicon, and the
 * corpus was never asked about it. Names are where that bites, since a name
 * enters the language whenever something is given one. 微软 was counted 1757
 * times and 脸书 not at all, and only one of the two existed when the list was
 * drawn. 10,676 of the dictionary's 42,861 names are counted nowhere.
 *
 * **3 is jieba's own answer for a word it lists and cannot count.** Its counts
 * bottom out at 2, and 3 carries 159,318 of 349,045 entries against 40,502 at 2
 * and 12,679 at 4. Interpolating between the neighbours accounts for about
 * 22,000 of those, and the other 137,000 carry a default. It is the default a
 * hand-added entry gets (AT&T, B超 and C++ are all counted 3).
 *
 * The value is loose. Bucket 2 runs from 3 to 8, so any count jieba might have
 * settled on in that range quantises the same way and lands the cost at 17.62.
 * What the floor buys a name is two buckets against a split.
 *
 * **Names only.** The same floor over every uncounted key lifts two thirds of
 * the dictionary by two buckets and re-tips
 * {@link import("../decode/lattice-types.js").READING_CHARGE}, which was sized
 * against bucket 0 at 19.62. Measured that way 從容地 joins, 都會 reads `dūhuì`
 * and 過得 reads `guò dé`, and the gold harness goes from 3 misses to 6. The
 * dictionary's tail is where 费耗, 块肉 and 拍张 live, and bucket 0 is what
 * holds them off.
 *
 * 428 of the 671 names now stay whole. The ones left are compounds a split
 * suits, 中国菜, 日本人, 上海话 and 美国人 among them, and each beats its own
 * entry by more than two buckets. Over the 88,866 lines of Tatoeba and
 * zh.wikipedia 86 of 139,682 Han runs move, the gold harness holds at 3 misses
 * and CPP holds at 91.49%.
 */
export const UNCOUNTED_NAME = 3;

/**
 * The count an entry is quantised at. Its own, unless it is a name the corpus
 * never counted. See {@link UNCOUNTED_NAME}.
 *
 * Applied where the artifact is written and nowhere else, so `full.counts`
 * keeps the corpus as it was met. The two files disagree by design over these
 * 10,676 keys, and `data.test.ts` checks their alignment through this
 * function.
 */
export function countForQuantising(
  frequency: number,
  isProperNoun: boolean,
): number {
  return isProperNoun && frequency <= 0 ? UNCOUNTED_NAME : frequency;
}

/**
 * The charge a corpus derives, for the build to hold {@link WORD_CHARGE} to.
 *
 * `total` is the corpus, counted once. `highest` is the largest count in it,
 * which is what {@link FrequencyTable.build} scales the buckets by, so the two
 * have to be read off the same corpus for the result to mean anything.
 */
export function derivedWordCharge(total: number, highest: number): number {
  return MAX_BUCKET * (Math.log(total) / Math.log1p(highest) - 1);
}

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
   *
   * Counts arrive through {@link countForQuantising}, which is where a name the
   * corpus never counted is given jieba's own default for one.
   */
  static build(frequencies: readonly number[]): FrequencyTable {
    // Looped rather than `Math.max(0, ...frequencies)`, which passes one
    // argument per entry and overflows the call stack somewhere above a hundred
    // thousand of them — well short of the 461,555 the full dictionary holds.
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
