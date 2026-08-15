/**
 * What counts as a syllable of Mandarin, and in which tones it is written.
 *
 * The two tables this answers from are large enough to read as their own
 * files: the toneless spellings live in `spellings.ts` and the tone each one
 * is written in lives in `written-tones.ts`. Both are re-exported here, so
 * this stays the one module to ask about the inventory.
 */
import { type Syllable, writeSyllable } from "./syllable.js";
import { SYLLABLE_TONES } from "./written-tones.js";

export {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
  RARE_SYLLABLES,
} from "./spellings.js";
export { SYLLABLE_TONES } from "./written-tones.js";

/**
 * Whether a syllable is written in the tone it carries.
 *
 * A syllable with no tone on it passes, since nothing has been claimed about
 * one yet, and so does a spelling the inventory has never heard of: this
 * answers which tones a syllable takes, not which syllables there are.
 */
export function isAttestedTone(syllable: Syllable): boolean {
  const { tone } = syllable;
  if (tone === undefined) {
    return true;
  }
  const tones = SYLLABLE_TONES.get(
    writeSyllable({ ...syllable, erhua: false, tone: undefined }),
  );
  return tones === undefined || tones.includes(tone);
}

/**
 * Drop the candidates for a spelling whose tone that syllable is never written
 * in.
 *
 * Reading a romanisation hands back every syllable a spelling stands for, and
 * that list is often only ambiguous on paper: Wade-Giles `lo²` is 羅 luó or
 * 咯 ló, and ló is not a syllable Mandarin has. The tone that was written is
 * evidence, and this is it being used.
 *
 * Never narrowed to nothing, though. A tone no candidate is written in is a
 * statement about the *tone* — a text that wrote it may have meant a syllable
 * of that spelling and got the tone wrong — and the reader's job is to say what
 * the spelling stands for. Refusing a spelling outright is the inventory's job,
 * and it has already been done by the time there is a candidate at all.
 */
export function narrowToAttested(
  candidates: readonly Syllable[],
): readonly Syllable[] {
  const attested = candidates.filter((syllable) => isAttestedTone(syllable));
  return attested.length === 0 ? candidates : attested;
}
