/**
 * Marking typed pinyin against the text it was written for.
 */
import { convertPieces } from "../decode/convert.js";
import { check, type CheckedSyllable } from "../grade/check.js";
import { writeSyllable } from "../syllable/syllable.js";
import {
  CHECK_FLAGS,
  checkOptions,
  CONVERT_FLAGS,
  UsageError,
} from "./arguments.js";
import {
  type Command,
  type CommandInput,
  column,
  dictionaryOf,
  paintedPieces,
} from "./command.js";

/**
 * The hanzi and the pinyin typed for it, as `check` is given them.
 *
 * Two arguments at a terminal — `pinyinjs check 银行 yínxíng` — with everything
 * after the first joined back up, so that unquoted pinyin with spaces in it
 * works the way anybody would expect it to. A piped file is one pair per line,
 * separated by a tab, since pinyin has spaces in it and the hanzi may too.
 */
function checkPairs(
  texts: readonly string[],
): readonly (readonly [string, string])[] {
  if (texts.some((text) => text.includes("\t"))) {
    return texts.map((text) => {
      const [hanzi = "", ...rest] = text.split("\t");
      return [hanzi, rest.join("\t")] as const;
    });
  }
  const [hanzi = "", ...rest] = texts;
  return [[hanzi, rest.join(" ")] as const];
}

/**
 * One checked syllable, as a line and as data.
 *
 * The characters, then what was expected, then what was typed, then the two
 * verdicts. Spacing is written only where it went wrong, since `correct` on
 * every line would bury the one that did not.
 */
function checkedSyllable(
  one: CheckedSyllable,
  input: CommandInput,
): { readonly line: string; readonly data: unknown } {
  const expected =
    one.expected === undefined ? "" : writeSyllable(one.expected);
  // Written only where it went wrong: `correct` on every line would bury the
  // one that did not.
  const spacing = one.spacing === "correct" ? undefined : one.spacing;

  return {
    line: `  ${column(one.source ?? "", 6)}${column(
      input.paint(expected, one.expected?.tone),
      8,
    )}${column(one.text, 8)}${column(one.verdict, 10)}${spacing ?? ""}`.trimEnd(),
    data: {
      verdict: one.verdict,
      isCorrect: one.isCorrect,
      ...(one.spacing !== undefined && { spacing: one.spacing }),
      ...(expected !== "" && { expected }),
      ...(one.text !== "" && { typed: one.text }),
      ...(one.source !== undefined && { source: one.source }),
      ...(one.at !== undefined && { at: one.at }),
    },
  };
}

/**
 * Mark typed pinyin against the text it was written for.
 *
 * The heading carries the answer the text converts to, because a check that
 * says only what is wrong leaves a reader hunting for what was right.
 */
export const CHECK: Command = {
  name: "check",
  summary: "mark typed pinyin against the text",
  argument: "<text> <pinyin>",
  flags: [...CONVERT_FLAGS, ...CHECK_FLAGS],
  needsDictionary: true,
  run: (input) => {
    const dictionary = dictionaryOf(input);
    const options = checkOptions(input.flags);

    return checkPairs(input.texts).map(([text, typed]) => {
      if (typed === "") {
        throw new UsageError("check needs a text and the pinyin typed for it");
      }
      const marked = check(dictionary, text, typed, options);
      const score = Math.round(marked.score * 100);
      const syllables = marked.syllables.map((one) =>
        checkedSyllable(one, input),
      );
      // The answer as the conversion writes it, spacing and all, since the
      // spacing is one of the things being marked and a reading joined by
      // spaces would show every word broken apart.
      const pieces = convertPieces(dictionary, text, options);

      return {
        lines: [
          `${text}  ${paintedPieces(pieces, input)}  ${String(score)}%`,
          ...syllables.map((one) => one.line),
        ],
        data: {
          text,
          typed,
          isCorrect: marked.isCorrect,
          score: marked.score,
          pinyin: pieces.map((piece) => piece.text).join(""),
          syllables: syllables.map((one) => one.data),
        },
      };
    });
  },
};
