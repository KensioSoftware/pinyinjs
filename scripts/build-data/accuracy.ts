import { readFile } from "node:fs/promises";
import path from "node:path";

import { emptyTally, report, scoreCase } from "../../src/accuracy/score.js";
import {
  SCRIPT_EVIDENCE,
  toScript,
  toScriptPieces,
} from "../../src/decode/script.js";
import { loadScriptTables } from "../../src/dictionary/source.js";
import { detectScript } from "../../src/script/script.js";
import { convert, convertGreedily } from "../../src/decode/convert.js";
import { buildLattice } from "../../src/decode/lattice.js";
import { projectReadings } from "../../src/decode/locking.js";
import { splitRuns } from "../../src/decode/runs.js";
import type { Dictionary } from "../../src/dictionary/dictionary.js";
import { fileSource } from "../../src/dictionary/node-source.js";
import { loadDictionary } from "../../src/dictionary/source.js";
import { GOLD_CASES } from "../../test/fixtures/gold/gold-cases.js";
import { DATA_DIR } from "./sources.js";

const dictionary = await loadDictionary(fileSource(DATA_DIR), "full");
const scriptTables = await loadScriptTables(fileSource(DATA_DIR));
process.stderr.write(`loaded ${String(dictionary.size)} keys\n`);

/**
 * Every key in the shipped dictionary, which is what the round trips run over.
 */
async function keysIn(tier: string): Promise<readonly string[]> {
  const blob = await readFile(path.join(DATA_DIR, `${tier}.keys`), "utf8");
  return blob.split("\n").filter((key) => key !== "");
}

const KEYS = await keysIn("full");

const STANDARD_KEYS = await keysIn("standard");

/**
 * The keys a script writes, decided by the characters that only it uses.
 *
 * Script-neutral keys are left out. They convert to themselves in either
 * direction, so counting them would inflate every figure below with cases that
 * were never at risk.
 */
function keysOf(
  script: "Hans" | "Hant",
  keys: readonly string[],
): readonly string[] {
  return keys.filter(
    (key) =>
      detectScript(key, scriptTables.hansOnly, scriptTables.hantOnly) ===
      script,
  );
}

/**
 * How a decoder is named and invoked.
 */
interface Decoder {
  readonly name: string;
  readonly convert: (
    dictionary: Dictionary,
    text: string,
    options: { locale?: "zh-CN" | "zh-TW" },
  ) => string;
}

const DECODERS: readonly Decoder[] = [
  { name: "greedy baseline", convert: convertGreedily },
  { name: "lattice", convert },
];

/**
 * Score one decoder over the whole gold corpus.
 */
function measure(decoder: Decoder): string[] {
  const overall = emptyTally();
  const byTag = new Map<string, ReturnType<typeof emptyTally>>();
  const misses: string[] = [];

  for (const goldCase of GOLD_CASES) {
    const actual = decoder.convert(dictionary, goldCase.hanzi, {
      ...(goldCase.locale !== undefined && { locale: goldCase.locale }),
    });
    scoreCase(goldCase.pinyin, actual, overall);
    for (const tag of goldCase.tags) {
      const tally = byTag.get(tag) ?? emptyTally();
      scoreCase(goldCase.pinyin, actual, tally);
      byTag.set(tag, tally);
    }
    if (goldCase.pinyin.trim() !== actual.trim()) {
      misses.push(
        `${goldCase.hanzi}\n  want ${goldCase.pinyin}\n  got  ${actual}`,
      );
    }
  }

  const scores = report(overall);
  return [
    "",
    decoder.name,
    "─".repeat(decoder.name.length),
    `cases              ${String(overall.cases)}`,
    `exact              ${scores.exact.toFixed(1)}%`,
    `readings (w/ tone) ${scores.readings.toFixed(1)}%`,
    `bases (toneless)   ${scores.bases.toFixed(1)}%`,
    `tones              ${scores.tones.toFixed(1)}%`,
    `capitals           ${scores.capitals.toFixed(1)}%`,
    `spacing (F1)       ${scores.spacing.toFixed(1)}%`,
    "",
    "by tag:",
    ...[...byTag]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([tag, tally]) => {
        const tagged = report(tally);
        return `  ${tag.padEnd(20)} readings ${tagged.readings.toFixed(0).padStart(3)}%  spacing ${tagged.spacing.toFixed(0).padStart(3)}%  (${String(tally.cases)})`;
      }),
    "",
    `misses (${String(misses.length)} of ${String(overall.cases)}):`,
    ...misses,
    "",
  ];
}

/**
 * A part of a whole as a percentage, to one decimal place.
 */
