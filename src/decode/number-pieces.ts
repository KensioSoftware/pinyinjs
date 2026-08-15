/**
 * Turning one read number into pieces, spaced against what surrounds it.
 *
 * A digit run is said as words and the words are grouped, so the pieces carry
 * both the reading and where the words break — and whether a space belongs
 * between the number and the text beside it.
 */
import type { NumeralSegment } from "../numerals/read-numeral.js";
/**
 * The numbers in a text, said out loud.
 *
 * A digit is not Han and does not reach the decoder, so reading 1998年 as
 * `yī jiǔ jiǔ bā nián` means working out what the run around it says and
 * whether a space belongs between them. That is all this does.
 */
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import { type ApostropheStyle, markWord } from "../orthography/apostrophe.js";
import { type ConvertedPiece, plainPiece, type Written } from "./pieces.js";

/**
 * Whether a character wants a space between it and a number read out.
 *
 * A letter or a digit does; punctuation does not, so 20%。 keeps its full stop
 * against the number.
 */
export const WORDLIKE = /[\p{L}\p{N}]/u;

/**
 * Whether two stretches take a space between them once one has been read.
 */
export function isSpaced(before: string, after: string): boolean {
  return WORDLIKE.test(before.at(-1) ?? "") && WORDLIKE.test(after[0] ?? "");
}

/**
 * Write a run whose words are already known, a word at a time.
 *
 * Each group is one orthographic word and takes the 隔音符号 within itself, so
 * a time's minutes are `sānshí` rather than `sān shí` — the same grouping the
 * number would get if the text had written 6点30分 out in 汉字.
 */
export function groupedPieces(
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
export function numberPieces(
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
export function read(
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
export function runEdge(isHan: boolean): string {
  return isHan ? "a" : "";
}
