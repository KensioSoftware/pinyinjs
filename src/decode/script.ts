import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import {
  type CharacterConversion,
  conversionKey,
  convertCharacter,
  formsOf,
  isAmbiguousCharacter,
  type ScriptTables,
} from "../script/conversion.js";
import {
  DEFAULT_REGION,
  isReadingSensitive,
  type Region,
  toCanonicalGlyphs,
  toRegionalGlyph,
} from "../script/glyphs.js";
import { detectScript, type Script } from "../script/script.js";
import type { Syllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";
import { splitRuns } from "./runs.js";

/**
 * A script and, for 繁體, a regional orthography, as a BCP-47 tag.
 *
 * BCP-47 rather than a shape of our own because these subtags already mean
 * exactly this, and callers recognise them. `zh-Hant` alone takes
 * {@link DEFAULT_REGION}, since there is no region-free 繁體 to fall back on —
 * see SCRIPTS-AND-LOCALES.md.
 */
export const SCRIPT_TARGETS = [
  "zh-Hans",
  "zh-Hant",
  "zh-Hant-TW",
  "zh-Hant-HK",
] as const;

/**
 * One of the orthographies {@link toScript} writes.
 */
export type ScriptTarget = (typeof SCRIPT_TARGETS)[number];

/**
 * How a script conversion should be carried out.
 */
export interface ScriptOptions {
  /** Which orthography to write. Defaults to `zh-Hans`. */
  readonly to?: ScriptTarget;
  /**
   * The script the text is written in. Detected when not given.
   *
   * Worth setting when the text is short enough that detection has nothing to
   * go on — a run of characters both scripts share settles nothing, and the
   * conversion then assumes the text needs converting.
   */
  readonly from?: Script;
}

/**
 * What settled one character's conversion, strongest first.
 *
 * - `locked` — the character has one form and there was nothing to decide.
 *   True of the great majority: simplification changed a minority of
 *   characters, and most of those are one-to-one.
 * - `word` — a word some source wrote in both scripts settled it. The strongest
 *   real evidence, because it was written rather than inferred.
 * - `reading` — the character had rival forms and the syllable it was decoded
 *   as picked between them. This is the evidence an orthographic converter does
 *   not have.
 * - `default` — rival forms existed and nothing separated them, so the
 *   commonest was taken. The only one of the four that is a guess.
 */
export const SCRIPT_EVIDENCE = [
  "locked",
  "word",
  "reading",
  "default",
] as const;

/**
 * What settled one character's conversion.
 */
export type ScriptEvidence = (typeof SCRIPT_EVIDENCE)[number];

/**
 * Why one character came out as it did.
 *
 * The same kind of claim `ReadingConfidence` makes about a syllable, and for
 * the same reason: a conversion that cannot say which characters it guessed at
 * is asking to be trusted further than it deserves. Nothing else in this space
 * reports it.
 */
export interface ScriptChoice {
  /** The character as it was written. */
  readonly from: string;
  /** The character as it was converted. */
  readonly to: string;
  readonly evidence: ScriptEvidence;
  /** The forms this character could also have taken. */
  readonly alternatives: readonly string[];
}

/**
 * A converted text, with an account of every character it was unsure about.
 */
export interface ScriptConversion {
  readonly text: string;
  readonly choices: readonly ScriptChoice[];
}

/**
 * The script and region a target names.
 */
function targetOf(target: ScriptTarget): {
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
function convertWord(
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
function evidenceFor(
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
function applyRegion(
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

/**
 * Convert a text between the scripts, reporting what it was unsure about.
 *
 * The reading is what makes this more accurate than an orthographic converter
 * can be, and it is used in both directions. 简→繁 is the famously ambiguous
 * one — 发 is 發 or 髮 — but 繁→简 has its own merges, and 乾 is 干 when `gān`
 * and stays 乾 when `qián`. Every other converter resolves these from a phrase
 * table alone; this one segments with the lattice and reads the result.
 *
 * Evidence is taken strongest first: a word some source wrote in both scripts,
 * then the character at the reading it was decoded with, then the character's
 * commonest form. What is left over is reported rather than hidden — see
 * {@link ScriptChoice}.
 *
 * This converts **orthography only**. 軟體 and 软件 are different words rather
 * than two spellings of one, and turning one into the other is translation,
 * which this package does not do.
 */
export function toScriptPieces(
  dictionary: Dictionary,
  tables: ScriptTables,
  text: string,
  options: ScriptOptions = {},
): ScriptConversion {
  const { script, region } = targetOf(options.to ?? "zh-Hans");
  const table = script === "Hans" ? tables.toSimplified : tables.toTraditional;
  const words =
    script === "Hans" ? tables.simplifiedWords : tables.traditionalWords;

  // Text already in the target script must not be run through the conversion
  // tables, and this is not an optimisation. Plenty of characters are current
  // in both scripts, so the tables would rewrite them: 准 is 简体 for 準 *and* a
  // 繁體 character of its own, and 准將 would come back 準將. Rewriting
  // 繁體-TW into 繁體-HK is the case that meets this constantly.
  const from =
    options.from ?? detectScript(text, tables.hansOnly, tables.hantOnly);
  const isSameScript = from === script;

  let converted = "";
  const choices: ScriptChoice[] = [];

  for (const run of splitRuns(text)) {
    if (!run.isHan) {
      converted += run.text;
      continue;
    }
    // 繁體 glyph variants are folded to the canonical form first, so that a
    // Hong Kong input converts the same as its Taiwan spelling would.
    for (const word of decodeRun(dictionary, run.text, READING_RULES)) {
      const canonical = toCanonicalGlyphs(word.text);
      const isAligned = word.reading.length === toCharacters(canonical).length;
      const chosen = applyRegion(
        isSameScript
          ? keepWord(canonical)
          : convertWord(table, words, canonical, word.reading),
        word.reading,
        region,
        isAligned,
      );
      choices.push(...chosen);
      converted += chosen.map((choice) => choice.to).join("");
    }
  }

  return { text: converted, choices };
}

/**
 * Keep a word as it stands, which is what a text already in the target script
 * needs. Every character is locked, because none of them was in question.
 */
function keepWord(word: string): readonly ScriptChoice[] {
  return toCharacters(word).map((character) => ({
    from: character,
    to: character,
    evidence: "locked" as const,
    alternatives: [],
  }));
}

/**
 * Convert a text between the scripts. {@link toScriptPieces}, joined.
 */
export function toScript(
  dictionary: Dictionary,
  tables: ScriptTables,
  text: string,
  options: ScriptOptions = {},
): string {
  return toScriptPieces(dictionary, tables, text, options).text;
}

/**
 * Whether a converted character was a guess.
 *
 * True only for `default`: rival forms existed and neither an attested word nor
 * the reading separated them. A character settled by its reading is not a guess
 * — that evidence is the reason this package converts more accurately than an
 * orthographic converter can, and reporting it as doubt would throw the claim
 * away. The mirror of `isUncertain` for readings, and it lands on far less.
 */
export function isUncertainChoice(choice: ScriptChoice): boolean {
  return choice.evidence === "default";
}
