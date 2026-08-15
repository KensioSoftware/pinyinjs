/**
 * What a conversion is made of: the options it takes, and the pieces it
 * hands back.
 *
 * The leaf layer of the conversion. Everything here builds or describes a
 * single piece of output, and none of it knows how a text is decoded — which
 * is what lets `convert.ts` sit on top of it.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { isErCharacter, isErFinal } from "../dictionary/erhua.js";
import { isSameReading } from "../dictionary/entry.js";
import { type ApostropheStyle, markWord } from "../orthography/apostrophe.js";
import { capitaliseWord, type CapitalStyle } from "../orthography/capitals.js";
import type { PunctuationStyle } from "../orthography/punctuation.js";
import { toCharacters } from "../script/characters.js";
import type { Locale } from "../script/script.js";
import {
  type Syllable,
  type ToneNotation,
  writeSyllable,
} from "../syllable/syllable.js";
import type { ReadingConfidence } from "./confidence.js";
import type { ReadingHints } from "./hints.js";
import type { SandhiOptions } from "./sandhi.js";
import type { DecodedWord } from "./word.js";

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

/**
 * The reading a word takes in a locale.
 *
 * `zh-TW` is stored as a delta, so a word with no Taiwan reading simply reads
 * the same in both.
 *
 * The delta is measured against the entry's own 普通话 reading, so it only
 * applies where the decode settled on that reading. A polyphone the decode read
 * some other way — 长 as `cháng` where its entry reads `zhǎng`, 差 as `chā`
 * where its entry reads `chà` — is a different sense of the word, and the delta
 * beside the entry says nothing about it. Replacing the reading there would
 * discard what the lattice worked out in favour of a reading of the wrong
 * syllable entirely.
 */
export function readingFor(
  dictionary: Dictionary,
  word: DecodedWord,
  locale: Locale,
): readonly Syllable[] {
  if (locale !== "zh-TW") {
    return word.reading;
  }
  const entry = dictionary.lookup(word.text);
  if (entry?.taiwanReading === undefined) {
    return word.reading;
  }
  return isSameReading(entry.reading, word.reading)
    ? entry.taiwanReading
    : word.reading;
}

/**
 * Text that writes no syllable: a space, or a run that was never Han.
 */
export function plainPiece(text: string): ConvertedPiece {
  return {
    text,
    syllable: undefined,
    confidence: undefined,
    source: undefined,
  };
}

/**
 * Source text that is written out but read as nothing.
 *
 * The difference from {@link plainPiece} is what the text *is*. Both write no
 * syllable, but a run that was never Han — punctuation, a Latin word, a digit
 * left unread — stands for something the author wrote, whereas the space
 * between two words and the hyphen inside 干干净净 are pinyin orthography that
 * the source has no trace of.
 *
 * A conversion joins them into one string and the distinction does not arise.
 * An annotation writes the source and the reading in different places, and
 * putting a hyphen the pinyin needs into the hanzi it annotates would be
 * inventing text: 干干净净 is `gāngān-jìngjìng` and is not written 干干-净净.
 *
 * The text and the source can differ, and the punctuation pass is why: it
 * rewrites 。 to a full stop in the `text` a conversion writes, and leaves the
 * `source` as the mark the author actually typed.
 */
export function sourcePiece(text: string): ConvertedPiece {
  return {
    text,
    syllable: undefined,
    confidence: undefined,
    source: text,
  };
}

/**
 * Which characters of a word each of its syllables reads.
 *
 * One per syllable, in order, and undefined where a syllable reads on into the
 * characters the one before it took. Only 儿化 does that: measured over the
 * committed dictionary, 5,283 of 723,147 keys have fewer syllables than
 * characters, 4,024 of them because a final 儿 folds into the syllable before
 * it, and the remaining 1,259 because the word is written with punctuation —
 * which cannot reach here, since punctuation ends a Han run before the decode
 * ever sees it.
 *
 * The deficit is spent from the right, which is where 儿化 always is. 打哪儿指
 * 哪儿 is the case that needs it: two syllables short over six characters, and
 * both 儿 attach to the character in front of them rather than one taking two.
 */
export function sourcesOf(
  word: string,
  reading: readonly Syllable[],
): readonly (string | undefined)[] {
  const characters = toCharacters(word);
  if (characters.length === reading.length) {
    return characters;
  }
  // Anything this does not understand is one base for the whole word, which is
  // always true and merely less useful than naming each syllable's characters.
  if (characters.length < reading.length || !isErFinal(word)) {
    return reading.map((_, at) => (at === 0 ? word : undefined));
  }

  const sources: string[] = [];
  let deficit = characters.length - reading.length;
  for (const character of characters) {
    const previous = sources.at(-1);
    if (deficit > 0 && previous !== undefined && isErCharacter(character)) {
      sources[sources.length - 1] = previous + character;
      deficit--;
      continue;
    }
    sources.push(character);
  }
  /* c8 ignore next 3 -- the deficit is 儿 by construction, but a source that
     wrote one somewhere else would otherwise misalign every later syllable */
  return sources.length === reading.length
    ? sources
    : reading.map((_, at) => (at === 0 ? word : undefined));
}

/**
 * Write one decoded word as one piece per syllable.
 *
 * Only proper nouns are capitalised here; a sentence capital is applied to the
 * whole conversion afterwards, since it belongs to whichever run happens to
 * start the sentence.
 */
export function writeWord(
  reading: readonly Syllable[],
  confidence: readonly ReadingConfidence[],
  word: DecodedWord,
  written: Written,
): readonly ConvertedPiece[] {
  if (reading.length === 0) {
    return [sourcePiece(word.text)];
  }
  // A tone number already ends its syllable, raised or not, so `xi1an1` cannot
  // be misread and the 隔音符号 would only be noise.
  const isNumbered =
    written.notation === "numbers" || written.notation === "superscript";
  const spellings = markWord(
    reading.map((syllable) => writeSyllable(syllable, written.notation)),
    isNumbered ? "never" : written.apostrophe,
  );
  const isCapitalised = word.isProperNoun && written.capitals !== "none";
  const sources = sourcesOf(word.text, reading);

  return spellings.map((spelling, at) => ({
    text: at === 0 && isCapitalised ? capitaliseWord(spelling) : spelling,
    syllable: reading[at],
    confidence: confidence[at],
    source: sources[at],
  }));
}
