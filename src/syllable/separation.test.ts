import { assertFalse, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import { isSeparableStart } from "./separation.js";

describe("separable vowels", () => {
  it("recognises a, o and e however their tone is written", () => {
    assertTrue(isSeparableStart("ān"));
    assertTrue(isSeparableStart("an1"));
    assertTrue(isSeparableStart("ǎo"));
    assertTrue(isSeparableStart("ér"));
    assertTrue(isSeparableStart("ōu"));
  });

  it("recognises them capitalised", () => {
    assertTrue(isSeparableStart("Ān"));
  });

  it("rejects i, u and ü, which surface as y and w", () => {
    assertFalse(isSeparableStart("yī"));
    assertFalse(isSeparableStart("wán"));
    assertFalse(isSeparableStart("ǖ"));
  });

  it("rejects a syllable with an initial, and empty text", () => {
    assertFalse(isSeparableStart("běi"));
    assertFalse(isSeparableStart(""));
  });
});
