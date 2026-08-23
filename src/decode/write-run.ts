/**
 * Writing one decoded Han run out as pieces.
 *
 * Sandhi runs across the whole run rather than within a word, and 分词连写
 * rewrites the word boundaries without touching the readings, so both happen
 * here rather than per word.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import type { Locale } from "../script/script.js";
import { charactersPerSyllable, groupingOf } from "./sandhi-input.js";
import { applySandhi, type SandhiOptions } from "./sandhi.js";
import type { ScoredWord } from "./word.js";
import {
  type ConvertedPiece,
  plainPiece,
  readingFor,
  writeWord,
  type Written,
} from "./pieces.js";

/**
 * Write one Han run's worth of decoded words.
 */
export function writeRun(
  dictionary: Dictionary,
  words: readonly ScoredWord[],
  locale: Locale,
  written: Written,
  sandhi: SandhiOptions | undefined,
): readonly ConvertedPiece[] {
  // Sandhi runs across the whole run rather than within a word, since 不 in one
  // word assimilates to the tone starting the next, and what it needs beyond
  // the syllables is in `sandhi-input.ts`.
  const readings = words.map((scored) =>
    readingFor(dictionary, scored.word, locale),
  );
  const flattened = applySandhi(
    readings.flat(),
    sandhi,
    groupingOf(dictionary, words, readings, sandhi?.thirdTone === true),
    charactersPerSyllable(words, readings),
  );

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
export function rewrite(
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
