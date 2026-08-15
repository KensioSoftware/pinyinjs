/**
 * The short hash a slug may carry on its end.
 *
 * Apart from the rest of slugging because it never sees a syllable: what is
 * hashed is the source text, for the reason set out at {@link hashOf}, so this
 * runs beside the conversion rather than after it.
 */

/**
 * How many characters {@link SlugOptions.hash} writes when simply asked for.
 *
 * Four base-36 characters is 1.7 million values, which is far more than it
 * looks: two texts only collide when their slugs *and* their hashes match, so
 * the suffix is only ever telling apart the handful of texts sharing one slug,
 * not the whole corpus.
 */
export const DEFAULT_HASH_LENGTH = 4;

/**
 * The longest hash there is anything to fill.
 *
 * {@link hashOf} is 32 bits wide, and 36⁷ is the last power of 36 under 2³²:
 * asking for an eighth character would add a place that some values can never
 * reach, which looks like more uniqueness while being none.
 */
export const LONGEST_HASH = 7;

/**
 * A 32-bit hash of a text, written in the letters and digits a slug allows.
 *
 * **The source text is what is hashed, not the pinyin.** Two texts needing a
 * hash to tell them apart are, by definition, ones the pinyin already ran
 * together: 权利 and 权力 are both `quan2li4`, and hashing that would give them
 * the same suffix and settle nothing. Hashing the hanzi also means the suffix
 * does not move when a later release reads a word differently, so a slug's tail
 * is the stable half of it.
 *
 * FNV-1a with murmur3's finalizer, which is neither cryptographic nor trying to
 * be: nothing here resists an attacker, and all that is being asked of it is
 * that two texts a reader would call different land on different suffixes.
 * Written out rather than reached for because the package has no runtime
 * dependencies and the core imports no Node built-ins, and `crypto.subtle` —
 * the one hash a browser ships — is asynchronous, which this is not.
 *
 * Normalised first, so that text typed as a decomposed sequence hashes as the
 * same text once composed. 简体 and 繁體 are deliberately *not* folded together:
 * a caller who wrote 头发 and 頭髮 separately meant them separately.
 */
export function hashOf(text: string, length: number): string {
  const bytes = new TextEncoder().encode(text.normalize("NFC"));
  let hash = 0x81_1c_9d_c5;
  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, 0x01_00_01_93);
  }
  // FNV-1a leaves its lowest bits the least mixed, and the last characters of
  // the base-36 spelling are exactly those bits, so this spreads them first.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85_eb_ca_6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2_b2_ae_35);
  hash ^= hash >>> 16;

  const wanted = Math.min(Math.max(Math.trunc(length), 1), LONGEST_HASH);
  return (hash >>> 0).toString(36).padStart(LONGEST_HASH, "0").slice(-wanted);
}

/**
 * How long a hash the options asked for, or zero for none.
 */
export function hashLength(asked: number | boolean | undefined): number {
  if (asked === undefined || asked === false) {
    return 0;
  }
  if (asked === true) {
    return DEFAULT_HASH_LENGTH;
  }
  return Math.min(Math.max(Math.trunc(asked), 0), LONGEST_HASH);
}
