import { assertArrayEquals } from "@kensio/smartass";
import { describe, it } from "vitest";

import { rewriteParts } from "./parts.js";

describe("applying a text pass across separate parts", () => {
  it("reads across a part boundary rather than restarting at it", () => {
    // The pass sees `ab`, not `a` and then `b`.
    assertArrayEquals(
      rewriteParts(["a", "b"], (characters) =>
        characters.map((character, at) =>
          at === 0 ? character : `${character}!`,
        ),
      ),
      ["a", "b!"],
    );
  });

  it("gives each part back exactly the characters it owned", () => {
    assertArrayEquals(
      rewriteParts(["one", "two", "three"], (characters) =>
        characters.map((character) => character.toUpperCase()),
      ),
      ["ONE", "TWO", "THREE"],
    );
  });

  it("lets a pass write a character as more than one, or as none", () => {
    assertArrayEquals(
      rewriteParts(["a,", "b"], (characters) =>
        characters.map((character) => (character === "," ? ", " : character)),
      ),
      ["a, ", "b"],
    );
    assertArrayEquals(
      rewriteParts(["a,", "b"], (characters) =>
        characters.map((character) => (character === "," ? "" : character)),
      ),
      ["a", "b"],
    );
  });

  it("keeps an empty part, so that the parts still line up", () => {
    assertArrayEquals(
      rewriteParts(["a", "", "b"], (characters) => characters),
      ["a", "", "b"],
    );
  });

  it("keeps a character outside the basic plane in one piece", () => {
    assertArrayEquals(
      rewriteParts(["𠮷"], (characters) =>
        characters.map(
          (character) => `${character}${String(character.length)}`,
        ),
      ),
      ["𠮷2"],
    );
  });

  it("has nothing to do with no parts at all", () => {
    assertArrayEquals(
      rewriteParts([], (characters) => characters),
      [],
    );
  });
});
