/**
 * What the checker compares: the reading this library produces for a text,
 * and the reading someone typed.
 *
 * Both sides are reduced to the same shape here — a syllable at a time, with
 * what was on offer beside it — so that `check.ts` only has to pair them up
 * and say where they differ.
 */
import { tokenisePinyin } from "../accuracy/tokenise.js";
import {
  type ConvertedPiece,
  type ConvertOptions,
  convertPieces,
  convertPiecesUnscored,
} from "../decode/convert.js";
import { READING_CHARGE } from "../decode/lattice.js";
import type { SandhiOptions } from "../decode/sandhi.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import {
  readSyllable,
  type Syllable,
  writeSyllableSpelling,
} from "../syllable/syllable.js";
import type { Tone } from "../tone/tone.js";

/**
 * What one syllable of a typed transcription turned out to be.
 *
 * `toneless` is deliberately separate from `tone`: {@link Syllable.tone} says
 * whether a tone was written at all, so "you left the tones off" is a different
 * thing to report than "you wrote the wrong one", and only the second is a
 * mistake about the language. {@link CheckOptions.tones} decides which of them
 * counts against the score.
 */

/**
 * A piece of a conversion that writes a syllable.
 */
export type ReadingPiece = ConvertedPiece & { readonly syllable: Syllable };

/**
 * What a conversion writes between one syllable and the one before it.
 *
 * `hyphen` is its own answer rather than a kind of break because it is one:
 * 干干净净 is `gāngān-jìngjìng`, a single orthographic word with a boundary
 * inside it, which is why {@link import("../syllable/split.js").splitSyllables}
 * reads a hyphen as a syllable boundary and not a word one.
 */
export type Junction = "join" | "hyphen" | "break";

/**
 * One syllable of a conversion, with where it is and what precedes it.
 */
export interface ReadingSyllable {
  readonly piece: ReadingPiece;
  readonly at: number;
  readonly junction: Junction;
}

/**
 * An expected syllable, with everything a typed one is allowed to be.
 */
export interface ExpectedSyllable {
  readonly syllable: Syllable;
  /**
   * Which tones each acceptable spelling may carry.
   *
   * Keyed by the toneless spelling, because the two questions a verdict asks
   * are separate: an unknown spelling is the wrong syllable, and a known
   * spelling with an unlisted tone is the right syllable in the wrong tone.
   */
  readonly accepted: ReadonlyMap<string, ReadonlySet<Tone | undefined>>;
  /** Whether a word may begin here. */
  readonly acceptsBreak: boolean;
  /** Whether this may be written on to the syllable before it. */
  readonly acceptsJoin: boolean;
  readonly source: string | undefined;
  readonly at: number;
}

/**
 * One syllable of what was typed.
 */
export interface TypedSyllable {
  readonly text: string;
  readonly syllable: Syllable | undefined;
  /** The toneless spelling this is aligned and compared by. */
  readonly base: string;
  /** The tone written on it, or undefined where none was. */
  readonly tone: Tone | undefined;
  /** Whether a written word begins here. */
  readonly startsWord: boolean;
}

/**
 * The other corner of the sandhi square.
 *
 * A learner may write the underlying tones or the tones actually said, and both
 * are right — 你好 is written `nǐ hǎo` and said `ní hǎo`. Rather than convert
 * four times for the four combinations of {@link SandhiOptions}, this converts
 * twice and inverts both switches at once, which reaches every tone: 一 and 不
 * sandhi applies to syllables in the first and fourth tones, third-tone sandhi
 * only to syllables in the third, so the two passes never touch the same
 * syllable and each one's two forms both appear across the two corners.
 */
export function oppositeSandhi(
  sandhi: SandhiOptions | undefined,
): SandhiOptions {
  return {
    yiBu: !(sandhi?.yiBu ?? true),
    thirdTone: !(sandhi?.thirdTone ?? false),
  };
}

/**
 * Where each piece's source characters start, in code points.
 *
 * Read off the sources rather than tracked through the conversion, which works
 * because every character of the text is named by exactly one piece — a piece
 * naming none is either pinyin orthography the source has no trace of, such as
 * the space between two words, or a syllable reading on into the characters the
 * piece before it named.
 */
export function sourcePositions(
  pieces: readonly ConvertedPiece[],
): readonly number[] {
  const positions: number[] = [];
  let at = 0;
  for (const piece of pieces) {
    positions.push(at);
    at += toCharacters(piece.source ?? "").length;
  }
  return positions;
}

/**
 * What a piece written between two syllables makes of the join.
 *
 * Only a hyphen written where the syllables would otherwise have run together
 * is 分词连写's internal boundary; anything else — a space, punctuation, a
 * stretch that was never Han — separates two words.
 */
export function junctionOver(text: string, held: Junction): Junction {
  return text === "-" && held === "join" ? "hyphen" : "break";
}

/**
 * The syllables a conversion writes, with their positions and what joins them.
 *
 * A conversion writes its syllables as adjacent pieces within a word — the
 * 隔音符号 is part of a syllable's own spelling rather than a piece of its own —
 * so anything standing between two of them is a boundary, and the hyphen of
 * 分词连写 is the one that is not a word boundary.
 */
