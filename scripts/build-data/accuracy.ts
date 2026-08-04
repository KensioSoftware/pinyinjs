import { emptyTally, report, scoreCase } from "../../src/accuracy/score.js";
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
process.stderr.write(`loaded ${String(dictionary.size)} keys\n`);

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

process.stdout.write(
  [...DECODERS.flatMap((decoder) => measure(decoder)), ...lockingRate()].join(
    "\n",
  ),
);
