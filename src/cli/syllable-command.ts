/**
 * The syllable subcommand: what a written syllable is made of.
 *
 * Asks nothing of the dictionary — the inventory and the parser between them
 * answer it — which is why it is the one inspect command that loads no data.
 */
import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import { splitSyllables } from "../syllable/split.js";
import {
  readSyllable,
  writeSyllable,
  writeSyllableSpelling,
} from "../syllable/syllable.js";
import type { Painter } from "./colour.js";
import { type Command, column } from "./command.js";

/**
 * One written syllable, taken apart.
 */
export function syllableTaken(
  spelling: string,
  paint: Painter,
): {
  readonly line: string;
  readonly data: unknown;
} {
  const syllable = readSyllable(spelling);
  /* c8 ignore next 6 -- splitSyllables only ever emits syllables that read */
  if (syllable === undefined) {
    return {
      line: `  ${column(spelling, 10)}not a syllable`,
      data: { spelling },
    };
  }

  const isAttested = DICTIONARY_SYLLABLES.has(
    writeSyllableSpelling({ ...syllable, erhua: false }),
  );
  const parts = [
    `${syllable.initial === "" ? "∅" : syllable.initial} + ${syllable.final}`,
    syllable.tone === undefined ? "no tone" : `tone ${String(syllable.tone)}`,
    ...(syllable.erhua === true ? ["儿化"] : []),
  ];
  const notations = {
    marks: writeSyllable(syllable),
    numbers: writeSyllable(syllable, "numbers"),
    superscript: writeSyllable(syllable, "superscript"),
  };

  return {
    line: `  ${column(paint(spelling, syllable.tone), 10)}${column(
      parts.join(", "),
      22,
    )}${column(
      Object.values(notations)
        .map((written) => paint(written, syllable.tone))
        .join("  "),
      22,
    )}${isAttested ? "" : "not attested"}`.trimEnd(),
    data: {
      spelling,
      initial: syllable.initial,
      final: syllable.final,
      ...(syllable.tone !== undefined && { tone: syllable.tone }),
      erhua: syllable.erhua === true,
      isAttested,
      ...notations,
    },
  };
}

/**
 * Take written pinyin apart, with no dictionary at all.
 */
export const SYLLABLE: Command = {
  name: "syllable",
  summary: "take written pinyin apart, with no dictionary",
  argument: "<pinyin...>",
  flags: [],
  needsDictionary: false,
  run: (input) =>
    input.texts.map((text) => {
      const split = splitSyllables(text);
      if (split === undefined) {
        return {
          lines: [`${text}  not readable as pinyin`],
          data: { text, read: false },
        };
      }
      const taken = split.map((spelling) =>
        syllableTaken(spelling, input.paint),
      );
      return {
        lines: [
          `${text}  ${split
            .map((spelling) =>
              input.paint(spelling, readSyllable(spelling)?.tone),
            )
            .join(" ")}`,
          ...taken.map((syllable) => syllable.line),
        ],
        data: {
          text,
          read: true,
          syllables: taken.map((syllable) => syllable.data),
        },
      };
    }),
};
