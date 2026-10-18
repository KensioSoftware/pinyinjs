import { fileURLToPath } from "node:url";

import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { toCharacters } from "../script/characters.js";
import { writeSyllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { VERBAL_DE_QUESHI } from "./dique-rule.js";
import { READING_RULES } from "./reading-rules.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");

/** How the 的 of a run reads, with every rule or with every rule but this. */
function readingOfDe(run: string, withRule = true): string {
  const rules = withRule
    ? READING_RULES
    : READING_RULES.filter((rule) => rule !== VERBAL_DE_QUESHI);
  const syllables = decodeRun(dictionary, run, rules).flatMap((word) =>
    word.reading.map((syllable) => writeSyllable(syllable)),
  );
  return syllables[toCharacters(run).indexOf("的")] ?? "";
}

describe("的 before 确实", () => {
  it("reads the 的 after a verb as the particle", () => {
    // Given a verb, then 的确实
    // When the run is decoded
    // Then the 的 closes 说的 and reads de
    assertArrayEquals(
      ["他说的确实在理", "你说的确实有道理", "他做的確實不錯"].map((run) =>
        readingOfDe(run),
      ),
      ["de", "de", "de"],
    );
    // And without the rule 的确 took it
    assertArrayEquals([readingOfDe("他说的确实在理", false)], ["dí"]);
  });

  it("keeps the adverb after a noun or a pronoun", () => {
    // Given 的确实 after 战争 and after 我
    // When each is decoded
    // Then 的确 stays the adverb, even though the 争 of 战争 is a verb
    assertArrayEquals(
      [readingOfDe("战争的确实在是功不可没"), readingOfDe("我的确实在不知道")],
      ["dí", "dí"],
    );
  });

  it("leaves a 的确 with no 实 after it", () => {
    // Given 的确 followed by 是
    // When it is decoded after a verb
    // Then the adverb is untouched
    assertArrayEquals(
      [readingOfDe("他说的确是真的"), readingOfDe("他说的确")],
      ["dí", "dí"],
    );
  });
});
