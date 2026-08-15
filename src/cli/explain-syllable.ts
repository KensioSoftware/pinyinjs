/**
 * How one decoded syllable is reported by `explain`.
 *
 * Three questions about a single piece — how settled it was, what it beat, and
 * how to write both — kept apart from the command so that the command is only
 * the sweep over a text and the shape of its output.
 */
import { isUncertain } from "../decode/confidence.js";
import type { ConvertedPiece } from "../decode/convert.js";
import { writeSyllable } from "../syllable/syllable.js";
import { convertOptions } from "./arguments.js";
import { column, type CommandInput } from "./command.js";

/**
 * How settled a decoded syllable was, in one word.
 *
 * `locked` means no other reading was on offer, `word` that taking one would
 * have meant breaking a dictionary word apart, and `guess` that another reading
 * of the same characters was there for the taking. See ROADMAP.md for how often
 * each turns out to be wrong.
 */
function stateOf(piece: ConvertedPiece): string {
  const { confidence } = piece;
  if (confidence === undefined || confidence.isLocked) {
    return "locked";
  }
  return isUncertain(confidence) ? "guess" : "word";
}

/**
 * What a decode rejected at one syllable, and what rejecting it saved.
 */
function alternativesOf(
  piece: ConvertedPiece,
  input: CommandInput,
): readonly {
  readonly reading: string;
  readonly painted: string;
  readonly cost: number;
}[] {
  const { notation } = convertOptions(input.flags);
  return (piece.confidence?.alternatives ?? []).map((alternative) => {
    const spelled = alternative.reading.map((syllable) =>
      writeSyllable(syllable, notation),
    );
    return {
      reading: spelled.join(""),
      painted: spelled
        .map((text, at) => input.paint(text, alternative.reading[at]?.tone))
        .join(""),
      // Rounded because a cost is a sum of frequency buckets and a per-word
      // charge of 4.62, which lands on 24.620000000000005 often enough to be
      // worth not putting in front of anybody.
      cost: Math.round(alternative.cost * 100) / 100,
    };
  });
}

/**
 * One decoded syllable, as `explain` reports it.
 */
export function explainSyllable(
  piece: ConvertedPiece,
  input: CommandInput,
): { readonly line: string; readonly data: unknown } {
  const state = stateOf(piece);
  const alternatives = alternativesOf(piece, input);
  const beaten = alternatives
    .map(
      (alternative) => `${alternative.painted} +${alternative.cost.toFixed(1)}`,
    )
    .join("  ");

  return {
    // The state stays a word. Colour means tone in every command, including
    // this one: two scales on one line and a reader cannot tell which is which.
    line: `  ${column(
      input.paint(piece.text, piece.syllable?.tone),
      8,
    )}${column(state, 8)}${beaten}`.trimEnd(),
    data: {
      text: piece.text,
      state,
      ...(piece.syllable?.tone !== undefined && { tone: piece.syllable.tone }),
      alternatives: alternatives.map(({ reading, cost }) => ({
        reading,
        cost,
      })),
    },
  };
}
