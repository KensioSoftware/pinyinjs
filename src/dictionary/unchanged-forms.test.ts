import {
  assertArrayEquals,
  assertFalse,
  assertIdentical,
  assertSetSize,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { convertCharacter, formsOf } from "../script/conversion.js";
import { parseCedict } from "../sources/cedict.js";
import { parseOpenCcTable } from "../sources/opencc.js";
import { readSyllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";
import { buildScriptTables } from "./script-tables.js";
import { unchangedTraditional, withUnchangedForms } from "./unchanged-forms.js";

/**
 * Real lines from OpenCC's `STCharacters.txt`.
 */
const OPENCC = parseOpenCcTable(
  ["后\t後 后", "种\t種 种", "听\t聽", "发\t發 髮", "虫\t蟲 虫"].join("\n"),
);

/**
 * Real lines from CC-CEDICT.
 */
const CEDICT = parseCedict(
  [
    "後 后 [hou4] /back; behind; rear/",
    "后 后 [hou4] /empress; queen/",
    "皇后 皇后 [huang2 hou4] /empress/",
    "種 种 [zhong3] /seed; species/",
    "听 听 [yin3] /smile (archaic)/",
    "聽 听 [ting1] /to listen/",
    "虫 虫 [chong2] /variant of 蟲|虫[chong2]/",
  ].join("\n"),
);

describe("unchangedTraditional", () => {
  it("takes a character both sources write unchanged", () => {
    assertTrue(unchangedTraditional(OPENCC, CEDICT).has("后"));
  });

  it("finds the character inside a longer word", () => {
    const wordOnly = CEDICT.filter((entry) => entry.traditional !== "后");
    assertTrue(unchangedTraditional(OPENCC, wordOnly).has("后"));
  });

  it("leaves a character only OpenCC writes unchanged", () => {
    assertFalse(unchangedTraditional(OPENCC, CEDICT).has("种"));
  });

  it("leaves a character only CC-CEDICT writes unchanged", () => {
    assertFalse(unchangedTraditional(OPENCC, CEDICT).has("听"));
  });

  it("leaves an entry that only points at a variant", () => {
    assertFalse(unchangedTraditional(OPENCC, CEDICT).has("虫"));
  });

  it("returns nothing more than the agreed characters", () => {
    assertSetSize(unchangedTraditional(OPENCC, CEDICT), 1);
  });
});

/**
 * An entry with only the fields the script tables read.
 */
function entry(hans: string, hant: string, reading: string): DictionaryEntry {
  return {
    hans,
    hant,
    readings: {
      cn: reading
        .split(" ")
        .flatMap((spelling) => readSyllable(spelling) ?? []),
    },
    frequency: 1,
    partOfSpeech: "",
    isProperNoun: false,
  };
}

/**
 * A miniature dictionary where 后 is only ever written 後.
 */
const EMPRESS: readonly DictionaryEntry[] = [
  entry("后", "後", "hou4"),
  entry("以后", "以後", "yi3 hou4"),
  entry("后来", "後來", "hou4 lai2"),
  entry("以", "以", "yi3"),
  entry("来", "來", "lai2"),
];

describe("withUnchangedForms", () => {
  it("adds the character's own form to its rivals", () => {
    const { toTraditional } = buildScriptTables(EMPRESS);
    const widened = withUnchangedForms(toTraditional, new Set(["后"]));
    assertArrayEquals(formsOf(widened.get("后")), ["後", "后"]);
  });

  it("keeps the default", () => {
    const { toTraditional } = buildScriptTables(EMPRESS);
    const widened = withUnchangedForms(toTraditional, new Set(["后"]));
    assertIdentical(convertCharacter(widened, "后", undefined), "後");
  });

  it("leaves a character the table never converts", () => {
    const { toTraditional } = buildScriptTables(EMPRESS);
    assertFalse(withUnchangedForms(toTraditional, new Set(["以"])).has("以"));
  });

  it("adds nothing where the own form is already a rival", () => {
    const { toTraditional } = buildScriptTables([
      ...EMPRESS,
      entry("皇后", "皇后", "huang2 hou4"),
    ]);
    const widened = withUnchangedForms(toTraditional, new Set(["后"]));
    assertArrayEquals(formsOf(widened.get("后")), ["後", "后"]);
  });
});
