import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ReadingConfidence } from "../../src/decode/confidence.js";
import { isUncertain } from "../../src/decode/confidence.js";
import { decodeRunScored } from "../../src/decode/decode.js";
import { decodeGreedily } from "../../src/decode/greedy.js";
import { splitRuns } from "../../src/decode/runs.js";
import { applySandhi } from "../../src/decode/sandhi.js";
import type { Dictionary } from "../../src/dictionary/dictionary.js";
import { fileSource } from "../../src/dictionary/node-source.js";
import { loadDictionary } from "../../src/dictionary/source.js";
import { toCharacters } from "../../src/script/characters.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../../src/syllable/syllable.js";
import { CACHE_DIR, DATA_DIR } from "./sources.js";

/**
 * Where the CPP dataset is cached.
 *
 * Gitignored like every other upstream file. It is a benchmark rather than a
 * source: nothing in `data/` is built from it.
 */
const CPP_DIR = path.join(CACHE_DIR, "cpp");

const CPP_URL = "https://raw.githubusercontent.com/kakaobrain/g2pM/master/data";

/**
 * The splits scored, and the files each needs.
 *
 * The training split is left out: nothing here is trained, but reporting a
 * number over data a future model might fit to would invite the comparison.
 */
const SPLITS = ["dev", "test"] as const;

/**
 * The character CPP marks the annotated polyphone with.
 */
const MARK = "▁";

/**
 * One labelled polyphone: a sentence, a position in it, and the right reading.
 */
interface LabelledReading {
  readonly text: string;
  /** Character index of the marked polyphone. */
  readonly at: number;
  readonly character: string;
  readonly want: Syllable;
}

/**
 * Fetch one of the dataset's files into the cache, if it is not there already.
 */
async function fetchFile(name: string): Promise<void> {
  const cached = path.join(CPP_DIR, name);
  try {
    await readFile(cached);
    return;
  } catch {
    process.stderr.write(`fetching ${CPP_URL}/${name}\n`);
  }
  const response = await fetch(`${CPP_URL}/${name}`);
  if (!response.ok) {
    throw new Error(
      `fetching ${name} failed: ${String(response.status)} ${response.statusText}`,
    );
  }
  const downloaded = await response.arrayBuffer();
  await writeFile(cached, Buffer.from(downloaded));
}

/**
 * Fetch the dataset into the cache if it is not already there.
 */
async function fetchDataset(): Promise<void> {
  await mkdir(CPP_DIR, { recursive: true });
  await Promise.all(
    SPLITS.flatMap((split) =>
      ["sent", "lb"].map((extension) => fetchFile(`${split}.${extension}`)),
    ),
  );
}

/**
 * Read one split's sentences and labels.
 */
async function readSplit(split: string): Promise<readonly LabelledReading[]> {
  const [sentenceText, labelText] = await Promise.all([
    readFile(path.join(CPP_DIR, `${split}.sent`), "utf8"),
    readFile(path.join(CPP_DIR, `${split}.lb`), "utf8"),
  ]);
  const sentences = sentenceText.split("\n");
  const labels = labelText.split("\n");
  const cases: LabelledReading[] = [];

  for (const [line, sentence] of sentences.entries()) {
    const want = readSyllable((labels[line] ?? "").trim());
    const marked = toCharacters(sentence);
    const at = marked.indexOf(MARK);
    const character = marked[at + 1];
    if (want === undefined || at === -1 || character === undefined) {
      continue;
    }
    cases.push({
      text: marked.filter((held) => held !== MARK).join(""),
      at,
      character,
      want,
    });
  }
  return cases;
}

/**
 * One decoded syllable, with how settled the decode was about it.
 */
interface ReadReading {
  readonly syllable: Syllable;
  readonly confidence: ReadingConfidence | undefined;
}

/**
 * The syllable a word gives to one of its characters.
 *
 * Undefined where the word does not read one syllable per character, since
 * then no syllable belongs to that character on its own.
 */
function syllableOf(
  characters: number,
  reading: readonly Syllable[],
  offset: number,
): Syllable | undefined {
  return reading.length === characters ? reading[offset] : undefined;
}

/**
 * Read the syllable at a character index of a text, with its confidence.
 *
 * Sandhi is applied across each run exactly as `convert` applies it, so that 一
 * and 不 are compared in the tone the dataset writes.
 */