export function readingSyllables(
  pieces: readonly ConvertedPiece[],
): readonly ReadingSyllable[] {
  const positions = sourcePositions(pieces);
  const syllables: ReadingSyllable[] = [];
  // The first syllable of a text begins a word, whatever comes before it.
  let junction: Junction = "break";

  for (const [at, piece] of pieces.entries()) {
    if (piece.syllable === undefined) {
      junction = junctionOver(piece.text, junction);
      continue;
    }
    syllables.push({
      piece: { ...piece, syllable: piece.syllable },
      /* c8 ignore next -- one position is recorded for each piece there is */
      at: positions[at] ?? 0,
      junction,
    });
    junction = "join";
  }
  return syllables;
}

/**
 * The readings the decode turned down without much reason to.
 *
 * The decode charges {@link READING_CHARGE} for a word boundary, so a rejected
 * reading costing less than that was available without breaking any dictionary
 * word apart — see {@link import("../decode/confidence.js").isUncertain}, which
 * is the same threshold read as a question rather than as a filter. The library
 * knows it was guessing there, so a learner who guessed the other way is not
 * wrong.
 *
 * Only a rejected reading of exactly the one character this syllable reads is
 * taken. An alternative can cover a different stretch — 玩儿 read as `wánr`
 * competes with 玩 `wán` and 儿 `ér` — and a claim about other characters says
 * nothing about what belongs in this position.
 */
export function rejectedReadings(piece: ReadingPiece): readonly Syllable[] {
  const { confidence, source } = piece;
  if (source === undefined || toCharacters(source).length !== 1) {
    return [];
  }
  return (confidence?.alternatives ?? []).flatMap((alternative) => {
    const [syllable] = alternative.reading;
    return alternative.cost < READING_CHARGE &&
      alternative.to - alternative.from === 1 &&
      alternative.reading.length === 1 &&
      syllable !== undefined
      ? [syllable]
      : [];
  });
}

/**
 * Gather readings into the spellings and tones they allow.
 *
 * The tone is allowed to be undefined only because {@link Syllable.tone} is: a
 * reading that came out of the dictionary always carries one.
 */
export function acceptedReadings(
  readings: readonly Syllable[],
): ReadonlyMap<string, ReadonlySet<Tone | undefined>> {
  const accepted = new Map<string, Set<Tone | undefined>>();

  for (const syllable of readings) {
    const base = writeSyllableSpelling(syllable);
    const tones = accepted.get(base) ?? new Set<Tone | undefined>();
    tones.add(syllable.tone);
    accepted.set(base, tones);
  }
  return accepted;
}

/**
 * Read the text, and work out what a typed syllable is allowed to be.
 *
 * Three conversions of the same text, and each one answers a different question.
 * The first is the answer itself, with the confidence report beside it. The
 * second is the other corner of the sandhi square, which is where the second
 * form of every tone comes from. The third is the same text written under the
 * other spacing convention, which is where a boundary's tolerance comes from:
 * 分词连写 is what puts 了 on its verb and separates 市 from 南京, and a learner
 * who wrote the words the dictionary knows instead — `tā kàn le`, `Nánjīngshì`
 * — has written one of the two conventions this package implements rather than
 * made a mistake.
 *
 * All three decode identically. Sandhi rewrites tones and 分词连写 moves
 * boundaries; neither touches the syllables underneath, so all three line up one
 * for one.
 */
export function expectedReading(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions,
): readonly ExpectedSyllable[] {
  const written = readingSyllables(convertPieces(dictionary, text, options));
  const said = readingSyllables(
    convertPiecesUnscored(dictionary, text, {
      ...options,
      sandhi: oppositeSandhi(options.sandhi),
    }),
  );
  const spaced = readingSyllables(
    convertPiecesUnscored(dictionary, text, {
      ...options,
      grouping: !(options.grouping ?? true),
    }),
  );

  return written.map(({ piece, at, junction }, index) => {
    // Sliced rather than indexed, so that a conversion somehow reporting fewer
    // syllables than the others contributes nothing rather than needing a
    // fallback: the caller's own conversion decides alone.
    const alternate = said
      .slice(index, index + 1)
      .map((one) => one.piece.syllable);
    const other = spaced.slice(index, index + 1).map((one) => one.junction);
    return {
      syllable: piece.syllable,
      accepted: acceptedReadings([
        piece.syllable,
        ...alternate,
        ...rejectedReadings(piece),
      ]),
      // A hyphen is neither a break nor a join, and so allows both: it is a
      // boundary the standard writes inside a word, and a learner rendering it
      // as a space has not invented one.
      acceptsBreak: junction !== "join" || other.some((one) => one !== "join"),
      acceptsJoin: junction !== "break" || other.some((one) => one !== "break"),
      source: piece.source,
      at,
    };
  });
}

/**
 * Read what was typed, one syllable at a time.
 *
 * {@link tokenisePinyin} is what the decoder is scored with, and it is tolerant
 * in the two ways that matter here: word spacing is discarded, and the
 * apostrophes and hyphens inside a word are read as the syllable boundaries
 * they are and dropped. Both are orthography rather than pronunciation.
 *
 * A stretch that is not pinyin at all comes back whole, and is reported as
 * written rather than thrown away.
 */
export function typedReading(typed: string): readonly TypedSyllable[] {
  const { syllables, wordStarts } = tokenisePinyin(typed);
  return syllables.map((text, at) => {
    const syllable = readSyllable(text);
    return {
      text,
      syllable,
      base:
        syllable === undefined
          ? text.toLowerCase().normalize("NFC")
          : writeSyllableSpelling(syllable),
      tone: syllable?.tone,
      startsWord: wordStarts.has(at),
    };
  });
}
