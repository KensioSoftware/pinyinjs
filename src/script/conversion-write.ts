/**
 * Writing the script tables out as the artifact text.
 *
 * One line per mapping, tagged by which table it belongs to, so the whole of
 * script conversion is a single file to fetch and a single scan to read. The
 * format is the same shape as the dictionary's: separators rather than syntax,
 * so that reading it back is a split rather than a parse.
 */
import type { CharacterConversion, ScriptTables } from "./conversion.js";
import {
  COLUMN,
  LINE,
  READING,
  READING_FORM,
  TAGS,
} from "./conversion-format.js";

/**
 * Write one character table's lines.
 */
function writeCharacterTable(
  tag: string,
  table: ReadonlyMap<string, CharacterConversion>,
): string[] {
  return [...table].map(([character, conversion]) => {
    const readings = [...(conversion.byReading ?? [])]
      .map(([key, form]) => `${key}${READING_FORM}${form}`)
      .join(READING);
    const also = (conversion.also ?? []).join("");
    const columns = [tag, character, conversion.to, readings, also];
    // Trailing empty columns say nothing and are dropped, which is most lines:
    // the common case is a character with one form and no reading to condition.
    while (columns.at(-1) === "") {
      columns.pop();
    }
    return columns.join(COLUMN);
  });
}

/**
 * Write the tables as the artifact text.
 */
export function writeScriptTables(tables: ScriptTables): string {
  return [
    ...writeCharacterTable(TAGS.toTraditional, tables.toTraditional),
    ...writeCharacterTable(TAGS.toSimplified, tables.toSimplified),
    ...[...tables.traditionalWords].map(([hans, hant]) =>
      [TAGS.traditionalWord, hans, hant].join(COLUMN),
    ),
    ...[...tables.simplifiedWords].map(([hant, hans]) =>
      [TAGS.simplifiedWord, hant, hans].join(COLUMN),
    ),
    ...[...tables.hansOnly].map((character) =>
      [TAGS.hansOnly, character].join(COLUMN),
    ),
    ...[...tables.hantOnly].map((character) =>
      [TAGS.hantOnly, character].join(COLUMN),
    ),
    "",
  ].join(LINE);
}
