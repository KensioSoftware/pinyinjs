import { convertGreedily } from "../../src/decode/convert.js";
import { loadDictionary } from "../../src/dictionary/source.js";
import { fileSource } from "../../src/dictionary/node-source.js";
import { emptyTally, report, scoreCase } from "../../src/accuracy/score.js";
import { GOLD_CASES } from "../../test/fixtures/gold/gold-cases.js";
import { DATA_DIR } from "./sources.js";

const dictionary = await loadDictionary(fileSource(DATA_DIR), "full");
process.stderr.write(`loaded ${String(dictionary.size)} keys\n`);

const overall = emptyTally();
const byTag = new Map<string, ReturnType<typeof emptyTally>>();
const misses: string[] = [];

for (const goldCase of GOLD_CASES) {
  const actual = convertGreedily(dictionary, goldCase.hanzi, {
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
process.stdout.write(
  [
    "",
    "greedy baseline over the gold corpus",
    "────────────────────────────────────",
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
  ].join("\n"),
);
