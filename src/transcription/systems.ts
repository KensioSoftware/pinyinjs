/**
 * The five systems a reading can be written in, as a table.
 *
 * Each entry takes a `write*Word` helper apart into the syllable write and the
 * separator it joins on, so that a caller can put its own markup, colour or
 * annotation around one syllable at a time. That duplicates five separators,
 * and `systems.test.ts` holds each pair against the helper it stands in for
 * over the whole inventory in both tone states.
 *
 * Every field here is a fact about the system rather than about any one output.
 * The CLI walks the table to paint a column per syllable and `toHtml` walks it
 * to write a span per syllable, and neither needs to know anything else.
 */
import type { Syllable } from "../syllable/syllable.js";
import { writeBopomofo, writeBopomofoWord } from "./bopomofo.js";
import { writeGwoyeu, writeGwoyeuWord } from "./gwoyeu.js";
import { writeIpa, writeIpaWord } from "./ipa.js";
import { writeWadeGiles, writeWadeGilesWord } from "./wade-giles.js";
import { writeYale, writeYaleWord } from "./yale.js";

/**
 * What each system is called, in the CLI and anywhere else it is named.
 */
export type TranscriptionSystemName =
  | "bopomofo"
  | "wade-giles"
  | "yale"
  | "gwoyeu"
  | "ipa";

/**
 * How one system writes a reading, and what it declares itself to be.
 */
export interface TranscriptionSystem {
  /** What `--from` and `--system` call it. */
  readonly name: TranscriptionSystemName;
  /**
   * One syllable, with its tone or without it.
   *
   * `hasTones` is false where the caller asked for no tone notation. Only
   * Wade-Giles, Yale and IPA can honour it, since each of those writes the
   * tone separately from the syllable. Bopomofo marks it with a symbol of the
   * script and Gwoyeu Romatzyh spells it into the syllable, so for those two
   * there is nothing to leave off and the flag is ignored rather than
   * approximated.
   */
  readonly write: (syllable: Syllable, hasTones: boolean) => string;
  /** What the system writes between two syllables of one word. */
  readonly separator: string;
  /** A whole word, which is {@link write} and {@link separator} together. */
  readonly word: (syllables: readonly Syllable[], hasTones: boolean) => string;
  /**
   * Whether the system writes the capitals the conversion settled.
   *
   * The three romanisations do, since a romanisation is a way of writing
   * Chinese in the Latin alphabet and inherits what that alphabet does with a
   * proper noun. IPA and bopomofo do not, for the reasons
   * {@link import("../format/transcription.js").TranscriptionOptions} gives.
   */
  readonly capitals: boolean;
  /**
   * The BCP 47 script subtag of what the system writes.
   *
   * `Latn` for the romanisations and the IPA, `Bopo` for bopomofo. Both are
   * registered script subtags, and the pair of them is the whole of the script
   * axis this package writes on.
   */
  readonly script: string;
  /**
   * The BCP 47 variant subtag naming the system, where one is registered.
   *
   * The IANA registry has `wadegile` for Wade-Giles and `fonipa` for the IPA,
   * alongside the `pinyin` a conversion carries by default. It has **none for
   * Yale and none for Gwoyeu Romatzyh**, so those two go out as `zh-Latn` and
   * the tag says Mandarin in the Latin alphabet without naming which
   * romanisation. Inventing a private-use subtag would say more and mean less,
   * since nothing consuming the tag would know it.
   */
  readonly variant?: string;
}

export const BOPOMOFO: TranscriptionSystem = {
  name: "bopomofo",
  write: (syllable) => writeBopomofo(syllable),
  separator: " ",
  word: (syllables) => writeBopomofoWord(syllables),
  capitals: false,
  script: "Bopo",
};

export const WADE_GILES: TranscriptionSystem = {
  name: "wade-giles",
  write: (syllable, hasTones) =>
    writeWadeGiles(syllable, hasTones ? {} : { tones: "none" }),
  separator: "-",
  word: (syllables, hasTones) =>
    writeWadeGilesWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: true,
  script: "Latn",
  variant: "wadegile",
};

export const YALE: TranscriptionSystem = {
  name: "yale",
  write: (syllable, hasTones) =>
    writeYale(syllable, hasTones ? {} : { tones: "none" }),
  separator: "",
  word: (syllables, hasTones) =>
    writeYaleWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: true,
  script: "Latn",
};

export const GWOYEU: TranscriptionSystem = {
  name: "gwoyeu",
  write: (syllable) => writeGwoyeu(syllable),
  separator: "",
  word: (syllables) => writeGwoyeuWord(syllables),
  capitals: true,
  script: "Latn",
};

export const IPA: TranscriptionSystem = {
  name: "ipa",
  write: (syllable, hasTones) =>
    writeIpa(syllable, hasTones ? {} : { tones: "none" }),
  separator: "",
  word: (syllables, hasTones) =>
    writeIpaWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: false,
  script: "Latn",
  variant: "fonipa",
};

/**
 * Every system, in the order the `transcribe` table writes its columns.
 */
export const TRANSCRIPTION_SYSTEMS: readonly TranscriptionSystem[] = [
  BOPOMOFO,
  WADE_GILES,
  YALE,
  GWOYEU,
  IPA,
];

/**
 * The system a name stands for, or undefined for a name that is not one.
 */
export function transcriptionSystemNamed(
  name: string | undefined,
): TranscriptionSystem | undefined {
  return TRANSCRIPTION_SYSTEMS.find((system) => system.name === name);
}
