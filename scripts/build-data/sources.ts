import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { readZipEntries } from "./zip.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Repository root, three levels up from `scripts/build-data/`.
 */
export const ROOT = path.join(HERE, "..", "..");

/**
 * Where raw upstream files are kept.
 *
 * Gitignored: these files are not ours, they are re-released periodically, and
 * they cache perfectly well. Only the compiled artifacts are committed.
 */
export const CACHE_DIR = path.join(ROOT, ".cache");

/**
 * Where compiled artifacts are written.
 */
export const DATA_DIR = path.join(ROOT, "data");

/**
 * One upstream file, and how to get the text out of it.
 */
interface SourceDownload {
  /** Cache filename holding the downloaded bytes, before any decompression. */
  readonly download: string;
  readonly url: string;
  /**
   * Files this download yields, mapped to the name each is cached under.
   *
   * A plain file yields one; `Unihan.zip` yields the two members this pipeline
   * reads and leaves the other twenty in the archive.
   */
  readonly extract: (downloaded: Buffer) => Map<string, Buffer>;
}

/**
 * One upstream project, and every file this pipeline takes from it.
 *
 * A project rather than a file, because attribution is owed per project: OpenCC
 * publishes its four tables as four separate downloads, and a NOTICE listing
 * OpenCC four times would be noise rather than diligence.
 */
interface Source {
  /** The project the files come from, as it should be attributed. */
  readonly name: string;
  /** The licence it is published under. */
  readonly licence: string;
  /** What this package takes from it. */
  readonly provides: string;
  readonly downloads: readonly SourceDownload[];
}

/**
 * Names the pipeline refers to its cached source files by.
 */
export const SOURCE_FILES = {
  unihanReadings: "Unihan_Readings.txt",
  unihanVariants: "Unihan_Variants.txt",
  cedict: "cedict_ts.u8",
  phrasePinyin: "large_pinyin.txt",
  jieba: "jieba-dict.txt",
  simplifiedToTraditional: "STCharacters.txt",
  traditionalToSimplified: "TSCharacters.txt",
  taiwanVariants: "TWVariants.txt",
  hongKongVariants: "HKVariants.txt",
} as const;

/**
 * Where OpenCC's dictionary tables are published.
 */
const OPENCC_DICTIONARIES =
  "https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary";

/**
 * A file that needs no decompression, cached under its own name.
 */
function verbatim(name: string): SourceDownload["extract"] {
  return (downloaded: Buffer): Map<string, Buffer> =>
    new Map([[name, downloaded]]);
}

/**
 * The upstream sources, keyed by the cache file each download produces first.
 *
 * See DATA-SOURCES.md for what each one contributes and why. Unihan is taken
 * from the UCD zip rather than from mozillazg's mirror, because the mirror
 * strips `kHanyuPinlu`'s frequency counts — the one field that ranks a
 * polyphone's readings.
 */
export const SOURCES: readonly Source[] = [
  {
    name: "Unicode Han Database (Unihan)",
    licence: "Unicode License v3",
    provides:
      "single-character readings and the polyphone priors of kHanyuPinlu, plus the kSimplifiedVariant and kTraditionalVariant script variants",
    downloads: [
      {
        download: "Unihan.zip",
        url: "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip",
        extract: (downloaded: Buffer): Map<string, Buffer> => {
          const members = readZipEntries(downloaded);
          const wanted = new Map<string, Buffer>();
          for (const name of [
            SOURCE_FILES.unihanReadings,
            SOURCE_FILES.unihanVariants,
          ]) {
            const member = members.get(name);
            if (member === undefined) {
              throw new Error(`Unihan.zip is missing ${name}`);
            }
            wanted.set(name, member);
          }
          return wanted;
        },
      },
    ],
  },
  {
    name: "CC-CEDICT",
    licence: "CC BY-SA 4.0",
    provides:
      "paired 简体/繁體 headwords, the explicit r5 marker for 儿化, neutral-tone readings and the Taiwan pronunciation notes",
    downloads: [
      {
        download: "cedict.txt.gz",
        url: "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
        extract: (downloaded: Buffer): Map<string, Buffer> =>
          new Map([[SOURCE_FILES.cedict, gunzipSync(downloaded)]]),
      },
    ],
  },
  {
    name: "phrase-pinyin-data",
    licence:
      "MIT, though large_pinyin.txt merges cc_cedict.txt and is therefore CC BY-SA derived in part",
    provides: "the bulk of the multi-character word readings",
    downloads: [
      {
        download: SOURCE_FILES.phrasePinyin,
        url: "https://raw.githubusercontent.com/mozillazg/phrase-pinyin-data/master/large_pinyin.txt",
        extract: verbatim(SOURCE_FILES.phrasePinyin),
      },
    ],
  },
  {
    name: "jieba",
    licence:
      "MIT, though the dictionary's own provenance is not documented upstream; recorded here as an accepted unknown",
    provides:
      "word frequencies and the part-of-speech tags that mark proper nouns",
    downloads: [
      {
        download: SOURCE_FILES.jieba,
        url: "https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt",
        extract: verbatim(SOURCE_FILES.jieba),
      },
    ],
  },
  {
    name: "OpenCC",
    licence: "Apache-2.0",
    provides:
      "the 简体 ↔ 繁體 character tables, and the Taiwan and Hong Kong glyph form tables that separate 裡 from 裏 and 群 from 羣",
    downloads: [
      SOURCE_FILES.simplifiedToTraditional,
      SOURCE_FILES.traditionalToSimplified,
      SOURCE_FILES.taiwanVariants,
      SOURCE_FILES.hongKongVariants,
    ].map((name) => ({
      download: name,
      url: `${OPENCC_DICTIONARIES}/${name}`,
      extract: verbatim(name),
    })),
  },
];

/**
 * Whether a path exists.
 */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download and cache every upstream source that is not already cached.
 *
 * Nothing is re-fetched when the extracted files are all present, so a rebuild
 * costs no network. Pass `shouldRefresh` to refetch, which is the deliberate act
 * that produces a reviewable diff in `data/`.
 */
export async function fetchSources(shouldRefresh = false): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });

  await Promise.all(
    SOURCES.flatMap((source) =>
      source.downloads.map(async (file) => {
        const downloadPath = path.join(CACHE_DIR, file.download);

        let downloaded: Buffer;
        if (!shouldRefresh && (await exists(downloadPath))) {
          downloaded = await readFile(downloadPath);
        } else {
          process.stderr.write(`fetching ${file.url}\n`);
          const response = await fetch(file.url);
          if (!response.ok) {
            throw new Error(
              `fetching ${file.url} failed: ${String(response.status)} ${response.statusText}`,
            );
          }
          downloaded = Buffer.from(await response.arrayBuffer());
          await writeFile(downloadPath, downloaded);
        }

        await Promise.all(
          [...file.extract(downloaded)].map(([name, contents]) =>
            writeFile(path.join(CACHE_DIR, name), contents),
          ),
        );
      }),
    ),
  );
}

/**
 * Read a cached source file as text.
 */
export async function readSource(
  name: (typeof SOURCE_FILES)[keyof typeof SOURCE_FILES],
): Promise<string> {
  return readFile(path.join(CACHE_DIR, name), "utf8");
}