function percent(part: number, whole: number): string {
  return ((100 * part) / whole).toFixed(1);
}

/**
 * The Han runs of every gold case, which are what the lattice is built over.
 */
function hanRuns(): readonly string[] {
  return GOLD_CASES.flatMap((goldCase) =>
    splitRuns(goldCase.hanzi)
      .filter((run) => run.isHan)
      .map((run) => run.text),
  );
}

/**
 * Measure how much of the corpus locks, which is what stage 2 claims buys the
 * design its accuracy and its speed at once.
 */
function lockingRate(): string[] {
  let positions = 0;
  let locked = 0;
  let fullyLocked = 0;
  let runs = 0;

  for (const text of hanRuns()) {
    const projection = projectReadings(buildLattice(dictionary, text));
    positions += projection.positions;
    locked += projection.lockedPositions;
    runs++;
    if (projection.lockedPositions === projection.positions) {
      fullyLocked++;
    }
  }

  return [
    "",
    "reading projection",
    "──────────────────",
    `positions locked   ${percent(locked, positions)}% (${String(locked)} of ${String(positions)})`,
    `runs fully locked  ${percent(fullyLocked, runs)}% (${String(fullyLocked)} of ${String(runs)})`,
    "",
  ];
}

/**
 * Score script conversion by round trip, over every key in the dictionary.
 *
 * No hand-labelling is needed for this and that is the point. 繁→简 is very
 * nearly deterministic, so **简→繁→简 has to be the identity** for essentially
 * every word the dictionary holds, and each failure is a real defect rather
 * than a judgement call. Hundreds of thousands of cases at no annotation cost.
 *
 * The reverse trip, 繁→简→繁, is lossy **by design** — the merges destroyed the
 * distinction — so it is reported for information and must never be read as a
 * target. The Hong Kong trip is a glyph mapping in both directions and should
 * be all but perfect; anything else means the tables disagree with each other.
 */
function roundTrips(): string[] {
  const trips = [
    { name: "简→繁→简", out: "zh-Hant", back: "zh-Hans", script: "Hans" },
    { name: "繁→简→繁", out: "zh-Hans", back: "zh-Hant", script: "Hant" },
    {
      name: "繁TW→繁HK→繁TW",
      out: "zh-Hant-HK",
      back: "zh-Hant-TW",
      script: "Hant",
    },
  ] as const;

  const lines = [
    "",
    "script conversion round trips",
    "────────────────────────────",
    "`in use` is the standard tier: every character in use plus the 50,000",
    "commonest words. `all` adds the phrase tail and the extension blocks.",
    "",
  ];
  for (const trip of trips) {
    const scopes = [
      ["in use", keysOf(trip.script, STANDARD_KEYS)],
      ["all", keysOf(trip.script, KEYS)],
    ] as const;
    for (const [scope, keys] of scopes) {
      let same = 0;
      const misses: string[] = [];
      for (const word of keys) {
        const there = toScript(dictionary, scriptTables, word, {
          to: trip.out,
        });
        const back = toScript(dictionary, scriptTables, there, {
          to: trip.back,
        });
        if (back === word) {
          same++;
        } else if (misses.length < 4) {
          misses.push(`${word}→${there}→${back}`);
        }
      }
      lines.push(
        `${trip.name.padEnd(15)} ${scope.padEnd(7)} ${percent(same, keys.length)}% ` +
          `(${String(same)} of ${String(keys.length)})`,
        misses.length > 0 ? `    e.g. ${misses.join("  ")}` : "",
      );
    }
  }
  return [...lines.filter((line, at) => line !== "" || at < 5), ""];
}

/**
 * How settled the conversion of a real corpus is, per the evidence it reports.
 */
function conversionConfidence(): string[] {
  const tally = new Map<string, number>();
  for (const text of hanRuns()) {
    const { choices } = toScriptPieces(dictionary, scriptTables, text, {
      to: "zh-Hant",
    });
    for (const choice of choices) {
      tally.set(choice.evidence, (tally.get(choice.evidence) ?? 0) + 1);
    }
  }
  let total = 0;
  for (const count of tally.values()) {
    total += count;
  }
  return [
    "conversion evidence, over the gold corpus",
    "─────────────────────────────────────────",
    ...SCRIPT_EVIDENCE.map(
      (evidence) =>
        `${evidence.padEnd(9)} ${percent(tally.get(evidence) ?? 0, total)}% (${String(tally.get(evidence) ?? 0)})`,
    ),
    "",
  ];
}

process.stdout.write(
  [
    ...DECODERS.flatMap((decoder) => measure(decoder)),
    ...lockingRate(),
    ...roundTrips(),
    ...conversionConfidence(),
  ].join("\n"),
);
