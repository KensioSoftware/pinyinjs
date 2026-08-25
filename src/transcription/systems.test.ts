import { assertArrayLength, assertIdentical } from "@kensio/smartass";
import { describe, it } from "vitest";

import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { TONES } from "../tone/tone.js";
import {
  BOPOMOFO,
  IPA,
  TRANSCRIPTION_SYSTEMS,
  transcriptionSystemNamed,
  WADE_GILES,
} from "./systems.js";

/**
 * Every syllable of the inventory in every tone state, with and without 儿化.
 *
 * The 5,088 forms `pnpm transcription` scores. What is being checked against
 * them is that taking a system's word writer apart into a syllable write and a
 * separator changes nothing it writes.
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

describe("the systems table", () => {
  it("covers the inventory the romanisation phase measured", () => {
    assertArrayLength(everyForm(), 5088);
  });

  it("writes a word exactly as the syllables and the separator do", () => {
    // The one thing a caller marking up a syllable at a time depends on: that
    // a word is its syllables joined, and that nothing is decided across the
    // join. Both tone states, since a system that can leave the tone off has
    // two spellings to keep in step.
    const forms = everyForm();
    for (const system of TRANSCRIPTION_SYSTEMS) {
      for (const hasTones of [true, false]) {
        for (let at = 0; at + 1 < forms.length; at += 2) {
          const word = forms.slice(at, at + 2);
          assertIdentical(
            word
              .map((syllable) => system.write(syllable, hasTones))
              .join(system.separator),
            system.word(word, hasTones),
            `${system.name} ${String(hasTones)}`,
          );
        }
      }
    }
  });

  it("leaves the tone on where the system spells it in", () => {
    // Bopomofo marks the tone with a symbol of the script and Gwoyeu Romatzyh
    // spells it into the syllable, so neither has anything to leave off.
    const jiu = readSyllable("jiù");
    assertIdentical(jiu === undefined, false);
    if (jiu === undefined) {
      return;
    }
    assertIdentical(BOPOMOFO.write(jiu, false), "ㄐㄧㄡˋ");
    assertIdentical(WADE_GILES.write(jiu, false), "chiu");
    assertIdentical(WADE_GILES.write(jiu, true), "chiu⁴");
  });

  it("names the script and the variant the IANA registry has", () => {
    // Yale and Gwoyeu Romatzyh have no registered variant, so neither names
    // itself and both go out as plain zh-Latn.
    assertIdentical(BOPOMOFO.script, "Bopo");
    assertIdentical(BOPOMOFO.variant, undefined);
    assertIdentical(WADE_GILES.variant, "wadegile");
    assertIdentical(IPA.variant, "fonipa");
    assertIdentical(transcriptionSystemNamed("yale")?.variant, undefined);
    assertIdentical(transcriptionSystemNamed("gwoyeu")?.variant, undefined);
  });

  it("answers to its own name and to nothing else", () => {
    assertIdentical(transcriptionSystemNamed("bopomofo"), BOPOMOFO);
    assertIdentical(transcriptionSystemNamed("pinyin"), undefined);
    assertIdentical(transcriptionSystemNamed(undefined), undefined);
  });
});
