/**
 * The numbers in a text, said out loud.
 *
 * A digit is not Han and does not reach the decoder, so reading 1998年 as
 * `yī jiǔ jiǔ bā nián` means working out what the run around it says and
 * whether a space belongs between them. That is all this does.
 */
import { type NumeralSegment, saidNumeral } from "../numerals/text.js";
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import { surroundingCharacters, type TextRun } from "./runs.js";
import type { ScoredWord } from "./word.js";
import { type ApostropheStyle, markWord } from "../orthography/apostrophe.js";
import type { SandhiOptions } from "./sandhi.js";
import {
  type ConvertedPiece,
  plainPiece,
  sourcePiece,
  type Written,
} from "./pieces.js";

/**
 * What surrounds a non-Han run, as far as a number in it cares.
 */
export interface RunContext {
  readonly after: {
    readonly character: string;
    readonly syllable: Syllable | undefined;
  };
  /** Whether pinyin was written immediately before this run. */
  readonly isAfterHan: boolean;
}

/**
 * What surrounds a run once it has been decoded: the character after it, and
 * the syllable that character is read as.
 *
 * The syllable is the one part of a number's context that a decode has to
 * supply, and it is what a 一 ending the number assimilates to.
 */
export function surrounding(
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
export function numeralBefore(segments: readonly NumeralSegment[]): string {
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
export function writeNumbers(
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
