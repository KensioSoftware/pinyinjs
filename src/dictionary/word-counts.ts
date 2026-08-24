/**
 * Raw corpus counts, kept beside the quantised table rather than inside it.
 *
 * {@link import("./frequency-table.js").FrequencyTable} packs a count into four
 * bits, because 16 buckets are all the decoder compares and they cost 9 KB
 * where raw single-byte counts cost 23 KB. A caller ranking words against each
 * other needs what that packing throws away. Rank the 120,858 CC-CEDICT
 * headwords the full tier holds by `cost` and 5,934 of them land on the value
 * at rank 10,000, so which words make a top-10,000 cut is decided by codepoint
 * order. Rank the same words on the counts those buckets were quantised from
 * and the tie at that rank is 16 words wide.
 *
 * So this is a second artifact, read by a caller that asks for it and by
 * nothing on the decoding path. See `docs/dictionaries/` for the shape of it.
 */
import { claimKeys, orderedClaims } from "./artifact-claims.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * The largest count that survives a round trip, which is 32 bits of varint.
 *
 * jieba's busiest word is attested 883,634 times, which leaves the ceiling
 * three orders of magnitude clear of anything the corpus holds. It bounds the
 * encoder rather than rejecting data.
 */
const MAX_COUNT = 0xff_ff_ff_ff;

const CONTINUATION = 0x80;
const PAYLOAD = 0x7f;
const SHIFT = 7;

/**
 * Corpus counts for every key of a tier, one variable-length integer each.
 *
 * Counts are positional in the same sense the frequency table is: entry *n*
 * describes the key at position *n* of the matching
 * {@link import("./key-index.js").KeyIndex}, which is what
 * {@link import("./dictionary.js").Dictionary.wordAt} reads.
 *
 * The encoding is LEB128, measured against the alternatives on the full tier's
 * 723,147 keys. It takes 747 KB, and 243 KB brotli, where a fixed 32-bit array
 * takes 2,825 KB and 299 KB and decimal text takes 1,586 KB and 281 KB. Two
 * thirds of the keys are attested nowhere and most of the rest carry a small
 * count, and a fixed width pays for the maximum on all of them.
 *
 * Unlike the rest of the artifact this *is* parsed on load, into one typed
 * array. Nothing in a browser reads it, so the load cost buys a random access
 * that a varint stream cannot otherwise give.
 */
export class WordCounts {
  /**
   * Encode raw counts, in key order.
   *
   * A count of zero means the word is attested nowhere in the corpus, which is
   * a fact about the word and is stored as one. Fractions and negatives are
   * floored into range rather than rejected, since a source that supplies one
   * has already been through the merge.
   */
  static build(counts: readonly number[]): WordCounts {
    const values = Uint32Array.from(counts, (count) =>
      Number.isFinite(count) ? Math.min(MAX_COUNT, Math.max(0, count)) : 0,
    );

    const packed: number[] = [];
    for (const value of values) {
      let remaining = value;
      do {
        const byte = remaining & PAYLOAD;
        remaining >>>= SHIFT;
        packed.push(remaining > 0 ? byte | CONTINUATION : byte);
      } while (remaining > 0);
    }

    return new WordCounts(values, Uint8Array.from(packed));
  }

  /**
   * Decode packed bytes read back from an artifact.
   *
   * How many counts there are is a property of the stream rather than an
   * argument, since every count ends at the first byte without a continuation
   * bit. A truncated stream ends mid-count, and the trailing bytes are dropped
   * rather than reported as a value the file never held.
   */
  static from(packed: Uint8Array): WordCounts {
    const values: number[] = [];
    let value = 0;
    let shift = 0;
    for (const byte of packed) {
      // `+` rather than `|`, which is signed and would wrap the top bit of a
      // 32-bit count into a negative number.
      value += (byte & PAYLOAD) * 2 ** shift;
      if ((byte & CONTINUATION) === 0) {
        values.push(value);
        value = 0;
        shift = 0;
      } else {
        shift += SHIFT;
      }
    }

    return new WordCounts(Uint32Array.from(values), packed);
  }

  readonly #counts: Uint32Array;
  readonly #packed: Uint8Array;

  /**
   * Hold decoded counts beside the bytes they came from. Use
   * {@link WordCounts.build} or {@link WordCounts.from}.
   */
  private constructor(counts: Uint32Array, packed: Uint8Array) {
    this.#counts = counts;
    this.#packed = packed;
  }

  /**
   * How many keys the counts describe.
   *
   * Worth checking against {@link import("./dictionary.js").Dictionary.size}
   * before pairing the two by position. The counts are built for one tier, and
   * against any other tier every position would name a different word.
   */
  get size(): number {
    return this.#counts.length;
  }

  /**
   * Corpus occurrences of the key at a position.
   *
   * Positions outside the table report zero, which is what an unattested word
   * reports, so a caller ranking by count sorts a missing key to the bottom.
   */
  countOf(at: number): number {
    return this.#counts[at] ?? 0;
  }

  /**
   * The packed bytes, ready to be written out.
   */
  serialise(): Uint8Array {
    return this.#packed;
  }
}

/**
 * Compile the counts artifact from merged entries.
 *
 * The keys are claimed and ordered the way `artifact.ts` claims and orders
 * them, so position *n* here is position *n* there. Only the `full` tier is
 * written: a caller ranking words wants the whole vocabulary ordered, and a
 * ranking over part of it answers a different question.
 */
export function buildWordCounts(
  entries: readonly DictionaryEntry[],
): WordCounts {
  return WordCounts.build(
    orderedClaims(claimKeys(entries)).map(([, entry]) => entry.frequency),
  );
}
