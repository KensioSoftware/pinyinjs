/**
 * How Wade-Giles spells a syllable: the tables, and writing one out.
 *
 * The reading side in `wade-giles.ts` builds its index by asking this module
 * what it would write for every syllable of the inventory, so the dependency
 * runs one way — spelling knows nothing about reading.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import { SUPERSCRIPT_TONES } from "../tone/tone-mark.js";

import {
  APOSTROPHE,
  FINAL_SPELLINGS,
  INITIAL_SPELLINGS,
  O_FOR_E_INITIALS,
  O_FOR_UO_INITIALS,
  RETROFLEX_INITIALS,
  SIBILANT_INITIALS,
  SIBILANT_SPELLINGS,
  UEI_INITIALS,
  ZERO_INITIAL_SPELLINGS,
} from "./wade-giles-tables.js";

export { APOSTROPHE, APOSTROPHES } from "./wade-giles-tables.js";

/**
 * How an initial is spelled in front of a given final.
 */
function initialSpelling(initial: Initial, final: Final): string {
  const sibilant = final === "i" ? SIBILANT_SPELLINGS.get(initial) : undefined;
  return sibilant ?? INITIAL_SPELLINGS.get(initial) ?? "";
}

/**
 * How a final is spelled after a given initial.
 */
function finalSpelling(initial: Initial, final: Final): string {
  if (initial === "") {
    return ZERO_INITIAL_SPELLINGS[final];
  }
  if (final === "i") {
    if (RETROFLEX_INITIALS.has(initial)) {
      return "ih";
    }
    if (SIBILANT_INITIALS.has(initial)) {
      return "ŭ";
    }
  }
  if (final === "e" && O_FOR_E_INITIALS.has(initial)) {
    return "o";
  }
  if (final === "uo" && O_FOR_UO_INITIALS.has(initial)) {
    return "o";
  }
  if (final === "uei" && UEI_INITIALS.has(initial)) {
    return "uei";
  }
  return FINAL_SPELLINGS[final];
}

/**
 * The 儿化 suffix, which Wade-Giles hangs off the syllable rather than fusing
 * into it.
 *
 * So this is the one place a syllable is written with a hyphen in it: 花儿 huār
 * is `hua¹-'rh`. Two things about that shape are worth stating, because both
 * are decisions:
 *
 * - **The suffix is the reduced `'rh` rather than a full `êrh`.** 兒 as a
 *   syllable of its own is `êrh`, and as a suffix it is written short. This is
 *   the form en.wiktionary's Chinese entries use throughout, and it is what the
 *   fixture in [test/fixtures/wiktionary.ts](../../test/fixtures/wiktionary.ts)
 *   is checked against.
 * - **The tone digit goes on the syllable, in front of the suffix.** The tone
 *   is the base syllable's — 花儿 is a first-tone 花 with a suffix on it — and
 *   Wade-Giles writes the digit after the syllable it belongs to. Writing
 *   `hua-êrh¹` instead, as this module used to, says the 兒 carries a first
 *   tone, which is not what anybody means by it.
 *
 * Pinyin's `r` suffix is the later convention and the two are not
 * interchangeable.
 */
export const ERHUA_SUFFIX = `-${APOSTROPHE}rh`;

/**
 * How a Wade-Giles syllable writes its tone.
 *
 * Wade-Giles writes it as a raised digit after the syllable, which is why
 * `superscript` is the default; `numbers` writes the same digit on the line,
 * which is what a plain-text field or a filename wants.
 */
export interface WadeGilesOptions {
  readonly tones?: "superscript" | "numbers" | "none";
}

/**
 * Spell a syllable in Wade-Giles without its tone.
 */
export function writeWadeGilesSpelling(syllable: Syllable): string {
  const { initial, final } = syllable;
  const suffix = syllable.erhua === true ? ERHUA_SUFFIX : "";
  return `${initialSpelling(initial, final)}${finalSpelling(initial, final)}${suffix}`;
}

/**
 * Write a syllable in Wade-Giles: 就 jiù becomes `chiu⁴`.
 *
 * Total over well-formed syllables, as the bopomofo writer is. An unwritten
 * tone stays unwritten rather than being invented as a first tone, which is
 * what lets the round trip come back exactly.
 *
 * The digit goes in front of the 儿化 suffix rather than after it — 玩儿 wánr
 * is `wan²-'rh` — for the reason {@link ERHUA_SUFFIX} gives.
 */
export function writeWadeGiles(
  syllable: Syllable,
  options: WadeGilesOptions = {},
): string {
  const spelling = writeWadeGilesSpelling(syllable);
  const { tone } = syllable;
  const { tones = "superscript" } = options;
  if (tone === undefined || tones === "none") {
    return spelling;
  }
  const digit =
    tones === "numbers"
      ? String(tone)
      : /* c8 ignore next -- every tone has a raised digit */
        (SUPERSCRIPT_TONES.get(tone) ?? "");
  return spelling.endsWith(ERHUA_SUFFIX)
    ? `${spelling.slice(0, -ERHUA_SUFFIX.length)}${digit}${ERHUA_SUFFIX}`
    : `${spelling}${digit}`;
}

/**
 * Write a word in Wade-Giles, hyphenating between its syllables.
 *
 * The hyphen is Wade's own convention and it is not decoration: `Tse-tung`
 * written solid could be read as two syllables or as three, and the system has
 * no 隔音符号 to fall back on. Pinyin writes the word solid and reaches for an
 * apostrophe only where the boundary is genuinely ambiguous, which is the
 * opposite default.
 */
export function writeWadeGilesWord(
  syllables: readonly Syllable[],
  options: WadeGilesOptions = {},
): string {
  return syllables
    .map((syllable) => writeWadeGiles(syllable, options))
    .join("-");
}
