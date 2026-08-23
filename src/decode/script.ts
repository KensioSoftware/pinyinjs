import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { ScriptTables } from "../script/conversion.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
import { detectScript } from "../script/script.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";
import { splitRuns } from "./runs.js";

import { applyRegion } from "./script-region.js";
import { convertWord, targetOf } from "./script-words.js";
import type {
  ScriptChoice,
  ScriptConversion,
  ScriptOptions,
} from "./script-types.js";

export {
  SCRIPT_EVIDENCE,
  type ScriptChoice,
  type ScriptConversion,
  type ScriptEvidence,
  type ScriptOptions,
  SCRIPT_TARGETS,
  type ScriptTarget,
} from "./script-types.js";
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
