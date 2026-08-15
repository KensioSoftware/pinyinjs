/**
 * What a conversion is asked for, and the shape of one piece of its output.
 *
 * Everything here describes the conversion rather than performing any of it.
 */
import type { ApostropheStyle } from "../orthography/apostrophe.js";
import type { CapitalStyle } from "../orthography/capitals.js";
import type { PunctuationStyle } from "../orthography/punctuation.js";
import type { Locale } from "../script/script.js";
import type { Syllable, ToneNotation } from "../syllable/syllable.js";
import type { ReadingConfidence } from "./confidence.js";
import type { ReadingHints } from "./hints.js";
import type { SandhiOptions } from "./sandhi.js";

/**
 * How a conversion should be carried out and written.
 */
export interface ConvertOptions {
  /** Which reading standard to use. Defaults to `zh-CN`. */
  readonly locale?: Locale;
  /** How tones are written. Defaults to diacritics. */
  readonly notation?: ToneNotation;
  /** Which tone sandhi to apply. */
  readonly sandhi?: SandhiOptions;
  /** When the 隔音符号 is written. Defaults to `always`. */
  readonly apostrophe?: ApostropheStyle;
  /** Which capitals are written. Defaults to `auto`. */
  readonly capitals?: CapitalStyle;
  /** Whether Chinese punctuation is rewritten. Defaults to `latin`. */
  readonly punctuation?: PunctuationStyle;
  /** Whether GB/T 16159 word grouping is applied. Defaults to true. */
  readonly grouping?: boolean;
  /**
   * What to do with the digits in a text. Defaults to `read`.
   *
   * `read` says them: 我有3个 is `wǒ yǒu sān gè` and 1998年 is
   * `yī jiǔ jiǔ bā nián`. `keep` leaves every digit exactly as it was written,
   * which is what this did before there was anything to read them with.
   */
  readonly numbers?: NumberStyle;
  /**
   * Readings the caller asserts, over whatever the sources say.
   *
   * No rule can settle every polyphone, and some texts are genuinely ambiguous
   * — 孩子越长越漂亮 grows where 头发越长越漂亮 lengthens — so an application
   * that knows its own content can say what this one could only guess at.
   *
   * ```ts
   * convert(dictionary, "这篇文章不太长。", { readings: { 太长: "tài cháng" } });
   * ```
   *
   * A hint displaces whatever covered exactly the characters it names, and
   * competes normally with everything else, so a bare `长` hint leaves 校长 as
   * `xiàozhǎng` — the longer word is still the better reading of that stretch.
   * See {@link ReadingHints}.
   */
  readonly readings?: ReadingHints;
}

/**
 * What a conversion does with the digits it meets.
 */
export type NumberStyle = "read" | "keep";

/**
 * One piece of a conversion: a syllable, or the text between two of them.
 *
 * A conversion is assembled piece by piece and joined at the very end, so that
 * a caller wanting to render each syllable separately — colouring its tone,
 * marking it uncertain — is not left trying to find the syllables again in a
 * finished string. {@link convert} is this, joined.
 */
export interface ConvertedPiece {
  readonly text: string;
  /** The syllable this piece writes, or undefined where it writes none. */
  readonly syllable: Syllable | undefined;
  /**
   * The characters this piece reads, where it names any of its own.
   *
   * What an annotation needs and a plain conversion throws away: to write 银行
   * with `yín` over 银 and `háng` over 行, something has to say which characters
   * each syllable is a reading *of*, and that is not the syllable's position.
   * A reading is not one syllable per character — 玩儿 is two characters and
   * the single syllable `wánr` — and a read number is not made of characters at
   * all in the same way, 95% being `bǎifēnzhījiǔshíwǔ` over eight syllables and
   * three written characters.
   *
   * So a piece either names the characters it reads or continues the ones the
   * piece before it named, and the two are told apart by the syllable rather
   * than by a second flag:
   *
   * | `syllable` | `source` | The piece |
   * | --- | --- | --- |
   * | undefined | undefined | writes no reading: a space, or a non-Han run |
   * | set | set | reads exactly those characters |
   * | set | undefined | reads on into the characters named before it |
   *
   * {@link import("../format/html.js").toAnnotatedHtml} is what consumes it.
   */
  readonly source: string | undefined;
  /**
   * How settled that syllable was, where the decode reported it.
   *
   * Only {@link convertPieces} fills this in, and only for a syllable the
   * lattice decoded: the greedy baseline cannot say what it rejected, and a
   * Taiwan reading that differs in length from its mainland form cannot be
   * lined up with it.
   */
  readonly confidence: ReadingConfidence | undefined;
}

/**
 * The orthographic choices a conversion has settled, rather than defaulted.
 */
export interface Written {
  readonly notation: ToneNotation;
  readonly apostrophe: ApostropheStyle;
  readonly capitals: CapitalStyle;
}
