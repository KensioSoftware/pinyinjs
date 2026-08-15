/**
 * The subcommands that search the dictionary and grade a reading.
 *
 * `match` finds where a query occurs in a text and `check` says whether a
 * reading someone else produced agrees with this one. Both are about holding
 * a text up against something rather than converting it.
 */
import { convertPieces } from "../decode/convert.js";
import { check, type CheckedSyllable } from "../grade/check.js";
import { match, type MatchRange } from "../search/match.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import {
  CHECK_FLAGS,
  checkOptions,
  CONVERT_FLAGS,
  MATCH_FLAGS,
  matchQuery,
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
 * A text with the matched stretches marked, for a terminal.
 *
 * Brackets rather than colour, because the output is as likely to be piped as
 * read: a match is a position, and a position survives being redirected into a
 * file where an escape sequence would only clutter it.
 */
function marked(text: string, ranges: readonly MatchRange[]): string {
  const characters = toCharacters(text);
  const opens = new Set(ranges.map((range) => range.at));
  const closes = new Set(ranges.map((range) => range.at + range.length - 1));
  return characters
    .map(
      (character, at) =>
        `${opens.has(at) ? "[" : ""}${character}${closes.has(at) ? "]" : ""}`,
    )
    .join("");
}

/**
 * Filter texts by a pinyin query, best match first.
 *
 * Ranked rather than left in the order given, because ranking is what the
 * scores are for and a filter nobody can see the order of is a filter that
 * looks arbitrary. Every text still gets a line, matched or not, so that a run
 * over a file says what it did with each of them.
 */
export const MATCH: Command = {
  name: "match",
  summary: "filter text by a pinyin query, best first",
  argument: "[text...]",
  flags: [...MATCH_FLAGS],
  needsDictionary: true,
  run: (input) => {
    const query = matchQuery(input.flags);
    const found = input.texts.map((text) => ({
      text,
      match: match(dictionaryOf(input), text, query),
    }));
    const ranked = [
      ...found
        .filter((one) => one.match !== undefined)
        .toSorted(
          (first, second) =>
            (second.match?.score ?? 0) - (first.match?.score ?? 0),
        ),
      ...found.filter((one) => one.match === undefined),
    ];

    return ranked.map((one) => {
      if (one.match === undefined) {
        return {
          lines: [`${one.text}  no match`],
          data: { query, text: one.text, matched: false },
        };
      }
      // Rounded for the reason `explain` rounds a cost: a score is a sum of
      // weights and a fraction, and 6.333333333333333 in a column tells a
      // reader nothing the first two places do not.
      const score = Math.round(one.match.score * 100) / 100;
      return {
        lines: [`${marked(one.text, one.match.ranges)}  ${score.toFixed(2)}`],
        data: {
          query,
          text: one.text,
          matched: true,
          score,
          ranges: one.match.ranges.map((range) => ({
            at: range.at,
            length: range.length,
          })),
        },
      };
    });
  },
};

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
