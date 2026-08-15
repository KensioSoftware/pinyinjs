/**
 * Wade-Giles, in both directions.
 *
 * Writing it is a table, in the same way bopomofo is: an underlying initial and
 * final go in and a spelling comes out, with a handful of context rules for the
 * places Wade-Giles respells a final after particular initials (歌 gē is `ko`,
 * 作 zuò is `tso`, 貴 guì is `kuei`).
 *
 * Reading it is not a table, and that asymmetry is the whole of this file.
 * Three things stand in the way:
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
import { normaliseSuperscript } from "../tone/tone-mark.js";
import { type Tone, toneFromNotation } from "../tone/tone.js";
import {
  APOSTROPHE,
  APOSTROPHES,
  ERHUA_SUFFIX,
} from "./wade-giles-spelling.js";

export {
  type WadeGilesOptions,
  writeWadeGiles,
  writeWadeGilesSpelling,
  writeWadeGilesWord,
} from "./wade-giles-spelling.js";

import {
  DROPPED_MARKS,
  INDEX,
  isSameSyllable,
  type Spelt,
  withoutMarks,
} from "./wade-giles-index.js";

export { INDEX } from "./wade-giles-index.js";

/**
 * Take a trailing tone digit off, raised or on the line.
 */
function splitTone(text: string): readonly [string, Tone | undefined] {
  const found = /^(.*?)([0-5])$/u.exec(normaliseSuperscript(text));
  const digit = found?.[2];
  if (found === null || digit === undefined) {
    return [text, undefined];
  }
  return [found[1] ?? "", toneFromNotation(Number(digit))];
}

/**
 * Normalise a written syllable to the shape the exact index is keyed by.
 */
export function normalise(text: string): string {
  return text
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replaceAll(APOSTROPHES, () => APOSTROPHE);
}

/**
 * Whether `written` is `spelling` with some of its marks dropped.
 *
 * Dropped, and never added: a text that wrote `chʻu` did not mean `chü`, and
 * only a text that wrote `chu` could have meant either. Allowing for a mark
 * that should not be there would double the candidate lists to catch a mistake
 * nobody makes, since the marks are dropped by not being typed rather than by
 * being typed wrongly.
 *
 * Per mark rather than all or nothing, because that is how they come off:
 * `chʻu` has kept its apostrophe and lost a diaeresis it may or may not have
 * had, so it is 出 chū or 去 qù but not 朱 zhū.
 */
function isMarksDropped(spelling: string, written: string): boolean {
  let at = 0;
  for (const character of spelling) {
    const dropped = DROPPED_MARKS.get(character);
    if (written[at] === character) {
      at += 1;
    } else if (dropped !== undefined && written.startsWith(dropped, at)) {
      at += dropped.length;
    } else {
      return false;
    }
  }
  return at === written.length;
}

/**
 * Take the 儿化 suffix off a normalised spelling.
 *
 * Done before the tone digit is read rather than after, because the digit is
 * written in front of the suffix: `wan²-'rh` is a second-tone 玩 carrying it.
 *
 * Read loosely the apostrophe may have fallen off, so `-rh` is a suffix too;
 * read exactly it is not, and neither is `-êrh` under either reading. That is
 * the point of the reduced form: 女儿 nǚ'ér is `nü³-êrh²`, two syllables, and
 * a suffix spelled the same way would make the two indistinguishable.
 */
function splitErhua(
  spelling: string,
  isLoose: boolean,
): readonly [string, boolean] {
  const suffixes = isLoose
    ? [ERHUA_SUFFIX, withoutMarks(ERHUA_SUFFIX)]
    : [ERHUA_SUFFIX];
  const suffix = suffixes.find((one) => spelling.endsWith(one));
  return suffix === undefined
    ? [spelling, false]
    : [spelling.slice(0, -suffix.length), true];
}

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
