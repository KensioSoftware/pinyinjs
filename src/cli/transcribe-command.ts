/**
 * The romanisation systems the CLI can write, and the command that writes them.
 */
import {
  isBopomofo,
  readBopomofo,
  writeBopomofo,
  writeBopomofoWord,
} from "../transcription/bopomofo.js";
import {
  readGwoyeu,
  writeGwoyeu,
  writeGwoyeuWord,
} from "../transcription/gwoyeu.js";
import { readIpa, writeIpa, writeIpaWord } from "../transcription/ipa.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  readWadeGilesWord,
  splitWadeGiles,
  writeWadeGiles,
  writeWadeGilesWord,
} from "../transcription/wade-giles.js";
import { readYale, writeYale, writeYaleWord } from "../transcription/yale.js";
import { splitSyllables } from "../syllable/split.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import {
  convertOptions,
  type Flags,
  type TranscriptionSource,
  transcriptionSource,
} from "./arguments.js";
import { type Painter, PLAIN, visibleLength } from "./colour.js";
import { type Command, column } from "./command.js";

/**
 * One syllable or word, in every system.
 */
interface Transcribed {
  readonly pinyin: string;
  readonly bopomofo: string;
  readonly wadeGiles: string;
  readonly yale: string;
  readonly gwoyeu: string;
  readonly ipa: string;
  /**
   * Whether the Wade-Giles this came from was spelled exactly.
   *
   * Undefined when the input was not Wade-Giles, since the question only
   * arises there.
   */
  readonly isExact?: boolean;
}

/**
 * One row of `transcribe`, before it is written in anything.
 */
interface Reading {
  readonly syllables: readonly Syllable[];
  /** Whether the Wade-Giles this came from was spelled exactly. */
  readonly isExact?: boolean;
}

/**
 * How one system writes a word: a syllable at a time, and what it joins on.
 *
 * The `write*Word` helpers are each a map and a join, and this takes them apart
 * so that every syllable can be painted its own colour. That duplicates five
 * separators, so each entry carries the helper it stands in for and
 * `commands.test.ts` asserts the two agree over the whole inventory in every
 * tone state — rather than the list being trusted.
 */
export interface System {
  /** What `--from` and `--system` call it. */
  readonly name: TranscriptionSource;
  readonly write: (syllable: Syllable) => string;
  readonly separator: string;
  /**
   * How the system writes a word, with its tones or without them.
   *
   * `--notation none` can only be honoured where the tone is written
   * separately*: Wade-Giles, Yale and IPA all have a way to leave it off.
   * Bopomofo marks it with a symbol of the script and Gwoyeu Romatzyh spells
   * it into the syllable, so for those two there is nothing to leave off and
   * the flag is ignored rather than approximated.
   */
  readonly word: (syllables: readonly Syllable[], hasTones: boolean) => string;
  /**
   * Whether the system writes the capitals the conversion settled.
   *
   * The three romanisations do, since a romanisation is a way of writing
   * Chinese in the Latin alphabet and inherits what that alphabet does with a
   * proper noun. IPA and bopomofo do not — see {@link toTranscription}.
   */
  readonly capitals: boolean;
}

const BOPOMOFO: System = {
  name: "bopomofo",
  write: writeBopomofo,
  separator: " ",
  word: (syllables) => writeBopomofoWord(syllables),
  capitals: false,
};

const WADE_GILES: System = {
  name: "wade-giles",
  write: writeWadeGiles,
  separator: "-",
  word: (syllables, hasTones) =>
    writeWadeGilesWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: true,
};

const YALE: System = {
  name: "yale",
  write: writeYale,
  separator: "",
  word: (syllables, hasTones) =>
    writeYaleWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: true,
};

const GWOYEU: System = {
  name: "gwoyeu",
  write: writeGwoyeu,
  separator: "",
  word: (syllables) => writeGwoyeuWord(syllables),
  capitals: true,
};

const IPA: System = {
  name: "ipa",
  write: writeIpa,
  separator: "",
  word: (syllables, hasTones) =>
    writeIpaWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: false,
};

/**
 * Every system `transcribe` writes a column for, for the guard above.
 */
export const SYSTEMS: readonly System[] = [
  BOPOMOFO,
  WADE_GILES,
  YALE,
  GWOYEU,
  IPA,
];

/**
 * The system a `--system` or `--from` name stands for.
 */
