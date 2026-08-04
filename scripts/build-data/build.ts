import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

import {
  buildArtifact,
  findRoundTripFailure,
} from "../../src/dictionary/artifact.js";
import { checkBuild } from "../../src/dictionary/assertions.js";
import { mergeSources } from "../../src/dictionary/merge.js";
import { selectTier, TIERS } from "../../src/dictionary/tiers.js";
import { parseCedict } from "../../src/sources/cedict.js";
import { parseJiebaDictionary } from "../../src/sources/jieba.js";
import { parsePhrasePinyin } from "../../src/sources/phrase-pinyin.js";
import {
  parseUnihanReadings,
  parseUnihanVariants,
} from "../../src/sources/unihan.js";
import {
  DATA_DIR,
  fetchSources,
  readSource,
  ROOT,
  SOURCE_FILES,
  SOURCES,
} from "./sources.js";

/**
 * Write a line of progress.
 */
function report(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * A size in kibibytes, for the build report.
 */
function kilobytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * The brotli size of an artifact file, which is what a browser downloads.
 *
 * Artifacts are committed uncompressed and served with `Content-Encoding: br`,
 * since `DecompressionStream` has no brotli — see BROWSER.md. The figure is
 * measured here so a refresh that bloats the download is visible in the build
 * output rather than only on a CDN bill.
 */
function compressedSize(contents: string | Uint8Array): number {
  return brotliCompressSync(contents, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
}

await fetchSources(process.argv.includes("--refresh"));

report("parsing sources");
const sources = {
  unihanReadings: parseUnihanReadings(
    await readSource(SOURCE_FILES.unihanReadings),
  ),
  unihanVariants: parseUnihanVariants(
    await readSource(SOURCE_FILES.unihanVariants),
  ),
  phrase: parsePhrasePinyin(await readSource(SOURCE_FILES.phrasePinyin)),
  cedict: parseCedict(await readSource(SOURCE_FILES.cedict)),
  jieba: parseJiebaDictionary(await readSource(SOURCE_FILES.jieba)),
};

report(
  `  Unihan ${String(sources.unihanReadings.size)} characters, ` +
    `phrase corpus ${String(sources.phrase.size)}, ` +
    `CC-CEDICT ${String(sources.cedict.length)}, ` +
    `jieba ${String(sources.jieba.size)}`,
);

report("merging");
const merged = mergeSources(sources);
for (const [name, value] of Object.entries(merged.stats)) {
  report(`  ${name.padEnd(24)} ${String(value)}`);
}
report(`  ${"entries".padEnd(24)} ${String(merged.entries.length)}`);

// ── The quality gate: fail, never warn ──────────────────────
const failures = checkBuild(merged.entries);
if (failures.length > 0) {
  for (const failure of failures) {
    report(`FAILED: ${failure}`);
  }
  throw new Error(
    `${String(failures.length)} build assertion(s) failed; no artifact written`,
  );
}
report(`  all build assertions pass`);

await mkdir(DATA_DIR, { recursive: true });

interface TierManifest {
  readonly entries: number;
  readonly keys: string;
  readonly readings: string;
  readonly frequencies: string;
  readonly bytes: number;
  readonly compressedBytes: number;
}

// Every tier is compiled and checked before anything is written, so that a
// tier failing its round trip leaves no half-written `data/` behind.
const compiled = TIERS.map((tier) => {
  const entries = selectTier(merged.entries, tier);
  const artifact = buildArtifact(entries);

  const drifted = findRoundTripFailure(entries, artifact);
  if (drifted !== undefined) {
    throw new Error(
      `the ${tier} artifact does not read ${drifted} back as it was built`,
    );
  }

  const files = {
    keys: `${tier}.keys`,
    readings: `${tier}.entries`,
    frequencies: `${tier}.freq`,
  };
  const bytes =
    Buffer.byteLength(artifact.keys) +
    Buffer.byteLength(artifact.entries) +
    artifact.frequencies.length;
  const compressedBytes =
    compressedSize(artifact.keys) +
    compressedSize(artifact.entries) +
    compressedSize(artifact.frequencies);

  report(
    `  ${tier.padEnd(9)} ${String(entries.length).padStart(7)} entries  ` +
      `${kilobytes(bytes).padStart(10)}  ${kilobytes(compressedBytes).padStart(10)} brotli`,
  );

  return {
    tier,
    artifact,
    manifest: {
      entries: entries.length,
      ...files,
      bytes,
      compressedBytes,
    } satisfies TierManifest,
  };
});

const manifest: Record<string, TierManifest> = Object.fromEntries(
  compiled.map(({ tier, manifest: entry }) => [tier, entry]),
);

const manifestJson = JSON.stringify(
  {
    tiers: manifest,
    sources: SOURCES.map((source) => source.url),
    rejected: merged.rejected.size,
  },
  undefined,
  2,
);

/**
 * Sources this repository holds but does not ship inside the artifacts.
 *
 * A share-alike table checked into `test/` is still somebody's work and still
 * wants attribution, and putting it here rather than in a comment is what keeps
 * it from being lost the next time NOTICE is regenerated.
 */
const TESTED_AGAINST = [
  {
    name: "Comparison of Chinese transcription systems (Wikipedia)",
    url: "https://en.wikipedia.org/wiki/Comparison_of_Chinese_transcription_systems",
    licence: "CC BY-SA 4.0",
    provides:
      "the 417-row syllabary in test/fixtures/syllabary.ts, which the bopomofo and Wade-Giles tables are checked against",
    note: "used by the tests only; nothing in data/ is derived from it",
  },
] as const;

// Attribution is generated rather than hand-written, so that it cannot drift
// from what the artifacts were actually built from.
const notice = [
  "pinyinjs",
  "Copyright Kensio Software",
  "",
  "Licensed under the Apache License, Version 2.0, except for the compiled",
  "dictionaries in data/, which are derived from the sources listed below and",
  "carry their terms. CC-CEDICT is CC BY-SA 4.0, so anything derived from it is",
  "share-alike; DATA-SOURCES.md records why it is used regardless.",
  "",
  "Generated by scripts/build-data/build.ts. Do not edit.",
  "",
  ...SOURCES.flatMap((source) => [
    `## ${source.name}`,
    "",
    `Source:   ${source.url}`,
    `Licence:  ${source.licence}`,
    `Provides: ${source.provides}`,
    "",
  ]),
  ...TESTED_AGAINST.flatMap((source) => [
    `## ${source.name}`,
    "",
    `Source:   ${source.url}`,
    `Licence:  ${source.licence}`,
    `Provides: ${source.provides}`,
    `Note:     ${source.note}`,
    "",
  ]),
].join("\n");

const written = compiled.flatMap(({ artifact, manifest: files }) => [
  writeFile(path.join(DATA_DIR, files.keys), artifact.keys),
  writeFile(path.join(DATA_DIR, files.readings), artifact.entries),
  writeFile(path.join(DATA_DIR, files.frequencies), artifact.frequencies),
]);
written.push(
  writeFile(path.join(DATA_DIR, "manifest.json"), `${manifestJson}\n`),
  writeFile(path.join(ROOT, "NOTICE"), notice),
);
await Promise.all(written);

report("artifacts written to data/, attribution to NOTICE");
