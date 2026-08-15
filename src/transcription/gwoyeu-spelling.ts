/**
 * How Gwoyeu Romatzyh spells a syllable, once the tonal rules have run.
 *
 * The tables and the write side. `gwoyeu.ts` reads by building an index from
 * what this writes for every syllable of the inventory in every tone, so the
 * dependency runs one way.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  type ContourTone,
  fourthTone,
  tonalForm,
  zeroInitial,
} from "./gwoyeu-tonal-forms.js";
import {
  APOSTROPHE,
  APOSTROPHE_TONES,
  EMPTY_RHYME_INITIALS,
  ERHUA_SUFFIX,
  FINAL_SPELLINGS,
  INITIAL_SPELLINGS,
  RHOTACISED_EMPTY_RHYME,
  RHOTACISED_RIMES,
} from "./gwoyeu-tables.js";
export const NEUTRAL_MARK = ".";

/**
 * How a final is spelled after a given initial.
 */
function rimeSpelling(initial: Initial, final: Final): string {
  return final === "i" && EMPTY_RHYME_INITIALS.has(initial)
    ? "y"
    : FINAL_SPELLINGS[final];
}

/**
 * The basic form of a syllable: the spelling every tonal rule starts from.
 */
function basicForm(syllable: Syllable): string {
  const { initial, final } = syllable;
  const spelt = INITIAL_SPELLINGS.get(initial) ?? "";
  return `${spelt}${rimeSpelling(initial, final)}`;
}

/**
 * Spell a syllable in a given tone.
 */
export function toneForm(syllable: Syllable, tone: ContourTone): string {
  return tonalForm(basicForm(syllable), syllable.initial, tone);
}

/**
 * The basic rhotacised form of a syllable: the spelling before the `-l`.
 */
function rhotacisedForm(syllable: Syllable): string {
  const { initial, final } = syllable;
  const rime =
    final === "i" && EMPTY_RHYME_INITIALS.has(initial)
      ? RHOTACISED_EMPTY_RHYME
      : RHOTACISED_RIMES[final];
  return `${INITIAL_SPELLINGS.get(initial) ?? ""}${rime}`;
}

/**
 * Whether a rhotacised rime spells its fourth tone rather than doubling the l.
 *
 * The fourth tone of a rhotacised syllable doubles the `-l` — `nal` becomes
 * `nall` — except where the rime has a fourth tone of its own to spell, and
 * then it spells that and adds the l on the end: `aul` becomes `awl` and `angl`
 * becomes `anql`. *Spelling in Gwoyeu Romatzyh* lists the exceptions as
 * `awl, owl, anql, enql, onql` and `ehl`, which is every rime ending in a
 * diphthong's -u or in -ng, plus the `e` that takes the apostrophe.
 */
function isOwnFourthTone(final: Final, rime: string): boolean {
  return final === "e" || /(?:[aeiou]u|ng)$/u.test(rime);
}

/**
 * Spell a rhotacised syllable in a given tone.
 */
export function rhotacisedTone(syllable: Syllable, tone: ContourTone): string {
  const { initial, final } = syllable;
  const basic = rhotacisedForm(syllable);
  if (tone === 4) {
    const spelt = isOwnFourthTone(final, basic)
      ? `${fourthTone(basic)}${ERHUA_SUFFIX}`
      : `${basic}${ERHUA_SUFFIX}${ERHUA_SUFFIX}`;
    return initial === "" ? zeroInitial(spelt, basic) : spelt;
  }
  const apostrophe =
    tone <= (APOSTROPHE_TONES.get(final) ?? 0) ? APOSTROPHE : "";
  return `${tonalForm(basic, initial, tone)}${apostrophe}${ERHUA_SUFFIX}`;
}

/**
 * Spell a syllable in a given tone, rhotacised or not.
 */
function spelling(syllable: Syllable, tone: ContourTone): string {
  return syllable.erhua === true
    ? rhotacisedTone(syllable, tone)
    : toneForm(syllable, tone);
}

/**
 * The basic form of a syllable, rhotacised or not.
 *
 * The spelling before any tonal rule has touched it, which is the first tone
 * for every initial but the sonorants and the second tone for those. It is
 * what a neutral syllable with no original tone is written as.
 */
function basicSpelling(syllable: Syllable): string {
  if (syllable.erhua !== true) {
    return basicForm(syllable);
  }
  const apostrophe = APOSTROPHE_TONES.has(syllable.final) ? APOSTROPHE : "";
  return `${rhotacisedForm(syllable)}${apostrophe}${ERHUA_SUFFIX}`;
}

/**
 * Write a syllable in Gwoyeu Romatzyh: 就 jiù becomes `jiow`.
 *
 * An unwritten tone is written as the first-tone form, because GR has no other
 * form to write — which means it reads back as a first tone, exactly as
 * bopomofo's unmarked syllable does.
 *
 * The neutral tone takes the dot in front, and behind it goes the syllable's
 * original tonal spelling where {@link Syllable.originalTone} says what that
 * was: 没有 méiyou is `mei.yeou`. Where it does not, the basic form goes there
 * instead — which is what GR itself writes for a syllable that is neutral in
 * its own right, 什么 shénme being `shern.me`. The basic form is not the first
 * tone for a sonorant initial, and writing `.mhe` would say the 么 was one.
 */
export function writeGwoyeu(syllable: Syllable): string {
  const { tone, originalTone } = syllable;
  if (tone === NEUTRAL_TONE) {
    const spelt =
      originalTone === undefined || originalTone === NEUTRAL_TONE
        ? basicSpelling(syllable)
        : spelling(syllable, originalTone);
    return `${NEUTRAL_MARK}${spelt}`;
  }
  return spelling(syllable, tone ?? 1);
}

/**
 * Write a word in Gwoyeu Romatzyh, one syllable after another.
 *
 * Solid, as GR writes a word: 北京 is `Beeijing`, which is the convention
 * pinyin inherited. GR uses an apostrophe where the join is ambiguous — its own
 * name for pinyin, `Pin'in`, is the standard example — and that is not written
 * here, for the same reason `readGwoyeu` takes one syllable at a time: knowing
 * where the boundary is ambiguous means being able to split the word, and
 * nothing here splits a GR word.
 */
export function writeGwoyeuWord(syllables: readonly Syllable[]): string {
  return syllables.map((syllable) => writeGwoyeu(syllable)).join("");
}