export function systemNamed(
  name: TranscriptionSource | undefined,
): System | undefined {
  return SYSTEMS.find((system) => system.name === name);
}

/**
 * Write a run of syllables in one system, each syllable in its tone's colour.
 */
export function writtenWith(
  syllables: readonly Syllable[],
  system: System,
  paint: Painter,
): string {
  return syllables
    .map((syllable) => paint(system.write(syllable), syllable.tone))
    .join(system.separator);
}

/**
 * Write a run of syllables in every system.
 */
function transcribed(
  reading: Reading,
  flags: Flags,
  paint: Painter,
): Transcribed {
  const { notation } = convertOptions(flags);
  const { syllables, isExact } = reading;
  return {
    pinyin: syllables
      .map((syllable) =>
        paint(writeSyllable(syllable, notation), syllable.tone),
      )
      .join(""),
    bopomofo: writtenWith(syllables, BOPOMOFO, paint),
    wadeGiles: writtenWith(syllables, WADE_GILES, paint),
    yale: writtenWith(syllables, YALE, paint),
    gwoyeu: writtenWith(syllables, GWOYEU, paint),
    ipa: writtenWith(syllables, IPA, paint),
    ...(isExact !== undefined && { isExact }),
  };
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
function transcriptions(text: string, flags: Flags): readonly Reading[] {
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

/**
 * How wide each of `transcribe`'s columns is when its cells are narrow.
 *
 * A floor rather than the width: a whole word is wider than a syllable, and
 * `mao-tsʻê-tung` is thirteen characters in a column sized for `ch'ü¹`. The
 * widths are kept as a floor so that a single syllable still lines up with the
 * next answer down when a file is piped through, and so that widening one row
 * does not move every example in the docs.
 */
const TRANSCRIBE_WIDTHS: readonly number[] = [12, 10, 12, 12, 10, 10, 12, 0];

/**
 * Lay rows of cells out in columns, each as wide as it needs to be.
 */
function laidOut(rows: readonly (readonly string[])[]): readonly string[] {
  const widths = TRANSCRIBE_WIDTHS.map((floor, at) =>
    Math.max(
      floor,
      ...rows.map((row) => {
        // A cell needs one space after it at least, which is what the floor
        // gives the widest syllable already. Only a cell that does not fit
        // widens the column, and then it takes two — so a single syllable is
        // laid out exactly as it was before words could arrive.
        const width = visibleLength(row[at] ?? "");
        return width + 1 > floor ? width + 2 : 0;
      }),
    ),
  );
  return rows.map((row) =>
    row
      .map((cell, at) => column(cell, widths[at] ?? 0))
      .join("")
      .trimEnd(),
  );
}

/**
 * Write pinyin in every other system, and read any of them back.
 *
 * Not `romanize`, for two reasons: bopomofo has a script of its own and IPA is
 * a transcription rather than a spelling, so half the columns are not
 * romanisations — and the input is pinyin, which already is one. *Comparison of
 * Standard Chinese transcription systems*, the syllabary these tables are
 * checked against, is the source of the word as well as of the columns.
 *
 * Needs no dictionary, for the same reason `syllable` does: a transcription is
 * a mapping over syllables and there is nothing to look up. Several rows come
 * back where Wade-Giles is ambiguous, which is most of it once the apostrophes
 * and diacritics have been dropped.
 */
export const TRANSCRIBE: Command = {
  name: "transcribe",
  summary: "pinyin to bopomofo, Wade-Giles, Yale, GR and IPA, and back",
  argument: "<text...>",
  flags: ["notation", "from"],
  needsDictionary: false,
  run: (input) =>
    input.texts.map((text) => {
      const found = transcriptions(text, input.flags);
      if (found.length === 0) {
        return {
          lines: [`${text}  not readable`],
          data: { text, read: false },
        };
      }
      return {
        lines: laidOut(
          found.map((reading, index) => {
            const one = transcribed(reading, input.flags, input.paint);
            return [
              index === 0 ? text : "",
              one.pinyin,
              one.bopomofo,
              one.wadeGiles,
              one.yale,
              one.gwoyeu,
              one.ipa,
              one.isExact === false ? "marks restored" : "",
            ];
          }),
        ),
        data: {
          text,
          read: true,
          readings: found.map((reading) =>
            transcribed(reading, input.flags, PLAIN),
          ),
        },
      };
    }),
};
