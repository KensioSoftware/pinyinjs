/**
 * IPA, in both directions.
 *
 * This is not a romanisation at all — it is a transcription, and it is the one
 * table here that says something about the language rather than about a
 * spelling convention. It is also the most compositional of the four: an
 * initial symbol and a final symbol, with no zero-initial forms whatever,
 * because y and w are spellings and IPA does not spell. 一 yī is simply [i].
 *
 * The transcription is the broad one of the IPA column of Wikipedia's article
 * on comparing the transcription systems, which is where the syllabary this
 * package checks against comes from, so the table and its ground truth are the
 * same analysis.
 *
 * That page is not the only one Wikipedia has, and it does not agree with the
 * other. *Help:IPA/Mandarin* is the key its editors transcribe articles with,
 * and it is narrower in four places: it writes the medials as the glides [j],
 * [w] and [ɥ], -ang with a backed [ɑ], the empty rhyme as [ɻ̩] and [ɹ̩] after
 * their two series, and the diphthongs as [aɪ aʊ eɪ oʊ]. Both are scored
 * against, and where they differ this follows the broader — see
 * [ipa-key.test.ts](ipa-key.test.ts), which records every difference rather
 * than letting the choice go unstated.
 *
 * Two consequences worth knowing:
 *
 * - **The empty rhyme is [ɨ]** after both the retroflexes and the dental
 *   sibilants, where narrower transcriptions distinguish [ʐ̩] from [z̩].
 * - **-o after a labial is [uo]**: 波 bō is [puo] while 咯 lo is [lɔ]. Yale
 *   makes the same split, from `bwo` against `lo`, which is two systems
 *   agreeing rather than one copying the other.
 *
 * What this deliberately does not model is anything above the syllable: no
 * 三声 sandhi, no reduction of an unstressed syllable, and no fusion for 儿化 —
 * see {@link ERHUA_SUFFIX}. A syllable in, a syllable out.
 */
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import { type Tone, toneFromNotation } from "../tone/tone.js";
import { indexInventory, readIndexed } from "./spelling-index.js";

import {
  EMPTY_RHYME_INITIALS,
  ERHUA_SUFFIX,
  FINAL_SYMBOLS,
  INITIAL_SYMBOLS,
  LABIAL_INITIALS,
  TONE_LETTERS,
  TONE_NUMBERS,
  type IpaOptions,
} from "./ipa-symbols.js";

export type { IpaOptions } from "./ipa-symbols.js";

/**
 * How a final is transcribed after a given initial.
 */
function finalSymbols(initial: Initial, final: Final): string {
  if (final === "i" && EMPTY_RHYME_INITIALS.has(initial)) {
    return "ɨ";
  }
  if (final === "o" && LABIAL_INITIALS.has(initial)) {
    return "uo";
  }
  return FINAL_SYMBOLS[final];
}

/**
 * Transcribe a syllable without its tone: 就 jiù becomes `tɕiou`.
 */
export function writeIpaSymbols(syllable: Syllable): string {
  const { initial, final } = syllable;
  const suffix = syllable.erhua === true ? ERHUA_SUFFIX : "";
  return `${INITIAL_SYMBOLS.get(initial) ?? ""}${finalSymbols(initial, final)}${suffix}`;
}

/**
 * Transcribe a syllable in IPA: 就 jiù becomes `tɕiou˥˩`.
 *
 * Without brackets, since whether it is phonemic or phonetic is the caller's
 * claim to make and not this table's.
 */
export function writeIpa(syllable: Syllable, options: IpaOptions = {}): string {
  const symbols = writeIpaSymbols(syllable);
  const { tone } = syllable;
  const { tones = "letters" } = options;
  if (tone === undefined || tones === "none") {
    return symbols;
  }
  const written =
    tones === "numbers" ? TONE_NUMBERS.get(tone) : TONE_LETTERS.get(tone);
  /* c8 ignore next -- every tone is in both tables */
  return `${symbols}${written ?? ""}`;
}

/**
 * Transcribe a word, one syllable after another.
 *
 * Run together, as a transcription of connected speech is written. The tone
 * letters mark where each syllable ends, so nothing is lost by it — except for
 * the neutral tone, which writes nothing and so leaves a boundary unmarked.
 */
export function writeIpaWord(
  syllables: readonly Syllable[],
  options: IpaOptions = {},
): string {
  return syllables.map((syllable) => writeIpa(syllable, options)).join("");
}

/**
 * Every syllable each transcription stands for.
 */
const INDEX = indexInventory((syllable) => writeIpaSymbols(syllable));

/**
 * The tone each written form stands for, letters and pitch numerals alike.
 */
const TONES_BY_WRITTEN = new Map<string, Tone>(
  [...TONE_LETTERS, ...TONE_NUMBERS]
    .filter(([, written]) => written !== "")
    .map(([tone, written]) => [written, tone]),
);

/**
 * Take the tone off the end, however it was written.
 *
 * Tone letters, a pitch numeral, or the plain 1-to-5 digit this package uses
 * everywhere else — the last is not IPA at all, but it costs nothing to accept
 * and it is what somebody typing at a terminal will reach for.
 */
function splitTone(text: string): readonly [string, Tone | undefined] {
  const found = /^(.*?)([˥˦˧˨˩]+|214|55|35|51|[0-5])$/u.exec(text);
  const written = found?.[2];
  if (written === undefined) {
    return [text, undefined];
  }
  const tone =
    TONES_BY_WRITTEN.get(written) ?? toneFromNotation(Number(written));
  return tone === undefined ? [text, undefined] : [found?.[1] ?? "", tone];
}

/**
 * Read an IPA transcription back: `tɕiou˥˩` becomes 就 jiù.
 *
 * An index over the inventory, as everything here is, so a transcription of
 * something Mandarin does not have reads as nothing rather than as a syllable
 * nobody says. Returns an array for the same reason the other readers do,
 * though IPA has less to be ambiguous about than any of them.
 */
export function readIpa(text: string): readonly Syllable[] {
  const [symbols, tone] = splitTone(text.trim().normalize("NFC"));
  return readIndexed(INDEX, symbols, tone, ERHUA_SUFFIX);
}
