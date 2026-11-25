import { assertArrayEquals, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { reading } from "#test/fixtures/decoder-dictionary.js";
import { toCharacters } from "../script/characters.js";
import { glossContext, runAfterGloss } from "./glosses.js";
import { splitRuns } from "./runs.js";
import type { DecodedWord } from "./word.js";

/**
 * A decoded word for each character of every Han run, and none for the rest.
 */
function wordsOfRuns(text: string): readonly (readonly DecodedWord[])[] {
  return splitRuns(text).map((run) =>
    run.isHan
      ? toCharacters(run.text).map((character) => ({
          text: character,
          reading: reading("jiǎ"),
          isProperNoun: false,
          partOfSpeech: "",
          isKnown: true,
        }))
      : [],
  );
}

/**
 * The characters of the words either side of each run, across a gloss.
 */
function contexts(text: string): readonly string[] {
  const runs = splitRuns(text);
  const words = wordsOfRuns(text);
  return runs.map((_run, at) => {
    const { before, after } = glossContext(runs, words, at);
    return `${before.map((one) => one.text).join("")}|${after.map((one) => one.text).join("")}`;
  });
}

describe("runs either side of a bracketed gloss", () => {
  it("read on from each other, and the gloss reads alone", () => {
    // Given a saying with its puns glossed in brackets
    // When each run's context is taken
    // Then the runs either side of each gloss see each other
    assertArrayEquals(contexts("贾(假)门贾(假)氏"), [
      "|门贾",
      "|",
      "|",
      "|",
      "贾|氏",
      "|",
      "|",
      "|",
      "门贾|",
    ]);
  });

  it("reads full-width brackets the same way", () => {
    assertIdentical(runAfterGloss(splitRuns("门贾（假）氏"), 0), 4);
  });

  it("leaves runs apart when anything else comes between", () => {
    // Given a gloss with a space inside its brackets, and a comma
    // When the run after the first is looked for
    // Then there is none
    assertIdentical(runAfterGloss(splitRuns("门贾( 假)氏"), 0), undefined);
    assertIdentical(runAfterGloss(splitRuns("门贾，氏"), 0), undefined);
  });
});
