import type { Dictionary } from "../dictionary/dictionary.js";
import { isErFinal } from "../dictionary/erhua.js";
import { isSameReading } from "../dictionary/entry.js";
import { type ApostropheStyle, markWord } from "../orthography/apostrophe.js";
import {
  capitaliseSentenceParts,
  capitaliseWord,
  type CapitalStyle,
  isSentence,
} from "../orthography/capitals.js";
import { applyGrouping } from "../orthography/grouping.js";
import {
  type PunctuationStyle,
  toLatinPunctuationParts,
} from "../orthography/punctuation.js";
import {
  type NumeralContext,
  type NumeralSegment,
  readNumbersIn,
  saidNumeral,
} from "../numerals/text.js";
import { toCharacters } from "../script/characters.js";
import type { Locale } from "../script/script.js";
import {
  type Syllable,
  type ToneNotation,
  writeSyllable,
} from "../syllable/syllable.js";
import type { ReadingConfidence } from "./confidence.js";
import { divisionOf } from "./constituents.js";
import { decodeRun, decodeRunScored } from "./decode.js";
import {
  hintsWithin,
  type ReadingHints,
  resolveHints,
  type ResolvedHints,
} from "./hints.js";
import { decodeGreedily } from "./greedy.js";
import { READING_RULES } from "./reading-rules.js";
import { splitRuns, type TextRun } from "./runs.js";
import { applySandhi, type SandhiOptions } from "./sandhi.js";
import type { DecodedWord, ScoredWord } from "./word.js";

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
interface Written {
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
function readingFor(
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
function plainPiece(text: string): ConvertedPiece {
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
function sourcePiece(text: string): ConvertedPiece {
  return {
    text,
    syllable: undefined,
    confidence: undefined,
    source: text,
  };
}

/**
 * Whether a character is the 儿 that 儿化 folds into the syllable before it.
 */
function isErCharacter(character: string): boolean {
  return character === "儿" || character === "兒";
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
function sourcesOf(
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
function writeWord(
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

/**
 * How a Han run is turned into words, with whatever the decoder can say about
 * how settled they were.
 */
type Decode = (
  dictionary: Dictionary,
  run: string,
  before: string,
  hints: ResolvedHints | undefined,
) => readonly ScoredWord[];

/**
 * A decoder that reports no confidence at all, which is every decoder but one.
 */
function unscored(
  decode: (
    dictionary: Dictionary,
    run: string,
    before: string,
    hints: ResolvedHints | undefined,
  ) => readonly DecodedWord[],
): Decode {
  return (dictionary, run, before, hints) =>
    decode(dictionary, run, before, hints).map((word) => ({
      word,
      confidence: [],
    }));
}

/**
 * The lattice decoder, reporting nothing about its own confidence.
 */
const LATTICE: Decode = unscored((dictionary, run, before, hints) =>
  decodeRun(dictionary, run, READING_RULES, before, hints),
);

/**
 * The lattice decoder, with what each reading was chosen over.
 */
const SCORED: Decode = (dictionary, run, before, hints) =>
  decodeRunScored(dictionary, run, READING_RULES, before, hints);

/**
 * The greedy baseline, which has nothing to report either way.
 *
 * The context in front of a run goes unused: longest-match has no way to weigh
 * one segmentation against another, which is the whole reason it is the
 * baseline, and a 汉字 it cannot report would only be another thing to trim.
 */
const GREEDY: Decode = unscored(decodeGreedily);

/**
 * Write one Han run's worth of decoded words.
 */
function writeRun(
  dictionary: Dictionary,
  words: readonly ScoredWord[],
  locale: Locale,
  written: Written,
  sandhi: SandhiOptions | undefined,
): readonly ConvertedPiece[] {
  // Sandhi runs across the whole run rather than within a word, since 不 in one
  // word assimilates to the tone starting the next. Third-tone sandhi needs to
  // know where the words are all the same, so the grouping goes with it — and
  // only when it is asked for, since dividing a word costs lookups.
  const readings = words.map((scored) =>
    readingFor(dictionary, scored.word, locale),
  );
  const grouping =
    sandhi?.thirdTone === true
      ? words.map((scored, index) => {
          const reading = readings[index] ?? [];
          return (
            divisionOf(dictionary, scored.word.text, reading) ?? reading.length
          );
        })
      : undefined;
  const flattened = applySandhi(readings.flat(), sandhi, grouping);

  let at = 0;
  const pieces: ConvertedPiece[] = [];
  for (const [index, scored] of words.entries()) {
    /* c8 ignore next -- readings is built by mapping over these same words */
    const length = readings[index]?.length ?? 0;
    if (index > 0) {
      // A space, unless 分词连写 wrote a hyphen: 干干净净 is one orthographic
      // word, `gāngān-jìngjìng`, cut into two decoded ones.
      pieces.push(plainPiece(scored.word.separator ?? " "));
    }
    pieces.push(
      ...writeWord(
        flattened.slice(at, at + length),
        // A locale reading of a different length cannot be lined up with the
        // confidence reported for the reading it replaced.
        scored.confidence.length === length ? scored.confidence : [],
        scored.word,
        written,
      ),
    );
    at += length;
  }
  return pieces;
}

/**
 * Rewrite every piece's text with a pass that reads across all of them.
 */
function rewrite(
  pieces: readonly ConvertedPiece[],
  pass: (parts: readonly string[]) => readonly string[],
): readonly ConvertedPiece[] {
  const rewritten = pass(pieces.map((piece) => piece.text));
  return pieces.map((piece, at) => {
    /* c8 ignore next -- one part comes back for each part handed over */
    const text = rewritten[at] ?? piece.text;
    return text === piece.text ? piece : { ...piece, text };
  });
}

/**
 * The words a Han run decodes to, with 分词连写 applied.
 *
 * Grouping rewrites word boundaries and never the readings behind them, so the
 * syllables — and the confidence beside them — survive it in order.
 */
function wordsOf(
  decoded: readonly ScoredWord[],
  dictionary: Dictionary,
  isGrouped: boolean,
): readonly ScoredWord[] {
  return isGrouped
    ? regroup(
        decoded,
        applyGrouping(
          decoded.map((scored) => scored.word),
          dictionary,
        ),
      )
    : decoded;
}

/**
 * What surrounds a non-Han run, as far as a number in it cares.
 */
interface RunContext {
  readonly after: {
    readonly character: string;
    readonly syllable: Syllable | undefined;
  };
  /** Whether pinyin was written immediately before this run. */
  readonly isAfterHan: boolean;
}

/**
 * The Han either side of a run, as the two characters a number goes on.
 *
 * A number's context, bar one syllable of it. The characters decide how it is
 * read — 年 makes 1998 a year, 个 makes 3 a count and 2 两, and 第 makes 2 an
 * ordinal — and characters are all they are, so this is known before anything
 * has been decoded. Which is what lets the numbers be read first and the decode
 * of the Han after them see what the digits stood for.
 */
function surroundingCharacters(
  runs: readonly TextRun[],
  at: number,
): NumeralContext {
  const previous = runs[at - 1];
  const next = runs[at + 1];
  return {
    following: next?.isHan === true ? (toCharacters(next.text)[0] ?? "") : "",
    preceding:
      previous?.isHan === true
        ? (toCharacters(previous.text).at(-1) ?? "")
        : "",
  };
}

/**
 * What surrounds a run once it has been decoded: the character after it, and
 * the syllable that character is read as.
 *
 * The syllable is the one part of a number's context that a decode has to
 * supply, and it is what a 一 ending the number assimilates to.
 */
function surrounding(
  runs: readonly TextRun[],
  decoded: readonly (readonly ScoredWord[])[],
  at: number,
): RunContext {
  return {
    after: {
      character: surroundingCharacters(runs, at).following,
      syllable: decoded[at + 1]?.[0]?.word.reading[0],
    },
    isAfterHan: runs[at - 1]?.isHan === true,
  };
}

/**
 * The 汉字 a number in front of a Han run stands for, for that run's decode.
 *
 * Only the last segment of the run before, because only that one touches the
 * Han: the D of 3D银行 comes between them, and a decode of 银行 that saw 三
 * beside it would be reading a text nobody wrote.
 */
function numeralBefore(segments: readonly NumeralSegment[]): string {
  return segments.at(-1)?.hanzi ?? "";
}

/**
 * Whether a character wants a space between it and a number read out.
 *
 * A letter or a digit does; punctuation does not, so 20%。 keeps its full stop
 * against the number.
 */
const WORDLIKE = /[\p{L}\p{N}]/u;

/**
 * Whether two stretches take a space between them once one has been read.
 */
function isSpaced(before: string, after: string): boolean {
  return WORDLIKE.test(before.at(-1) ?? "") && WORDLIKE.test(after[0] ?? "");
}

/**
 * Write a run whose words are already known, a word at a time.
 *
 * Each group is one orthographic word and takes the 隔音符号 within itself, so
 * a time's minutes are `sānshí` rather than `sān shí` — the same grouping the
 * number would get if the text had written 6点30分 out in 汉字.
 */
function groupedPieces(
  spelled: readonly string[],
  said: readonly Syllable[],
  words: readonly number[],
  apostrophe: ApostropheStyle,
): readonly ConvertedPiece[] {
  const pieces: ConvertedPiece[] = [];
  let at = 0;
  for (const length of words) {
    if (at > 0) {
      pieces.push(plainPiece(" "));
    }
    const group = spelled.slice(at, at + length);
    for (const [index, text] of markWord(group, apostrophe).entries()) {
      pieces.push({
        text,
        syllable: said[at + index],
        confidence: undefined,
        source: undefined,
      });
    }
    at += length;
  }
  return pieces;
}

/**
 * Write a number's syllables as the pieces they are written with.
 *
 * A counted number is *one word*, which is what 正词法 6.1.5 asks for: 123 is
 * `yībǎi'èrshísān` and not three words, so the syllables run together and take
 * the 隔音符号 where one is needed. A number read out digit by digit is not a
 * word at all — it is digits — so those are written apart: 1998年 is
 * `yī jiǔ jiǔ bā nián`.
 */
function numberPieces(
  said: readonly Syllable[],
  segment: NumeralSegment,
  written: Written,
): readonly ConvertedPiece[] {
  const spelled = said.map((syllable) =>
    writeSyllable(syllable, written.notation),
  );
  if (segment.style === "digits") {
    return read(
      spelled.flatMap((text, at) => [
        ...(at === 0 ? [] : [plainPiece(" ")]),
        { text, syllable: said[at], confidence: undefined, source: undefined },
      ]),
      segment.text,
    );
  }
  const isNumbered =
    written.notation === "numbers" || written.notation === "superscript";
  const apostrophe = isNumbered ? "never" : written.apostrophe;
  // A run that says where its words break gets them: a time is `liù diǎn
  // sānshí fēn` and a decimal is `qīshíwǔ diǎn wǔ`, each counted part a word
  // of its own and everything after the 点 a digit at a time.
  if (segment.words !== undefined) {
    return read(
      groupedPieces(spelled, said, segment.words, apostrophe),
      segment.text,
    );
  }
  return read(
    markWord(spelled, apostrophe).map((text, at) => ({
      text,
      syllable: said[at],
      confidence: undefined,
      source: undefined,
    })),
    segment.text,
  );
}

/**
 * Name what a read number is a reading of, once for the whole of it.
 *
 * A number is not read character by character the way a word is: 95% is
 * `bǎifēnzhījiǔshíwǔ` over eight syllables and three written characters, and
 * the order reverses on the way, so no syllable belongs to any one of them.
 * The written form is therefore named once, by the first piece that says
 * anything, and the rest read on into it.
 */
function read(
  pieces: readonly ConvertedPiece[],
  source: string,
): readonly ConvertedPiece[] {
  const first = pieces.findIndex((piece) => piece.syllable !== undefined);
  /* c8 ignore next 3 -- a read number has at least one syllable in it */
  if (first === -1) {
    return pieces;
  }
  return pieces.map((piece, at) =>
    at === first ? { ...piece, source } : piece,
  );
}

/**
 * A stand-in for the pinyin either side of a run, which ends in a letter.
 */
function runEdge(isHan: boolean): string {
  return isHan ? "a" : "";
}

/**
 * Write a stretch that was never Han, reading the numbers in it.
 *
 * Everything that is not a number goes through exactly as written, which is
 * what this always did: digits are the only part of a non-Han run this package
 * has anything to say about. Once a number *has* been read, though, the whole
 * stretch is being said rather than shown, so its parts take the spacing of
 * words — 3D打印 is `sān D dǎyìn` — and punctuation still takes none.
 */
function writeNumbers(
  text: string,
  segments: readonly NumeralSegment[],
  context: RunContext,
  written: Written,
  options: { readonly sandhi: SandhiOptions | undefined },
): readonly ConvertedPiece[] {
  if (segments.every((segment) => segment.reading === undefined)) {
    return [sourcePiece(text)];
  }

  const pieces: ConvertedPiece[] = [];
  let before = runEdge(context.isAfterHan);

  for (const segment of segments) {
    if (isSpaced(before, segment.text)) {
      pieces.push(plainPiece(" "));
    }
    pieces.push(
      ...(segment.reading === undefined
        ? [sourcePiece(segment.text)]
        : numberPieces(
            saidNumeral(segment, context.after.syllable, options.sandhi),
            segment,
            written,
          )),
    );
    // What decides the next space is what was *written*, not what was read:
    // 95% ends in a sign and `bǎifēnzhījiǔshíwǔ` ends in a letter.
    before = pieces.at(-1)?.text ?? before;
  }
  if (isSpaced(before, runEdge(context.after.character !== ""))) {
    pieces.push(plainPiece(" "));
  }
  return pieces;
}

/**
 * Run the pipeline over a text with a given decoder.
 */
function convertWith(
  decode: Decode,
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions,
): readonly ConvertedPiece[] {
  const {
    locale = "zh-CN",
    notation = "marks",
    apostrophe = "always",
    capitals = "auto",
    punctuation = "latin",
    grouping = true,
    numbers = "read",
    sandhi,
    readings,
  } = options;
  const written: Written = { notation, apostrophe, capitals };
  const converted: ConvertedPiece[] = [];

  const runs = [...splitRuns(text)];
  // Parsed once for the whole text rather than per run, so that a malformed
  // hint is reported whether or not a run happens to reach it.
  const hints = readings === undefined ? undefined : resolveHints(readings);
  // Where each run starts, in code points, so a caller counting positions from
  // the start of the text can be met where the run puts them.
  const starts: number[] = [];
  let start = 0;
  for (const run of runs) {
    starts.push(start);
    start += toCharacters(run.text).length;
  }
  // Read before anything is decoded, because a number needs to know what
  // follows it — 1998年 is a year and 3个 is a count — and the character that
  // decides it is there for the reading without a decode of its own.
  const read = runs.map((run, at) =>
    run.isHan || numbers === "keep"
      ? []
      : readNumbersIn(run.text, surroundingCharacters(runs, at)),
  );
  // Decoded before anything is written, because a number's sandhi needs the
  // syllable after it, and because a Han run needs the number in front of it:
  // 2个人 is `liǎng gè rén` and 个人 on its own is the word `gèrén`.
  const decoded = runs.map((run, at) => {
    if (!run.isHan) {
      return [];
    }
    const within =
      hints === undefined
        ? undefined
        : hintsWithin(hints, starts[at] ?? 0, toCharacters(run.text).length);
    const said = numeralBefore(read[at - 1] ?? []);
    return wordsOf(
      decode(dictionary, run.text, said, within),
      dictionary,
      grouping,
    );
  });

  for (const [at, run] of runs.entries()) {
    const words = decoded[at] ?? [];
    if (run.isHan) {
      converted.push(...writeRun(dictionary, words, locale, written, sandhi));
      continue;
    }
    converted.push(
      ...writeNumbers(
        run.text,
        read[at] ?? [],
        surrounding(runs, decoded, at),
        written,
        { sandhi },
      ),
    );
  }
  let pieces: readonly ConvertedPiece[] = converted;

  // Both of these read the whole conversion rather than one run: a sentence
  // capital belongs to whichever run happens to start the sentence, and a mark
  // needs to know whether anything follows it before it takes a space.
  if (capitals === "auto" && isSentence(text)) {
    pieces = rewrite(pieces, capitaliseSentenceParts);
  }
  return punctuation === "latin"
    ? rewrite(pieces, toLatinPunctuationParts)
    : pieces;
}

/**
 * Redistribute the decode's per-syllable confidence over regrouped words.
 *
 * 分词连写 moves word boundaries — 看 and 了 become 看了 — without touching a
 * reading, so the run's syllables are the same syllables in the same order and
 * are simply cut in different places.
 */
function regroup(
  decoded: readonly ScoredWord[],
  grouped: readonly DecodedWord[],
): readonly ScoredWord[] {
  const confidence = decoded.flatMap((scored) => [...scored.confidence]);
  let at = 0;
  return grouped.map((word) => {
    const held = confidence.slice(at, at + word.reading.length);
    at += word.reading.length;
    return { word, confidence: held };
  });
}

/**
 * Convert hanzi to pinyin with the lattice decoder.
 *
 * The recommended path. Builds every candidate reading of each Han run, locks
 * the positions that read the same way whichever candidates are chosen, and
 * scores only what is left — see {@link decodeRun} and ALGORITHM.md. GB/T 16159
 * orthography is then applied over the decoded words rather than over the
 * output string.
 */
export function convert(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  return joinPieces(convertWith(LATTICE, dictionary, text, options));
}

/**
 * Convert hanzi to pinyin, syllable by syllable, with confidence beside each.
 *
 * The same conversion {@link convert} performs and the same text once joined,
 * kept in pieces so that each syllable can be rendered on its own terms.
 * Everything the decode rejected is reported with it — see
 * {@link ReadingConfidence} — which is what an output format needs to show a
 * reader where it was guessing.
 *
 * Costs a second sweep of the lattice, which is why it is not what
 * {@link convert} runs.
 */
export function convertPieces(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(SCORED, dictionary, text, options);
}

/**
 * The same pieces, without asking the lattice what it rejected.
 *
 * Internal, and not in `src/index.ts`: it exists for `slug`, which needs the
 * syllables and the word boundaries but has nothing to say about confidence,
 * and would otherwise pay {@link convertPieces}'s second sweep on every title
 * it is handed. An output format that shows a reader anything about the decode
 * wants {@link convertPieces} instead.
 */
export function convertPiecesUnscored(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(LATTICE, dictionary, text, options);
}

/**
 * Join a conversion's pieces back into the text they spell.
 */
export function joinPieces(pieces: readonly ConvertedPiece[]): string {
  return pieces.map((piece) => piece.text).join("");
}

/**
 * Convert hanzi to pinyin with the greedy baseline decoder.
 *
 * **The baseline, kept to measure against.** See {@link decodeGreedily} for why
 * this is not the intended algorithm, and ALGORITHM.md for what replaces it.
 * Use {@link convert} instead.
 */
export function convertGreedily(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  return joinPieces(convertWith(GREEDY, dictionary, text, options));
}

/**
 * The same, kept in pieces.
 *
 * {@link convertPieces} for the baseline, so that a caller rendering each
 * syllable — colouring its tone — can still ask for the comparison. The pieces
 * carry no confidence, because the greedy decode cannot say what it rejected.
 */
export function convertPiecesGreedily(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(GREEDY, dictionary, text, options);
}
