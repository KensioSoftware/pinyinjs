/**
 * Reading the text `transcribe` was given, in whatever system it is written in.
 *
 * The command's two halves meet at {@link Reading}: this one settles what
 * syllables the text stands for, and `transcribe-rows.ts` writes them out. The
 * halves are separate because the systems are asymmetric — everything can be
 * written, and only some of it can be read back, with Wade-Giles needing a
 * second pass that the writing side knows nothing about.
 */
import { isBopomofo, readBopomofo } from "../transcription/bopomofo.js";
import { readGwoyeu } from "../transcription/gwoyeu.js";
import { readIpa } from "../transcription/ipa.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  readWadeGilesWord,
  splitWadeGiles,
} from "../transcription/wade-giles.js";
import { readYale } from "../transcription/yale.js";
import { splitSyllables } from "../syllable/split.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import {
  type Flags,
  type TranscriptionSource,
  transcriptionSource,
} from "./arguments.js";

/**
 * One row of `transcribe`, before it is written in anything.
 */
export interface Reading {
  readonly syllables: readonly Syllable[];
  /** Whether the Wade-Giles this came from was spelled exactly. */
  readonly isExact?: boolean;
}

/**
 * Read Wade-Giles, keeping track of which candidates were spelled exactly.
 *
 * Always the loose reader, because the exact one is a strict subset of it and
 * the interesting case at a command line is the spelling that dropped its
 * marks. Which candidates needed repairing is shown rather than hidden — that
 * is the one thing a person looking at Wade-Giles wants to know.
 *
 * **A word gets one row and a syllable gets every candidate**, which is the
 * only honest way to show both. `chu` stands for four syllables and all four
 * fit on the screen; `maotsetung` splits five ways before any of its syllables
 * has been chosen, so what is shown is the reading
 * {@link readWadeGilesWord} settles on — 56.02% of markless words, by the
 * measurement in `docs/romanization/`.
 */
function fromWadeGiles(text: string): readonly Reading[] {
  const split = splitWadeGiles(text);
  if (split !== undefined && split.length > 1) {
    const word = readWadeGilesWord(text);
    return word === undefined
      ? /* c8 ignore next -- a run that splits always reads */ []
      : [
          {
            syllables: word,
            isExact: split.every(
              (spelling) => readWadeGiles(spelling).length > 0,
            ),
          },
        ];
  }
  const exact = new Set(
    readWadeGiles(text).map((syllable) => writeSyllable(syllable)),
  );
  return readWadeGilesLoosely(text).map((syllable) => ({
    syllables: [syllable],
    isExact: exact.has(writeSyllable(syllable)),
  }));
}

/**
 * The systems that read back as a plain list of candidates.
 *
 * Wade-Giles is not among them because it has a second, looser reader to run;
 * bopomofo is not because it needs no flag at all.
 */
const INDEXED_READERS = new Map<
  TranscriptionSource,
  (text: string) => readonly Syllable[]
>([
  ["yale", readYale],
  ["gwoyeu", readGwoyeu],
  ["ipa", readIpa],
]);

/**
 * Read whatever system the text is in, and say so.
 */
export function transcriptions(text: string, flags: Flags): readonly Reading[] {
  const from = transcriptionSource(flags);
  if (from === "wade-giles") {
    return fromWadeGiles(text);
  }
  const reader = INDEXED_READERS.get(from);
  if (reader !== undefined) {
    return reader(text).map((syllable) => ({ syllables: [syllable] }));
  }
  // Bopomofo needs no flag to be recognised: it has a script of its own, so a
  // caller can only mean one thing by it. Wade-Giles and pinyin overlap almost
  // entirely, so those have to be declared.
  if (from === "bopomofo" || (from === "auto" && isBopomofo(text))) {
    const syllable = readBopomofo(text);
    return syllable === undefined ? [] : [{ syllables: [syllable] }];
  }
  const split = splitSyllables(text);
  const syllables = (split ?? []).flatMap((spelling) => {
    const syllable = readSyllable(spelling);
    /* c8 ignore next -- splitSyllables only emits syllables that read */
    return syllable === undefined ? [] : [syllable];
  });
  return syllables.length === 0 ? [] : [{ syllables }];
}
