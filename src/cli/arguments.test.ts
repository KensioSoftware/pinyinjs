import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertObjectEquals,
  assertInstanceOf,
  assertThrowsError,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  checkFlags,
  convertOptions,
  dictionaryChoice,
  htmlOptions,
  parseArguments,
  UsageError,
} from "./arguments.js";

describe("reading the command line", () => {
  it("takes the first positional as the command and the rest as texts", () => {
    const parsed = parseArguments(["convert", "银行", "北京"]);
    assertIdentical(parsed.command, "convert");
    assertArrayEquals(parsed.texts, ["银行", "北京"]);
  });

  it("reports no command when none was given", () => {
    const parsed = parseArguments([]);
    assertIdentical(parsed.command, "");
    assertArrayLength(parsed.texts, 0);
  });

  it("reads flags in either form", () => {
    assertObjectEquals(parseArguments(["convert", "-n", "numbers"]).flags, {
      notation: "numbers",
    });
    assertObjectEquals(
      parseArguments(["convert", "--notation", "numbers"]).flags,
      { notation: "numbers" },
    );
  });

  it("reads a negated flag, which parseArgs has no convention for", () => {
    assertObjectEquals(parseArguments(["convert", "--no-grouping"]).flags, {
      "no-grouping": true,
    });
  });

  it("refuses a flag it does not know", () => {
    const error = assertThrowsError(() =>
      parseArguments(["convert", "--tone-colour"]),
    );
    assertInstanceOf(error, UsageError);
  });

  it("keeps text that looks like a flag after a double dash", () => {
    assertArrayEquals(parseArguments(["convert", "--", "--never"]).texts, [
      "--never",
    ]);
  });
});

describe("checking a command's flags", () => {
  it("accepts a flag the command takes", () => {
    checkFlags({ notation: "numbers" }, ["notation"], "convert");
  });

  it("refuses a flag that parses but would do nothing", () => {
    const error = assertThrowsError(() => {
      checkFlags({ "no-uncertain": true }, ["notation"], "convert");
    });
    assertInstanceOf(error, UsageError);
    assertIdentical(error.message, "convert does not take --no-uncertain");
  });
});

describe("choosing a dictionary", () => {
  it("defaults to the full tier and the artifacts that shipped", () => {
    const choice = dictionaryChoice({});
    assertIdentical(choice.tier, "full");
    assertUndefined(choice.directory);
  });

  it("takes the tier and directory asked for", () => {
    const choice = dictionaryChoice({ tier: "standard", data: "./data" });
    assertIdentical(choice.tier, "standard");
    assertIdentical(choice.directory, "./data");
  });

  it("refuses a tier that does not exist", () => {
    const error = assertThrowsError(() =>
      dictionaryChoice({ tier: "enormous" }),
    );
    assertInstanceOf(error, UsageError);
    assertIdentical(
      error.message,
      "--tier must be one of core, standard, full, not enormous",
    );
  });
});

describe("turning flags into conversion options", () => {
  it("passes nothing on when nothing was asked for", () => {
    assertObjectEquals(convertOptions({}), {});
  });

  it("maps each flag to the option it names", () => {
    assertObjectEquals(
      convertOptions({
        notation: "superscript",
        locale: "zh-TW",
        apostrophe: "standard",
        capitals: "none",
        punctuation: "keep",
        "no-grouping": true,
      }),
      {
        notation: "superscript",
        locale: "zh-TW",
        apostrophe: "standard",
        capitals: "none",
        punctuation: "keep",
        grouping: false,
      },
    );
  });

  it("collects the sandhi flags into one option", () => {
    assertObjectEquals(convertOptions({ "third-tone": true }), {
      sandhi: { thirdTone: true },
    });
    assertObjectEquals(convertOptions({ "no-sandhi": true }), {
      sandhi: { yiBu: false },
    });
  });

  it("refuses a value the library does not take", () => {
    const error = assertThrowsError(() =>
      convertOptions({ notation: "pinyin" }),
    );
    assertInstanceOf(error, UsageError);
    assertIdentical(
      error.message,
      "--notation must be one of marks, numbers, superscript, none, not pinyin",
    );
  });

  it("adds the three flags that only mean anything in HTML", () => {
    assertObjectEquals(
      htmlOptions({
        "no-tone-classes": true,
        "no-uncertain": true,
        "no-lang": true,
      }),
      { toneClasses: false, markUncertain: false, lang: false },
    );
  });
});
