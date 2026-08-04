import {
  assertArrayEquals,
  assertArrayMinLength,
  assertArrayNotEmpty,
  assertMapSize,
  assertNonNullable,
  assertStringIncludes,
  assertThrowsErrorLike,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  OVERRIDE_READINGS,
  READING_OVERRIDES,
  readOverrideReading,
} from "./overrides.js";

describe("reading overrides", () => {
  it("holds the 大夫 case, where both sources give the archaic reading", () => {
    const reading = OVERRIDE_READINGS.get("大夫");
    assertNonNullable(reading);
    assertArrayEquals(
      reading.map((syllable) => writeSyllable(syllable)),
      ["dài", "fu"],
    );
  });

  it("reads an unwritten tone as neutral, as a source dictionary would", () => {
    const reading = OVERRIDE_READINGS.get("大夫");
    assertNonNullable(reading);
    assertTrue(reading.at(-1)?.tone === NEUTRAL_TONE);
  });

  it("parses every override, so a malformed one cannot ship", () => {
    assertArrayNotEmpty(READING_OVERRIDES);
    for (const override of READING_OVERRIDES) {
      const parsed = OVERRIDE_READINGS.get(override.word);
      assertNonNullable(parsed);
      assertArrayNotEmpty(parsed);
    }
  });

  it("gives every override a reason, so the table can be reviewed", () => {
    for (const override of READING_OVERRIDES) {
      // Long enough to actually say something.
      assertArrayMinLength(override.reason.split(" "), 6);
    }
  });

  it("stays small, since anything a rule can fix belongs in a rule", () => {
    assertTrue(
      READING_OVERRIDES.length <= 20,
      "the override table must stay small",
    );
  });

  it("indexes every override exactly once", () => {
    assertMapSize(OVERRIDE_READINGS, READING_OVERRIDES.length);
  });

  describe("readOverrideReading", () => {
    it("refuses a reading containing something that is not a syllable", () => {
      const error = assertThrowsErrorLike(() =>
        readOverrideReading({
          word: "大夫",
          reading: "dài fx",
          reason: "a typo that must not reach the dictionary",
        }),
      );
      assertStringIncludes(error.message, "is not a reading");
    });

    it("refuses an empty reading", () => {
      const error = assertThrowsErrorLike(() =>
        readOverrideReading({
          word: "大夫",
          reading: " ".repeat(3),
          reason: "an override with nothing in it",
        }),
      );
      assertStringIncludes(error.message, "has no reading");
    });
  });
});
