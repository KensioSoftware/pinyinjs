import { sampleDictionary } from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertStringIncludes,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import { TONES } from "../tone/tone.js";
import { painterFor, PLAIN, stripColour, visibleLength } from "./colour.js";
import { SYSTEMS, writtenWith } from "./commands.js";
import { type CliEnvironment, runCli } from "./run.js";

/**
 * What these tests run against, at a terminal that offers no colour.
 */
const environment: CliEnvironment = {
  version: "0.0.0",
  colours: 0,
  readInput: () => Promise.resolve(""),
  loadDictionary: () => Promise.resolve(sampleDictionary()),
};

/**
 * The same, at a terminal that does.
 */
const terminal: CliEnvironment = { ...environment, colours: 256 };

/**
 * Every syllable of the inventory in every tone state, with and without 儿化.
 *
 * The 5,088 forms `pnpm transcription` scores, since what is being checked here
 * is that taking each system's word writer apart changes nothing it writes.
 */
function everyForm(): readonly Syllable[] {
  const forms: Syllable[] = [];
  for (const spelling of DICTIONARY_SYLLABLES) {
    const base = readSyllable(spelling);
    /* c8 ignore next 3 -- every spelling in the inventory reads */
    if (base === undefined) {
      continue;
    }
    for (const tone of [undefined, ...TONES]) {
      for (const erhua of [false, true]) {
        forms.push({ ...base, ...(tone !== undefined && { tone }), erhua });
      }
    }
  }
  return forms;
}

/**
 * One command's lines, coloured, beside the same lines uncoloured.
 */
async function bothWays(...argv: readonly string[]): Promise<{
  readonly argv: readonly string[];
  readonly plain: readonly string[];
  readonly coloured: readonly string[];
}> {
  const [plain, coloured] = await Promise.all([
    runCli(argv, environment),
    runCli(argv, terminal),
  ]);
  assertIdentical(plain.status, 0, plain.errors.join("\n"));
  assertIdentical(coloured.status, 0, coloured.errors.join("\n"));
  return { argv, plain: plain.output, coloured: coloured.output };
}

/**
 * Every command that writes a syllable, and so has a colour to put on it.
 */
const COLOURED: readonly (readonly string[])[] = [
  ["convert", "银行"],
  ["convert", "--greedy", "银行"],
  ["explain", "银行"],
  ["lookup", "银行"],
  ["syllable", "yínháng"],
  ["sandhi", "bùshì"],
  ["number", "26"],
  ["transcribe", "běijīng"],
  ["transcribe", "--from", "wade-giles", "chu¹"],
];

/**
 * The same run of every one of them, with a set of flags added.
 */
async function everyCommand(
  ...extra: readonly string[]
): Promise<readonly Awaited<ReturnType<typeof bothWays>>[]> {
  return Promise.all(COLOURED.map(async (argv) => bothWays(...argv, ...extra)));
}

describe("writing a word one syllable at a time", () => {
  it("covers the inventory the romanisation phase measured", () => {
    assertArrayLength(everyForm(), 5088);
  });

  it("writes exactly what the system's own word writer writes", () => {
    const forms = everyForm();
    for (const system of SYSTEMS) {
      for (let at = 0; at + 1 < forms.length; at += 2) {
        const word = forms.slice(at, at + 2);
        assertIdentical(
          writtenWith(word, system, PLAIN),
          system.word(word, true),
          word.map((syllable) => writeSyllable(syllable)).join(""),
        );
      }
    }
  });

  it("paints each syllable of a word its own colour", () => {
    const bei = readSyllable("běi");
    const jing = readSyllable("jīng");
    const bopomofo = SYSTEMS[0];
    assertNonNullable(bei);
    assertNonNullable(jing);
    assertNonNullable(bopomofo);
    const painted = writtenWith([bei, jing], bopomofo, painterFor(16));
    assertIdentical(stripColour(painted), "ㄅㄟˇ ㄐㄧㄥ");
    assertStringIncludes(painted, "\u{1B}[32m");
    assertStringIncludes(painted, "\u{1B}[91m");
  });
});

describe("columns of coloured output", () => {
  it("changes nothing a reader sees", async () => {
    // Escapes are invisible, so a coloured line has to strip back to the plain
    // one exactly — same characters, same padding. A column padded with
    // `padEnd` counts the escapes and pulls the rest of the row left.
    const runs = await everyCommand();
    for (const { argv, plain, coloured } of runs) {
      assertArrayLength(coloured, plain.length, argv.join(" "));
      for (const [at, line] of coloured.entries()) {
        assertIdentical(stripColour(line), plain[at], argv.join(" "));
      }
    }
  });

  it("actually colours each of them", async () => {
    const runs = await everyCommand();
    for (const { argv, coloured } of runs) {
      assertStringIncludes(coloured.join("\n"), "\u{1B}[38;5;", argv.join(" "));
    }
  });

  it("says the same thing in JSON whether the terminal colours or not", async () => {
    const runs = await everyCommand("--json");
    for (const { argv, plain, coloured } of runs) {
      assertArrayEquals(coloured, plain, argv.join(" "));
    }
  });

  it("leaves the syllables it has no colour for alone", async () => {
    // A syllable with no tone written at all: MDBG has no colour for one, and
    // an unwritten tone is not the neutral tone. Wade-Giles that dropped its
    // tone number is the same case arriving from the other direction.
    const runs = await Promise.all([
      bothWays("syllable", "beijing"),
      bothWays("transcribe", "--from", "wade-giles", "chu"),
    ]);
    for (const { argv, plain, coloured } of runs) {
      assertArrayEquals(coloured, plain, argv.join(" "));
      assertIdentical(visibleLength(coloured.join("")), plain.join("").length);
    }
  });
});
