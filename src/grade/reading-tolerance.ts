/**
 * Everything a typed syllable is allowed to be, beside the one answer.
 *
 * The checker's whole difficulty is here: the library writes one reading, and
 * several others are not mistakes. A tone the sandhi square reaches the other
 * way round, a reading the decode turned down without much reason to — each is
 * a separate source of tolerance, and each is gathered here so that
 * `check-readings.ts` can simply put them together.
 */
import {
  type ConvertOptions,
  convertPieces,
  convertPiecesUnscored,
} from "../decode/convert.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { READING_CHARGE } from "../decode/lattice.js";
import type { SandhiOptions } from "../decode/sandhi.js";
import { toCharacters } from "../script/characters.js";
import { type Syllable, writeSyllableSpelling } from "../syllable/syllable.js";
import type { Tone } from "../tone/tone.js";
import {
  type ReadingPiece,
  type ReadingSyllable,
  readingSyllables,
} from "./reading-syllables.js";

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
 * The same text converted three ways, one for each source of tolerance.
 *
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
export function readingsThreeWays(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions,
): {
  readonly written: readonly ReadingSyllable[];
  readonly said: readonly ReadingSyllable[];
  readonly spaced: readonly ReadingSyllable[];
} {
  return {
    written: readingSyllables(convertPieces(dictionary, text, options)),
    said: readingSyllables(
      convertPiecesUnscored(dictionary, text, {
        ...options,
        sandhi: oppositeSandhi(options.sandhi),
      }),
    ),
    spaced: readingSyllables(
      convertPiecesUnscored(dictionary, text, {
        ...options,
        grouping: !(options.grouping ?? true),
      }),
    ),
  };
}
