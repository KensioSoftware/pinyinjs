/**
 * Converting one word between the scripts, and what the evidence was.
 *
 * A word is converted whole where the tables know it and character by
 * character otherwise, and each choice carries what settled it so a caller
 * can show where the conversion was guessing.
 */
import type {
  ScriptChoice,
  ScriptEvidence,
  ScriptTarget,
} from "./script-types.js";
import { toCharacters } from "../script/characters.js";
import {
  type CharacterConversion,
  conversionKey,
  convertCharacter,
  formsOf,
  isAmbiguousCharacter,
} from "../script/conversion.js";
import {
  DEFAULT_REGION,
  isReadingSensitive,
  type Region,
  toRegionalGlyph,
} from "../script/glyphs.js";
import type { Script } from "../script/script.js";
import type { Syllable } from "../syllable/syllable.js";

/**
 * The script and region a target names.
 */
export function targetOf(target: ScriptTarget): {
  script: Script;
  region: Region;
} {
  if (target === "zh-Hans") {
    return { script: "Hans", region: DEFAULT_REGION };
  }
  return {
    script: "Hant",
    region: target === "zh-Hant-HK" ? "HK" : DEFAULT_REGION,
  };
}

/**
 * Convert one word, preferring what a source wrote to what its characters imply.
 */
export function convertWord(
  table: ReadonlyMap<string, CharacterConversion>,
  words: ReadonlyMap<string, string>,
  word: string,
  reading: readonly Syllable[],
): readonly ScriptChoice[] {
  const characters = toCharacters(word);
  const attested = words.get(word);
  // A word only counts as attested when it lines up character for character;
  // anything else cannot be reported per character, which is what the choices
  // are. Those are rare enough to fall through to the characters.
  const attestedCharacters =
    attested === undefined ? undefined : toCharacters(attested);
  const isAttested = attestedCharacters?.length === characters.length;

  // A reading covering a different number of characters than the word has
  // cannot be lined up with them — 儿化 writes two characters as one syllable.
  const isAligned = reading.length === characters.length;

  return characters.map((character, at) => {
    const syllable = isAligned ? reading[at] : undefined;
    const conversion = table.get(character);
    const atReading = conversion?.byReading?.get(conversionKey(syllable));
    const to = isAttested
      ? /* c8 ignore next -- the lengths were just checked */
        (attestedCharacters[at] ?? character)
      : convertCharacter(table, character, syllable);
    return {
      from: character,
      to,
      evidence: evidenceFor(
        isAttested,
        atReading !== undefined,
        isAmbiguousCharacter(table, character),
      ),
      alternatives: formsOf(conversion).filter(
        (form) => form !== character && form !== to,
      ),
    };
  });
}

/**
 * Rank what settled a character, strongest evidence first.
 */
export function evidenceFor(
  isAttested: boolean,
  isAtReading: boolean,
  isAmbiguous: boolean,
): ScriptEvidence {
  if (!isAmbiguous) {
    return "locked";
  }
  if (isAttested) {
    return "word";
  }
  return isAtReading ? "reading" : "default";
}

/**
 * Apply the regional 繁體 forms, which never change a reading.
 */
export function applyRegion(
  choices: readonly ScriptChoice[],
  reading: readonly Syllable[],
  region: Region,
  isAligned: boolean,
): readonly ScriptChoice[] {
  if (region === DEFAULT_REGION) {
    return choices;
  }
  return choices.map((choice, at) => {
    const syllable = isAligned ? reading[at] : undefined;
    // A regional form that needs the reading and has none is a guess, whatever
    // settled the script conversion before it: 著 is 着 or 著 in Hong Kong.
    const isGuess = isReadingSensitive(choice.to) && syllable === undefined;
    return {
      ...choice,
      to: toRegionalGlyph(choice.to, region, syllable),
      evidence: isGuess ? "default" : choice.evidence,
    };
  });
}
