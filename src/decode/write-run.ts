/**
 * Writing one decoded Han run out as pieces.
 *
 * Sandhi runs across the whole run rather than within a word, and 分词连写
 * rewrites the word boundaries without touching the readings, so both happen
 * here rather than per word.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { applyGrouping } from "../orthography/grouping.js";
import { toCharacters } from "../script/characters.js";
import type { Locale } from "../script/script.js";
import { divisionOf } from "./constituents.js";
import { applySandhi, type SandhiOptions } from "./sandhi.js";
import type { DecodedWord, ScoredWord } from "./word.js";
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
  // One 汉字 per syllable where a word offers that, so 一 sandhi can ask what
  // stands in front of the 一 rather than guessing from a toneless spelling. A
  // word whose reading is a different length from its text — 玩儿 as `wánr` —
  // has no character to give any one of its syllables.
  const characters = words.flatMap(
    (scored, index): readonly (string | undefined)[] => {
      const reading = readings[index] ?? [];
      const held = toCharacters(scored.word.text);
      return held.length === reading.length
        ? held
        : Array.from<string | undefined>({ length: reading.length });
    },
  );
  const flattened = applySandhi(readings.flat(), sandhi, grouping, characters);

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

/**
 * The words a Han run decodes to, with 分词连写 applied.
 *
 * Grouping rewrites word boundaries and never the readings behind them, so the
 * syllables — and the confidence beside them — survive it in order.
 */
export function wordsOf(
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
