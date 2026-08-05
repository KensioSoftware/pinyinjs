import {
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertSetSize,
  assertStringEndsWith,
  assertStringIncludes,
  assertStringNotIncludes,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { TONES } from "../tone/tone.js";
import {
  type ColourDepth,
  depthFrom,
  paletteAt,
  painterFor,
  PLAIN,
  type TerminalSignals,
  visibleLength,
} from "./colour.js";

/**
 * A terminal that can show colour and says nothing else about itself.
 */
function terminal(signals: Partial<TerminalSignals> = {}): TerminalSignals {
  return {
    isTerminal: true,
    noColour: undefined,
    term: "xterm",
    colorterm: undefined,
    ...signals,
  };
}

describe("deciding how much colour to write", () => {
  it("colours a terminal and leaves a pipe alone", () => {
    assertIdentical(depthFrom(terminal()), 16);
    assertIdentical(depthFrom(terminal({ isTerminal: false })), 0);
  });

  it("honours NO_COLOR whenever it says anything at all", () => {
    assertIdentical(depthFrom(terminal({ noColour: "1" })), 0);
    assertIdentical(depthFrom(terminal({ noColour: "no" })), 0);
    // The convention is that the empty string does not count as set.
    assertIdentical(depthFrom(terminal({ noColour: "" })), 16);
  });

  it("takes a terminal that says it is dumb at its word", () => {
    assertIdentical(depthFrom(terminal({ term: "dumb" })), 0);
    assertIdentical(depthFrom(terminal({ term: undefined })), 0);
  });

  it("writes the extended palette where the terminal has one", () => {
    assertIdentical(depthFrom(terminal({ term: "xterm-256color" })), 256);
    assertIdentical(depthFrom(terminal({ colorterm: "truecolor" })), 256);
    assertIdentical(depthFrom(terminal({ colorterm: "24bit" })), 256);
    assertIdentical(depthFrom(terminal({ term: "xterm-direct" })), 256);
  });

  it("falls back to the sixteen every terminal has", () => {
    assertIdentical(depthFrom(terminal({ term: "vt100" })), 16);
    assertIdentical(depthFrom(terminal({ colorterm: "" })), 16);
  });
});

describe("painting a syllable", () => {
  it("writes nothing at all at depth 0", () => {
    const paint = painterFor(0);
    assertIdentical(paint("běi", 3), "běi");
    assertIdentical(PLAIN("běi", 3), "běi");
  });

  it("wraps a toned syllable and puts the terminal back afterwards", () => {
    const painted = painterFor(16)("běi", 3);
    assertStringIncludes(painted, "\u{1B}[32m");
    assertStringIncludes(painted, "běi");
    assertStringEndsWith(painted, "\u{1B}[0m");
  });

  it("gives the four contour tones four different colours", () => {
    const paint = painterFor(256);
    const escapes = new Set([1, 2, 3, 4].map((tone) => paint("a", tone as 1)));
    assertSetSize(escapes, 4);
  });

  it("leaves the neutral tone and an unwritten one uncoloured", () => {
    // MDBG's fifth colour is the page's own text colour — `#000000` on a light
    // page and `#ffffff` on a dark one — which in a terminal is no escape at
    // all. It has no colour for a tone that was never written either.
    for (const depth of [16, 256] as const) {
      assertIdentical(painterFor(depth)("de", 5), "de");
      assertIdentical(painterFor(depth)("bei", undefined), "bei");
    }
  });

  it("leaves empty text alone rather than writing a bare escape", () => {
    assertIdentical(painterFor(16)("", 1), "");
  });

  it("writes the extended palette differently from the basic one", () => {
    assertStringIncludes(painterFor(256)("bēi", 1), "\u{1B}[38;5;196m");
    assertStringIncludes(painterFor(16)("bēi", 1), "\u{1B}[91m");
  });
});

describe("the palette", () => {
  it("covers the four contour tones and no others", () => {
    const entries = paletteAt(256);
    assertArrayLength(entries, 4);
    assertIdentical(
      entries.map((one) => one.tone).join(","),
      TONES.filter((tone) => tone !== 5).join(","),
    );
  });

  it("carries MDBG's own values, which is what pins it to a source", () => {
    assertIdentical(
      paletteAt(16)
        .map((one) => one.mdbg)
        .join(" "),
      "#ff0000 #d09000 #00a000 #0044ff",
    );
  });

  it("writes an escape a terminal understands at either depth", () => {
    for (const depth of [16, 256] as const) {
      for (const entry of paletteAt(depth)) {
        assertStringIncludes(entry.escape, "\u{1B}[");
        assertStringEndsWith(entry.escape, "m");
      }
    }
    assertStringNotIncludes(paletteAt(16)[0]?.escape ?? "", "38;5;");
  });
});

describe("measuring a coloured line", () => {
  it("counts what a reader sees rather than what is written", () => {
    const painted = painterFor(256)("běi", 3);
    assertIdentical(visibleLength(painted), 3);
    assertStringIncludes(painted, "\u{1B}[");
  });

  it("counts plain text as its own length", () => {
    assertIdentical(visibleLength("běi hǎo"), 7);
    assertIdentical(visibleLength(""), 0);
  });

  it("counts every escape in a line of several syllables", () => {
    const paint = painterFor(16);
    const line = [paint("běi", 3), paint("jīng", 1)].join(" ");
    assertIdentical(visibleLength(line), 8);
  });
});

describe("every depth", () => {
  it("is one of the three the type allows", () => {
    const depths: readonly ColourDepth[] = [0, 16, 256];
    for (const depth of depths) {
      const paint = painterFor(depth);
      const painted = paint("bēi", 1);
      assertNonNullable(painted);
      assertIdentical(visibleLength(painted), 3);
    }
  });
});