function readAt(
  dictionary: Dictionary,
  text: string,
  target: number,
  isGreedy: boolean,
): ReadReading | undefined {
  let offset = 0;

  for (const run of splitRuns(text)) {
    const length = toCharacters(run.text).length;
    if (!run.isHan || target >= offset + length) {
      offset += length;
      continue;
    }
    const scored = isGreedy
      ? decodeGreedily(dictionary, run.text).map((word) => ({
          word,
          confidence: [],
        }))
      : decodeRunScored(dictionary, run.text);
    const sandhied = applySandhi(
      scored.flatMap(({ word }) => [...word.reading]),
    );

    let at = offset;
    let syllableAt = 0;
    for (const { word, confidence } of scored) {
      const characters = toCharacters(word.text).length;
      if (target < at + characters) {
        const syllable = syllableOf(
          characters,
          sandhied.slice(syllableAt, syllableAt + word.reading.length),
          target - at,
        );
        return syllable === undefined
          ? undefined
          : { syllable, confidence: confidence[target - at] };
      }
      at += characters;
      syllableAt += word.reading.length;
    }
    return undefined;
  }
  return undefined;
}

/**
 * How many cases fell in one band, and how many of them were read wrongly.
 */
interface Band {
  cases: number;
  wrong: number;
}

/**
 * Which band a reading's confidence puts it in.
 */
function bandOf(confidence: ReadingConfidence | undefined): string {
  if (confidence === undefined || confidence.isLocked) {
    return "locked";
  }
  return isUncertain(confidence) ? "uncertain" : "backed by a word";
}

/**
 * A part of a whole as a percentage, to two decimal places.
 */
function percent(part: number, whole: number): string {
  return whole === 0 ? "n/a" : `${((100 * part) / whole).toFixed(2)}%`;
}

const dictionary = await loadDictionary(fileSource(DATA_DIR), "full");
await fetchDataset();

const splits = await Promise.all(SPLITS.map((split) => readSplit(split)));
const cases = splits.flat();
process.stderr.write(`${String(cases.length)} labelled polyphones\n`);

const bands = new Map<string, Band>();
const byCharacter = new Map<string, Band>();
let scored = 0;
let wrong = 0;
let greedyScored = 0;
let greedyWrong = 0;
let onlyLattice = 0;
let onlyGreedy = 0;

for (const labelled of cases) {
  const want = writeSyllable(labelled.want, "numbers");
  const read = readAt(dictionary, labelled.text, labelled.at, false);
  const greedy = readAt(dictionary, labelled.text, labelled.at, true);

  if (greedy !== undefined) {
    greedyScored++;
    if (writeSyllable(greedy.syllable, "numbers") !== want) {
      greedyWrong++;
    }
  }
  if (read === undefined) {
    continue;
  }

  const isWrong = writeSyllable(read.syllable, "numbers") !== want;
  scored++;
  if (isWrong) {
    wrong++;
  }
  if (greedy !== undefined) {
    const isGreedyWrong = writeSyllable(greedy.syllable, "numbers") !== want;
    onlyLattice += isGreedyWrong && !isWrong ? 1 : 0;
    onlyGreedy += isWrong && !isGreedyWrong ? 1 : 0;
  }

  for (const [key, into] of [
    [bandOf(read.confidence), bands],
    [labelled.character, byCharacter],
  ] as const) {
    const band = into.get(key) ?? { cases: 0, wrong: 0 };
    band.cases++;
    band.wrong += isWrong ? 1 : 0;
    into.set(key, band);
  }
}

process.stdout.write(
  [
    "",
    "CPP polyphone readings",
    "──────────────────────",
    `lattice            ${percent(scored - wrong, scored)} of ${String(scored)}`,
    `greedy baseline    ${percent(greedyScored - greedyWrong, greedyScored)} of ${String(greedyScored)}`,
    `lattice right where greedy is wrong: ${String(onlyLattice)}; the other way: ${String(onlyGreedy)}`,
    "",
    "by confidence:",
    ...[...bands]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(
        ([label, band]) =>
          `  ${label.padEnd(18)} ${String(band.cases).padStart(6)} cases  ${percent(band.wrong, band.cases).padStart(7)} wrong`,
      ),
    "",
    "worst characters (20 or more cases):",
    ...[...byCharacter]
      .filter(([, band]) => band.cases >= 20)
      .toSorted(
        ([, left], [, right]) =>
          right.wrong / right.cases - left.wrong / left.cases,
      )
      .slice(0, 15)
      .map(
        ([character, band]) =>
          `  ${character} ${percent(band.wrong, band.cases).padStart(7)} wrong of ${String(band.cases)}`,
      ),
    "",
  ].join("\n"),
);
