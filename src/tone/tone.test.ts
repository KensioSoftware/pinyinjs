import {
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { isTone, NEUTRAL_TONE, TONES, toneFromNotation } from "./tone.js";

describe("tone", () => {
  describe("TONES", () => {
    it("covers the four contour tones plus the neutral tone", () => {
      assertArrayLength(TONES, 5);
    });
  });

  describe("isTone", () => {
    it("accepts every tone number", () => {
      for (const tone of TONES) {
        assertTrue(isTone(tone));
      }
    });

    it("rejects numbers outside the tone range", () => {
      assertFalse(isTone(0));
      assertFalse(isTone(6));
      assertFalse(isTone(-1));
      assertFalse(isTone(2.5));
      assertFalse(isTone(NaN));
    });
  });

  describe("toneFromNotation", () => {
    it("passes through tones already written the way this package writes them", () => {
      assertIdentical(toneFromNotation(1), 1);
      assertIdentical(toneFromNotation(4), 4);
      assertIdentical(toneFromNotation(5), NEUTRAL_TONE);
    });

    it("reads 0 as the neutral tone, as some notations write it", () => {
      assertIdentical(toneFromNotation(0), NEUTRAL_TONE);
    });

    it("returns undefined for anything that is not a tone", () => {
      assertUndefined(toneFromNotation(6));
      assertUndefined(toneFromNotation(-1));
      assertUndefined(toneFromNotation(1.5));
    });
  });
});
