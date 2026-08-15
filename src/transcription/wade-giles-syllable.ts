/**
 * Reading one written Wade-Giles syllable.
 *
 * Writing it is a table, in the same way bopomofo is — see
 * `wade-giles-spelling.ts`. Reading it is not a table, and that asymmetry is
 * the whole of this file. Three things stand in the way:
 *
 * - The spelling is not injective even when written correctly: `lo` is both
 *   luō and lo, and `o` is both ē and ō.
 * - The aspiration apostrophe is routinely dropped, and it carries a phonemic
 *   distinction: `ch'i` is qī and `chi` is jī, so a dropped mark makes one
 *   spelling stand for both. Written `chu`, with the diaeresis gone too, it
 *   stands for four syllables.
 * - The diacritics are routinely dropped as well — ê, ŭ and ü — which merges
 *   `hsü` into `hsu` and `tzŭ` into `tzu`.
 *
 * So reading returns *every* syllable a spelling could be, and does it against
 * the attested inventory rather than by rule: a rule would happily read `shung`
 * or `ki`, which are not syllables of Mandarin at all.
 * {@link readWadeGiles} takes the spelling as written, and
 * {@link readWadeGilesLoosely} allows for the marks that fell off. How much
 * that costs is measured — see `docs/romanization/`.
 *
 * The tone digit, where a text writes one, cuts that list back down: the
 * inventory knows which tones each syllable is written in, so `lo²` is 羅 luó
 * and not the 咯 that is only ever neutral. See {@link narrowToAttested}.
 */
import { narrowToAttested } from "../syllable/inventory.js";
import type { Syllable } from "../syllable/syllable.js";
import type { Tone } from "../tone/tone.js";
import {
  isMarksDropped,
  normalise,
  splitErhua,
  splitTone,
} from "./wade-giles-parse.js";

import {
  INDEX,
  isSameSyllable,
  type Spelt,
  withoutMarks,
} from "./wade-giles-index.js";

/**
 * Read a normalised spelling out of one of the two indexes.
 *
 * `toKey` is how the spelling is turned into that index's key.
 *
 * The tone is written on here and not judged: the index is toneless, so what
 * comes back is every syllable of that spelling in whatever tone the text
 * carried, and narrowing that to the tones Mandarin actually writes belongs to
 * the callers, which have the whole candidate list to weigh.
 */
function readFrom(
  index: ReadonlyMap<string, readonly Spelt[]>,
  toKey: (spelling: string) => string,
  spelling: string,
  tone: Tone | undefined,
  isErhua: boolean,
): readonly Syllable[] {
  return (index.get(toKey(spelling)) ?? [])
    .filter((one) => isMarksDropped(one.spelling, spelling))
    .map((one) => ({
      ...one.syllable,
      tone,
      ...(isErhua && { erhua: true }),
    }));
}

/**
 * Read a Wade-Giles syllable exactly as it is written: `chiu⁴` becomes 就 jiù.
 *
 * Returns every syllable the spelling stands for, which is one for all but a
 * handful of them — `lo` is both 羅 luó and 咯 lo, and `o` is both 俄 é and
 * 哦 ó. Empty for anything that is not Wade-Giles at all.
 *
 * A written tone narrows that: 咯 is only ever neutral, so `lo` on its own is
 * the two syllables and `lo²` is 羅 luó alone. See {@link narrowToAttested}.
 */
export function readWadeGiles(text: string): readonly Syllable[] {
  const [written, isErhua] = splitErhua(normalise(text), false);
  const [spelling, tone] = splitTone(written);
  return narrowToAttested(
    readFrom(INDEX.exact, (key) => key, spelling, tone, isErhua),
  );
}

/**
 * The same, allowing for the marks real-world Wade-Giles drops.
 *
 * `chi` read exactly is 機 jī; read loosely it is jī or 七 qī, because a text
 * that meant `chʻi` may simply never have typed the apostrophe. The exact
 * readings come first, so a caller that wants to believe what was written can
 * take the head of the list and one that wants every possibility can take the
 * lot.
 *
 * Narrowed over the whole list rather than over each half of it, because the
 * two halves are rivals: `pan²` written exactly is a bán that Mandarin does not
 * have, and the reading worth keeping is the 盤 pán of a text that dropped an
 * apostrophe. Read exactly, `pan²` is still bán — there is nothing there to
 * prefer it to.
 */
export function readWadeGilesLoosely(text: string): readonly Syllable[] {
  const exact = readWadeGiles(text);
  const [written, isErhua] = splitErhua(normalise(text), true);
  const [spelling, tone] = splitTone(written);
  const loose = readFrom(INDEX.loose, withoutMarks, spelling, tone, isErhua);

  return narrowToAttested([
    ...exact,
    ...loose.filter((syllable) =>
      exact.every(
        (other) =>
          !isSameSyllable(other, syllable) || other.erhua !== syllable.erhua,
      ),
    ),
  ]);
}
