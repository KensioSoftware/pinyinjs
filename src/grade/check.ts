import { alignSequences } from "../accuracy/align.js";
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
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";

/**
 * What one syllable of a typed transcription turned out to be.
 *
 * `toneless` is deliberately separate from `tone`: {@link Syllable.tone} says
 * whether a tone was written at all, so "you left the tones off" is a different
 * thing to report than "you wrote the wrong one", and only the second is a
 * mistake about the language. {@link CheckOptions.tones} decides which of them
 * counts against the score.
 */
export type PinyinVerdict =
  | "correct"
  | "toneless"
  | "tone"
  | "wrong"
  | "missing"
  | "extra";

/**
 * Where a typed syllable falls against the word boundaries the reading has.
 *
 * `split` is a word written as two — `yín háng` for 银行 — and `joined` is two
 * words run into one. Both are reported whatever {@link CheckOptions.spacing}
 * says, so an application can show them without having to grade them.
 */
export type SpacingVerdict = "correct" | "split" | "joined";

/**
 * Whether one dimension of the writing has to be right for a perfect score.
 *
 * `optional` still reports the verdict and counts the syllable correct anyway;
 * `required` counts it wrong. Both dimensions this applies to — tones and word
 * spacing — are things an exercise may or may not be teaching yet.
 */
export type CheckRequirement = "optional" | "required";

/**
 * How a transcription should be checked.
 *
 * Every {@link ConvertOptions} field is accepted and passed to the conversion
 * the answer is read from, which is what `readings` is worth having here for:
 * an exercise knows which sense of 长 its own sentence uses, where the decoder
 * can only weigh the evidence.
 */
export interface CheckOptions extends ConvertOptions {
  /** Whether a tone has to be written. Defaults to `optional`. */
  readonly tones?: CheckRequirement;
  /**
   * Whether the word spacing has to be right. Defaults to `optional`.
   *
   * Off by default because the 分词连写 this grades against is not a complete
   * 正词法 implementation — see [orthography](../../docs/orthography/) for
   * where it stops — so a learner can write a word the standard writes
   * differently from the way this does. On for an exercise teaching the
   * spacing, where getting it right is the point.
   */
  readonly spacing?: CheckRequirement;
}

/**
 * One syllable of the check: what was expected there, and what was typed.
 */
export interface CheckedSyllable {
  readonly verdict: PinyinVerdict;
  /**
   * Where this syllable falls against the word boundaries, where both a reading
   * and a typed syllable met here.
   *
   * A separate axis from {@link CheckedSyllable.verdict}, because it is a
   * separate mistake: `yín háng` reads 银行 perfectly and writes it as two
   * words. Undefined for a syllable that was only expected or only typed.
   */
  readonly spacing: SpacingVerdict | undefined;
  /** Whether this counts as right in {@link PinyinCheck.score}. */
  readonly isCorrect: boolean;
  /** The reading expected here, or undefined where nothing was expected. */
  readonly expected: Syllable | undefined;
  /**
   * What was typed here, parsed, or undefined where nothing was typed.
   *
   * Also undefined for something typed that is not a syllable at all, which
   * {@link CheckedSyllable.text} still reports as written.
   */
  readonly actual: Syllable | undefined;
  /** What was typed here, exactly as written, or empty where nothing was. */
  readonly text: string;
  /**
   * The characters the expected syllable reads.
   *
   * Undefined where a syllable reads on into the characters named before it,
   * exactly as {@link ConvertedPiece.source} is, and where nothing was
   * expected at all.
   */
  readonly source: string | undefined;
  /**
   * Where those characters start, in code points from the start of the text.
   *
   * What highlighting the mistake in the text itself needs, and counted the way
   * {@link import("../decode/segment.js").Segment.at} counts.
   */
  readonly at: number | undefined;
}

/**
 * A typed transcription marked against the text it was written for.
 */
export interface PinyinCheck {
  /** One entry per syllable expected or typed, in order. */
  readonly syllables: readonly CheckedSyllable[];
  /** Whether every syllable counted as correct. */
  readonly isCorrect: boolean;
  /**
   * The share of the syllables that counted as correct, from 0 to 1.
   *
   * Over the entries reported rather than over the expected reading, so that
   * inventing a syllable costs as much as dropping one: an answer with an extra
   * syllable in it has more entries than the reading has syllables.
   */
  readonly score: number;
  /** The reading that was expected, as the conversion writes it. */
  readonly reading: readonly Syllable[];
}

