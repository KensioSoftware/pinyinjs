import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { assertIdentical, assertNonNullable } from "@kensio/smartass";
import { describe, it } from "vitest";

import { GOLD_CASES } from "#test/fixtures/gold/gold-cases.js";

import { emptyTally, report, scoreCase } from "./accuracy/score.js";
import { convert, convertGreedily } from "./decode/convert.js";
import type { Dictionary } from "./dictionary/dictionary.js";
import { fileSource } from "./dictionary/node-source.js";
import { loadDictionary } from "./dictionary/source.js";

/**
 * The accuracy table in CHANGELOG.md, asserted against the scorer.
 *
 * A release note is a claim like any other, and this project has already had
 * the README's accuracy table go stale across three releases because nothing
 * executed it. The CPP figure in the same section is deliberately not here:
 * that corpus is fetched into `.cache/` rather than committed, so there is
 * nothing to score it against, and the changelog says so.
 */
const dataDirectory = fileURLToPath(new URL("../data", import.meta.url));
const dictionary = await loadDictionary(fileSource(dataDirectory), "full");
const changelog = await readFile(
  new URL("../CHANGELOG.md", import.meta.url),
  "utf8",
);

/**
 * Score the whole gold corpus with one decoder.
 */
function scored(
  decode: (dictionary: Dictionary, text: string, options?: object) => string,
): ReturnType<typeof report> {
  const tally = emptyTally();
  for (const goldCase of GOLD_CASES) {
    const actual = decode(dictionary, goldCase.hanzi, {
      ...(goldCase.locale !== undefined && { locale: goldCase.locale }),
    });
    scoreCase(goldCase.pinyin, actual, tally);
  }
  return report(tally);
}

/**
 * The table's rows, as label to the two percentages it states.
 */
function rows(): ReadonlyMap<string, readonly number[]> {
  const found = new Map<string, readonly number[]>();
  for (const line of changelog.split("\n")) {
    const match =
      /^\|\s*(?<label>[^|]*?)\s*\|\s*\**(?<lattice>[\d.]+)%\**\s*\|\s*\**(?<greedy>[\d.]+)%\**\s*\|$/u.exec(
        line,
      );
    const label = match?.groups?.["label"];
    const lattice = match?.groups?.["lattice"];
    const greedy = match?.groups?.["greedy"];
    if (label !== undefined && lattice !== undefined && greedy !== undefined) {
      found.set(label, [Number(lattice), Number(greedy)]);
    }
  }
  return found;
}

describe("the accuracy table in CHANGELOG.md", () => {
  it("states what the scorer reports, for both decoders", () => {
    const lattice = scored(convert);
    const greedy = scored(convertGreedily);
    const stated = rows();

    for (const [label, actual] of [
      ["exact match", [lattice.exact, greedy.exact]],
      ["reading accuracy", [lattice.readings, greedy.readings]],
      ["spacing (F1)", [lattice.spacing, greedy.spacing]],
    ] as const) {
      const claimed = stated.get(label);
      assertNonNullable(claimed, label);
      for (const [at, value] of actual.entries()) {
        assertIdentical(claimed[at], Number(value.toFixed(1)), label);
      }
    }
  });

  it("covers every case the corpus holds", () => {
    // The prose says "105-case gold corpus", so the number is checked too.
    assertIdentical(
      changelog.includes(`${String(GOLD_CASES.length)}-case gold corpus`),
      true,
    );
  });
});
