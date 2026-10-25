/**
 * What `lookup` reports for one word: its readings in both locales, its tags
 * and the readings it has besides.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import type { Syllable } from "../syllable/syllable.js";
import { type Painter, PLAIN } from "./colour.js";
import { type Reported, written } from "./command.js";

/**
 * A labelled line of readings, or no line where there are none.
 */
function readingsLine(
  label: string,
  readings: readonly (readonly Syllable[])[],
  paint: Painter,
): readonly string[] {
  return readings.length === 0
    ? []
    : [
        `  ${label}  ${readings
          .map((reading) => written(reading, paint))
          .join(", ")}`,
      ];
}

/**
 * What the dictionary holds for a word.
 */
export function entryFound(
  dictionary: Dictionary,
  word: string,
  paint: Painter,
): Reported {
  const entry = dictionary.lookup(word);
  if (entry === undefined) {
    return {
      lines: [`${word}  not in the dictionary`],
      data: { word, found: false },
    };
  }

  const tags = [
    entry.partOfSpeech,
    entry.isProperNoun ? "proper noun" : "",
  ].filter((tag) => tag !== "");
  const others = dictionary.readingsOf(word).slice(1);
  const taiwanOthers = entry.taiwanAlternates ?? [];

  return {
    lines: [
      `${word}  ${written(entry.reading, paint)}${tags.length > 0 ? `  ${tags.join(", ")}` : ""}`,
      ...readingsLine(
        "zh-TW",
        entry.taiwanReading === undefined ? [] : [entry.taiwanReading],
        paint,
      ),
      ...readingsLine("zh-TW also", taiwanOthers, paint),
      ...readingsLine("also ", others, paint),
    ],
    data: {
      word,
      found: true,
      reading: written(entry.reading, PLAIN),
      partOfSpeech: entry.partOfSpeech,
      isProperNoun: entry.isProperNoun,
      ...(entry.taiwanReading !== undefined && {
        taiwanReading: written(entry.taiwanReading, PLAIN),
      }),
      otherReadings: others.map((reading) => written(reading, PLAIN)),
      ...(taiwanOthers.length > 0 && {
        otherTaiwanReadings: taiwanOthers.map((reading) =>
          written(reading, PLAIN),
        ),
      }),
    },
  };
}