/**
 * A piece of a conversion that writes a syllable.
 */
type ReadingPiece = ConvertedPiece & { readonly syllable: Syllable };

/**
 * What a conversion writes between one syllable and the one before it.
 *
 * `hyphen` is its own answer rather than a kind of break because it is one:
 * 干干净净 is `gāngān-jìngjìng`, a single orthographic word with a boundary
 * inside it, which is why {@link import("../syllable/split.js").splitSyllables}
 * reads a hyphen as a syllable boundary and not a word one.
 */
type Junction = "join" | "hyphen" | "break";

/**
 * One syllable of a conversion, with where it is and what precedes it.
 */
interface ReadingSyllable {
  readonly piece: ReadingPiece;
  readonly at: number;
  readonly junction: Junction;
}

/**
 * An expected syllable, with everything a typed one is allowed to be.
 */
interface ExpectedSyllable {
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
interface TypedSyllable {
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
 * Which expected syllable a typed one was matched with, where either has one.
 */
interface Pairing {
  readonly expected: number | undefined;
  readonly actual: number | undefined;
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
function oppositeSandhi(sandhi: SandhiOptions | undefined): SandhiOptions {
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
function sourcePositions(pieces: readonly ConvertedPiece[]): readonly number[] {
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
function junctionOver(text: string, held: Junction): Junction {
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
function readingSyllables(
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
function rejectedReadings(piece: ReadingPiece): readonly Syllable[] {
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
function acceptedReadings(
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
function expectedReading(
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
function typedReading(typed: string): readonly TypedSyllable[] {
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

/**
 * Match the expected syllables up with the typed ones.
 *
 * Aligned on the toneless spellings, for the reason
 * {@link import("../accuracy/score.js").scoreCase} aligns on them: a syllable
 * dropped or invented halfway through would otherwise knock everything after it
 * out of step, and be reported as a mistake on every syllable rather than on
 * the one.
 *
 * What the alignment leaves over is then paired off within each gap, which is
 * what turns two unrelated stretches into substitutions: 银行 typed `yínxíng`
 * anchors on `yín`, leaving one expected `háng` against one typed `xíng` — one
 * wrong syllable rather than one missing and one invented.
 */
function pairSyllables(
  expected: readonly string[],
  actual: readonly string[],
): readonly Pairing[] {
  const pairs: Pairing[] = [];
  let held = 0;
  let typed = 0;

  const gap = (untilExpected: number, untilActual: number): void => {
    while (held < untilExpected || typed < untilActual) {
      const takesExpected = held < untilExpected;
      const takesActual = typed < untilActual;
      pairs.push({
        expected: takesExpected ? held : undefined,
        actual: takesActual ? typed : undefined,
      });
      held += takesExpected ? 1 : 0;
      typed += takesActual ? 1 : 0;
    }
  };

  for (const anchor of alignSequences(expected, actual)) {
    gap(anchor.expected, anchor.actual);
    pairs.push({ expected: held, actual: typed });
    held++;
    typed++;
  }
  gap(expected.length, actual.length);

  return pairs;
}

/**
 * What a typed syllable is, against what was expected in its place.
 *
 * The neutral tone is the one tone pinyin writes with no mark at all, so a
 * syllable expected in it and typed without one has had its tone written
 * correctly rather than left off.
 */
function verdictFor(
  expected: ExpectedSyllable,
  actual: TypedSyllable,
): PinyinVerdict {
  const tones = expected.accepted.get(actual.base);
  if (tones === undefined) {
    return "wrong";
  }
  if (actual.tone === undefined) {
    return tones.has(NEUTRAL_TONE) ? "correct" : "toneless";
  }
  return tones.has(actual.tone) ? "correct" : "tone";
}

/**
 * Where a typed syllable falls against the word boundaries.
 */
function spacingFor(
  expected: ExpectedSyllable,
  actual: TypedSyllable,
): SpacingVerdict {
  if (actual.startsWord) {
    return expected.acceptsBreak ? "correct" : "split";
  }
  return expected.acceptsJoin ? "correct" : "joined";
}

/**
 * What is required of a check beyond reading the syllables right.
 */
interface Required {
  readonly tones: CheckRequirement;
  readonly spacing: CheckRequirement;
}

/**
 * Mark one pairing.
 *
 * The two axes are graded separately and reported separately, and a syllable
 * only counts as right where both of them are: `yín háng` reads 银行 perfectly
 * and writes it as two words, which is one mistake rather than none.
 */
function checkPair(
  expected: ExpectedSyllable | undefined,
  actual: TypedSyllable | undefined,
  required: Required,
): CheckedSyllable {
  const verdict =
    expected === undefined
      ? "extra"
      : actual === undefined
        ? "missing"
        : verdictFor(expected, actual);
  const spacing =
    expected === undefined || actual === undefined
      ? undefined
      : spacingFor(expected, actual);

  const readRight =
    verdict === "correct" ||
    (verdict === "toneless" && required.tones === "optional");
  const spacedRight =
    spacing !== "split" && spacing !== "joined"
      ? true
      : required.spacing === "optional";

  return {
    verdict,
    spacing,
    isCorrect: readRight && spacedRight,
    expected: expected?.syllable,
    actual: actual?.syllable,
    text: actual?.text ?? "",
    source: expected?.source,
    at: expected?.at,
  };
}

/**
 * Mark a typed pinyin transcription against the text it was written for.
 *
 * ```ts
 * check(dictionary, "北京", "bei3jing3").syllables.map((one) => one.verdict);
 * // ["correct", "tone"]
 * ```
 *
 * **The point of doing this with a dictionary is being fair in the ways a
 * string comparison cannot be**, and every one of these is a learner being
 * marked wrong for being right:
 *
 * - **Either notation, mixed freely.** `běi` and `bei3` are the same syllable
 *   and both parse, so `bei3jīng` is not a spelling mistake.
 * - **A reading the decoder itself was unsure of.** Where another reading of
 *   the same character was there for the taking, it is accepted — see
 *   {@link rejectedReadings}. 银行 is not one of those: the word settles both
 *   syllables, so `yínxíng` really is wrong.
 * - **Sandhi either way.** 你好 is written `nǐ hǎo` and said `ní hǎo`, and 不是
 *   is `bú shì` written and `bù shì` underneath. Both pass.
 * - **Tones written or not.** A syllable typed with no tone is `toneless`
 *   rather than `tone`, and {@link CheckOptions.tones} says whether that counts
 *   against the score. A neutral tone typed without a mark is simply correct,
 *   because that is how pinyin writes it.
 * - **Apostrophes.** Not a word boundary and not a sound: `nǐhǎo`, `nǐ hǎo` and
 *   `nǐ'hǎo` all read the same, and check the same.
 *
 * Word spacing is graded on its own axis, reported as
 * {@link CheckedSyllable.spacing} and counted only where
 * {@link CheckOptions.spacing} asks for it — and tolerant in the same spirit,
 * since 分词连写 and the words the dictionary knows are two conventions this
 * package writes and a learner may have been taught either.
 *
 * What comes back is one {@link CheckedSyllable} per syllable expected or
 * typed, in order, each naming the characters it reads and where they are, so
 * that a mistake can be shown against the text rather than against the answer.
 *
 * This is {@link import("../accuracy/score.js").scoreCase} — the scorer that
 * marks the decoder against the gold corpus — pointed at a person instead, and
 * it costs three conversions of the text.
 */
export function check(
  dictionary: Dictionary,
  text: string,
  typed: string,
  options: CheckOptions = {},
): PinyinCheck {
  const { tones = "optional", spacing = "optional", ...converting } = options;
  const expected = expectedReading(dictionary, text, converting);
  const actual = typedReading(typed);

  const syllables = pairSyllables(
    expected.map((one) => writeSyllableSpelling(one.syllable)),
    actual.map((one) => one.base),
  ).map((pair) =>
    checkPair(
      pair.expected === undefined ? undefined : expected[pair.expected],
      pair.actual === undefined ? undefined : actual[pair.actual],
      { tones, spacing },
    ),
  );
  const correct = syllables.filter((one) => one.isCorrect).length;

  return {
    syllables,
    isCorrect: correct === syllables.length,
    score: syllables.length === 0 ? 1 : correct / syllables.length,
    reading: expected.map((one) => one.syllable),
  };
}
