/**
 * The five systems, each taking a write*Word helper apart into the syllable
 * write and the separator it joins on, so every syllable can be painted its
 * own colour. commands.test.ts holds each pair together over the inventory.
 */
import type { System } from "./systems.js";
/**
 * The romanisation systems, as a table the CLI can walk.
 *
 * Each entry takes apart a `write*Word` helper into the syllable write and the
 * separator it joins on, so that every syllable can be painted its own colour.
 * `commands.test.ts` holds the pair together over the whole inventory.
 */
import { writeBopomofo, writeBopomofoWord } from "../transcription/bopomofo.js";
import { writeGwoyeu, writeGwoyeuWord } from "../transcription/gwoyeu.js";
import { writeIpa, writeIpaWord } from "../transcription/ipa.js";
import {
  writeWadeGiles,
  writeWadeGilesWord,
} from "../transcription/wade-giles.js";
import { writeYale, writeYaleWord } from "../transcription/yale.js";

export const BOPOMOFO: System = {
  name: "bopomofo",
  write: writeBopomofo,
  separator: " ",
  word: (syllables) => writeBopomofoWord(syllables),
  capitals: false,
};

export const WADE_GILES: System = {
  name: "wade-giles",
  write: writeWadeGiles,
  separator: "-",
  word: (syllables, hasTones) =>
    writeWadeGilesWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: true,
};

export const YALE: System = {
  name: "yale",
  write: writeYale,
  separator: "",
  word: (syllables, hasTones) =>
    writeYaleWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: true,
};

export const GWOYEU: System = {
  name: "gwoyeu",
  write: writeGwoyeu,
  separator: "",
  word: (syllables) => writeGwoyeuWord(syllables),
  capitals: true,
};

export const IPA: System = {
  name: "ipa",
  write: writeIpa,
  separator: "",
  word: (syllables, hasTones) =>
    writeIpaWord(syllables, hasTones ? {} : { tones: "none" }),
  capitals: false,
};
