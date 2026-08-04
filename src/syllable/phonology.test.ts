import { assertArrayLength, assertFalse, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  FINALS,
  INITIALS,
  isFinal,
  isInitial,
  isPalatalInitial,
} from "./phonology.js";

describe("phonology", () => {
  describe("INITIALS", () => {
    it("has the 21 initials of Mandarin", () => {
      assertArrayLength(INITIALS, 21);
    });

    it("lists the retroflex initials before their first letter, so prefix matching finds them", () => {
      for (const [retroflex, single] of [
        ["zh", "z"],
        ["ch", "c"],
        ["sh", "s"],
      ] as const) {
        assertTrue(INITIALS.indexOf(retroflex) < INITIALS.indexOf(single));
      }
    });
  });

  describe("isInitial", () => {
    it("accepts every initial", () => {
      for (const initial of INITIALS) {
        assertTrue(isInitial(initial));
      }
    });

    it("accepts the empty string, since a syllable may have no initial", () => {
      assertTrue(isInitial(""));
    });

    it("rejects letters that are not initials", () => {
      assertFalse(isInitial("y"));
      assertFalse(isInitial("w"));
      assertFalse(isInitial("v"));
      assertFalse(isInitial("zzz"));
    });
  });

  describe("isFinal", () => {
    it("accepts every final", () => {
      for (const final of FINALS) {
        assertTrue(isFinal(final));
      }
    });

    it("rejects strings that are not finals", () => {
      assertFalse(isFinal(""));
      assertFalse(isFinal("q"));
      assertFalse(isFinal("aeiou"));
    });
  });

  describe("isPalatalInitial", () => {
    it("identifies the initials after which a written u is really ü", () => {
      assertTrue(isPalatalInitial("j"));
      assertTrue(isPalatalInitial("q"));
      assertTrue(isPalatalInitial("x"));
    });

    it("rejects the initials after which a written u is really u", () => {
      assertFalse(isPalatalInitial("g"));
      assertFalse(isPalatalInitial("l"));
      assertFalse(isPalatalInitial("zh"));
      assertFalse(isPalatalInitial(""));
    });
  });
});
