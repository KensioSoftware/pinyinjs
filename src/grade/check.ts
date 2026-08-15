import type { ConvertOptions } from "../decode/convert.js";
import { pairSyllables, spacingFor, verdictFor } from "./pair-syllables.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { type Syllable, writeSyllableSpelling } from "../syllable/syllable.js";
import { type ExpectedSyllable, expectedReading } from "./check-readings.js";
import { type TypedSyllable, typedReading } from "./typed-reading.js";

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
   * exactly as {@link import("../decode/convert.js").ConvertedPiece.source}
   * is, and where nothing was expected at all.
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
 *   {@link import("./reading-tolerance.js").rejectedReadings}. 银行 is not one of those: the word settles both
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
