/**
 * How a slug is built.
 *
 * Their own module because every part of slugging reads them and none of them
 * reads the others: the words, the hash and the fitting all take the same
 * options object, and none of the three should have to import the other two to
 * name it.
 */
import type { NumberStyle } from "../decode/convert.js";
import type { SandhiOptions } from "../decode/sandhi.js";
import type { Locale } from "../script/script.js";

/**
 * Whether a slug carries its tones.
 *
 * `numbers` writes them as digits — 中文 is `zhong1wen2` — and `none` leaves
 * them off. Tones are on by default because dropping them collides: there are
 * roughly 400 toneless syllables against 1300 toned ones, so a toneless slug
 * runs 树, 书 and 输 together as `shu`. They are not a guarantee, though —
 * 权利 and 权力 are both `quan2li4`, and only {@link SlugOptions.hash} tells
 * those apart.
 */
export type SlugTones = "numbers" | "none";

/**
 * Whether the syllables inside one word are separated.
 *
 * `join` writes a word as a word — 中文 is `zhong1wen2` — which is what 正词法
 * asks for and what a reader expects in a URL. `separate` cuts every syllable
 * apart, `zhong1-wen2`, for a caller matching a slug syllable by syllable.
 */
export type SlugSyllables = "join" | "separate";

/**
 * How ü is written where the alphabet has no room for it.
 *
 * `v` is the input-method convention and keeps 绿 `lv4` apart from 路 `lu4`;
 * `u` is prettier and merges them.
 */
export type SlugUmlaut = "v" | "u";

/**
 * How a slug is built.
 */
export interface SlugOptions {
  /** Whether tones are written. Defaults to `numbers`. */
  readonly tones?: SlugTones;
  /**
   * What goes between words. Defaults to `-`.
   *
   * Written as given rather than checked, because the separator is the one
   * place a caller decides what kind of identifier this is: `-` for a URL, `_`
   * for a name in code, and the empty string for a key to match against.
   */
  readonly separator?: string;
  /** Whether the syllables within a word are separated. Defaults to `join`. */
  readonly syllables?: SlugSyllables;
  /** How ü is written. Defaults to `v`. */
  readonly umlaut?: SlugUmlaut;
  /**
   * What to do with the digits in a text. Defaults to `keep`.
   *
   * The opposite of what a conversion defaults to, and deliberately: a slug for
   * iPhone 15 评测 should be `iphone-15-ping2ce4` rather than
   * `iphone-shi2wu3-ping2ce4`, because the digits are how anyone would look for
   * it. `read` says them, for a caller that wants the text spoken.
   */
  readonly numbers?: NumberStyle;
  /**
   * A short hash of the source text on the end. Defaults to none.
   *
   * `true` for {@link DEFAULT_HASH_LENGTH} characters, or a length of your own,
   * up to {@link LONGEST_HASH}. See {@link hashOf} for what is hashed and why
   * it is the hanzi rather than the pinyin.
   *
   * Unconditional rather than only where two slugs collide: a function that
   * cannot see the rest of your corpus cannot know that they did. It narrows
   * collisions rather than closing them, and checking the slug you generated
   * against the ones you have stored is still yours to do.
   */
  readonly hash?: number | boolean;
  /**
   * The longest the slug may be, counting any hash. Defaults to no limit.
   *
   * Cut at a word boundary, so a limit lands between words rather than through
   * the middle of one. A single word longer than the limit is cut where the
   * limit falls, since there is nowhere else to cut it, and the hash is never
   * what gets dropped.
   */
  readonly maxLength?: number;
  /**
   * What to write where a text slugs to nothing. Defaults to the empty string.
   *
   * 《》！ has no letters in it, and neither does an empty text.
   */
  readonly fallback?: string;
  /** Which reading standard to use. Defaults to `zh-CN`. */
  readonly locale?: Locale;
  /** Which tone sandhi to apply. Defaults to what a conversion applies. */
  readonly sandhi?: SandhiOptions;
}
