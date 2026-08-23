/**
 * Writing a converted word in a region's own 繁體 orthography.
 *
 * The last pass over a word's choices. Taiwan and Hong Kong disagree about the
 * standard form of 58 characters and about nothing else, so this rewrites forms
 * and never a reading.
 */
import {
  DEFAULT_REGION,
  isReadingSensitive,
  type Region,
  regionalGlyphsOf,
  toRegionalGlyph,
} from "../script/glyphs.js";
import type { Syllable } from "../syllable/syllable.js";
import type { ScriptChoice, ScriptEvidence } from "./script-types.js";

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
    const to = toRegionalGlyph(choice.to, region, syllable);
    const alternatives = regionalAlternatives(choice, region, to, isGuess);
    return {
      ...choice,
      to,
      // A region can leave a character one form where the script left it two:
      // Hong Kong writes 台 for both 台 and 臺, and 泄 for both 泄 and 洩. There
      // was nothing to decide once the region is applied, whatever the script
      // conversion thought it was deciding.
      evidence: evidenceAfter(choice, alternatives, isGuess),
      alternatives,
    };
  });
}

/**
 * What settled a choice once the region has had its say.
 */
function evidenceAfter(
  choice: ScriptChoice,
  alternatives: readonly string[],
  isGuess: boolean,
): ScriptEvidence {
  if (alternatives.length === 0) {
    return "locked";
  }
  return isGuess ? "default" : choice.evidence;
}

/**
 * The forms a choice was written against, in the region's own orthography.
 *
 * Two things happen here. The rivals the script tables named are rewritten,
 * since a choice reporting 面 settled for Hong Kong beside a Taiwan 麵 would be
 * writing two orthographies at once — 3,163 of the 39,430 alternatives over
 * 88,866 lines were doing that, mostly 裡 for 裏 and 麵 for 麪. And a guess the
 * region itself created gains the form the reading would have kept, which is
 * the only thing 著 and 參 were ever choosing between.
 */
function regionalAlternatives(
  choice: ScriptChoice,
  region: Region,
  to: string,
  isGuess: boolean,
): readonly string[] {
  const forms = [
    ...choice.alternatives.map((form) => toRegionalGlyph(form, region)),
    ...(isGuess ? regionalGlyphsOf(choice.to, region) : []),
  ];
  return [...new Set(forms)].filter((form) => form !== to);
}
