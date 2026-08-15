import type { Syllable } from "../syllable/syllable.js";
import { isSpaced, numberPieces, runEdge } from "./number-pieces.js";
/**
 * The numbers in a text, said out loud.
 *
 * A digit is not Han and does not reach the decoder, so reading 1998年 as
 * `yī jiǔ jiǔ bā nián` means working out what the run around it says and
 * whether a space belongs between them. That is all this does.
 */
import { type NumeralSegment, saidNumeral } from "../numerals/text.js";
import { surroundingCharacters, type TextRun } from "./runs.js";
import type { ScoredWord } from "./word.js";
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
