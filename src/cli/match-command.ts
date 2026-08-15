/**
 * Filtering texts by a pinyin query, at the command line.
 */
import { match, type MatchRange } from "../search/match.js";
import { toCharacters } from "../script/characters.js";
import { MATCH_FLAGS, matchQuery } from "./arguments.js";
import { type Command, dictionaryOf } from "./command.js";

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
