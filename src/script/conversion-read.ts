/**
 * Reading the script tables back from the artifact text.
 */
import { toCharacters } from "./characters.js";
import type { CharacterConversion, ScriptTables } from "./conversion.js";
import {
  COLUMN,
  LINE,
  READING,
  READING_FORM,
  TAGS,
} from "./conversion-format.js";

/**
 * Read one character table line into its conversion.
 */
function readConversion(
  to: string,
  readings: string,
  also: string,
): CharacterConversion {
  const pairs = readings === "" ? [] : readings.split(READING);
  const byReading = new Map<string, string>();
  for (const pair of pairs) {
    const [key = "", form = ""] = pair.split(READING_FORM);
    if (form !== "") {
      byReading.set(key, form);
    }
  }
  return {
    to,
    ...(byReading.size > 0 && { byReading }),
    ...(also !== "" && { also: toCharacters(also) }),
  };
}

/**
 * Read the tables back from the artifact text.
 *
 * Unknown tags are skipped rather than rejected, so that a future table can be
 * added without an older reader refusing the file outright.
 */
export function readScriptTables(text: string): ScriptTables {
  const toTraditional = new Map<string, CharacterConversion>();
  const toSimplified = new Map<string, CharacterConversion>();
  const traditionalWords = new Map<string, string>();
  const simplifiedWords = new Map<string, string>();
  const hansOnly = new Set<string>();
  const hantOnly = new Set<string>();

  const characterTables = new Map<string, Map<string, CharacterConversion>>([
    [TAGS.toTraditional, toTraditional],
    [TAGS.toSimplified, toSimplified],
  ]);
  const wordTables = new Map<string, Map<string, string>>([
    [TAGS.traditionalWord, traditionalWords],
    [TAGS.simplifiedWord, simplifiedWords],
  ]);
  const characterSets = new Map<string, Set<string>>([
    [TAGS.hansOnly, hansOnly],
    [TAGS.hantOnly, hantOnly],
  ]);

  for (const line of text.split(LINE)) {
    const [tag = "", from = "", to = "", readings = "", also = ""] =
      line.split(COLUMN);
    if (from === "") {
      continue;
    }
    // Dispatching on a map rather than a switch keeps an unknown tag a no-op,
    // so a file written by a later version reads as much as this one knows.
    characterTables.get(tag)?.set(from, readConversion(to, readings, also));
    wordTables.get(tag)?.set(from, to);
    characterSets.get(tag)?.add(from);
  }

  return {
    toTraditional,
    toSimplified,
    traditionalWords,
    simplifiedWords,
    hansOnly,
    hantOnly,
  };
}
