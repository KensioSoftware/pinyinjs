import { readScriptTables, type ScriptTables } from "../script/conversion.js";
import type { DictionaryArtifact } from "./artifact.js";
import { Dictionary } from "./dictionary.js";
import type { Tier } from "./tiers.js";
import { WordCounts } from "./word-counts.js";

/**
 * Where a dictionary's files are read from.
 *
 * The one seam between the decoder and its platform. Everything above this
 * interface is platform-neutral; below it sits `fetch` in a browser and the
 * filesystem in Node. Async throughout, because `fetch` is — a synchronous
 * file read wraps trivially, and the reverse is impossible.
 */
export interface DictionarySource {
  /** Read a named artifact file as text. */
  readonly text: (name: string) => Promise<string>;
  /** Read a named artifact file as bytes. */
  readonly bytes: (name: string) => Promise<Uint8Array>;
}

/**
 * The three files a tier is made of.
 */
export function tierFiles(tier: Tier): {
  readonly keys: string;
  readonly entries: string;
  readonly frequencies: string;
} {
  return {
    keys: `${tier}.keys`,
    entries: `${tier}.entries`,
    frequencies: `${tier}.freq`,
  };
}

/**
 * Read the files over HTTP, which is the browser path.
 *
 * Artifacts are served uncompressed and left to `Content-Encoding` — see
 * BROWSER.md, where the reasoning is that `DecompressionStream` has no brotli
 * and HTTP is the right layer for it anyway.
 */
export function fetchSource(baseUrl: string): DictionarySource {
  const at = (name: string): string => `${baseUrl.replace(/\/$/u, "")}/${name}`;
  const get = async (name: string): Promise<Response> => {
    const response = await fetch(at(name));
    if (!response.ok) {
      throw new Error(
        `fetching ${at(name)} failed: ${String(response.status)} ${response.statusText}`,
      );
    }
    return response;
  };
  return {
    text: async (name: string): Promise<string> => {
      const response = await get(name);
      return response.text();
    },
    bytes: async (name: string): Promise<Uint8Array> => {
      const response = await get(name);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

/**
 * Read a tier's three files and assemble the artifact.
 *
 * The three reads are concurrent: they are independent, and on a browser
 * connection the round trips dominate.
 */
export async function loadArtifact(
  source: DictionarySource,
  tier: Tier,
): Promise<DictionaryArtifact> {
  const files = tierFiles(tier);
  const [keys, entries, frequencies] = await Promise.all([
    source.text(files.keys),
    source.text(files.entries),
    source.bytes(files.frequencies),
  ]);
  return { keys, entries, frequencies };
}

/**
 * Load a tier and wrap it in a {@link Dictionary}.
 */
export async function loadDictionary(
  source: DictionarySource,
  tier: Tier,
): Promise<Dictionary> {
  return Dictionary.from(await loadArtifact(source, tier));
}

/**
 * The file the raw corpus counts live in.
 *
 * `full` alone, and outside the tiers rather than one per tier: a caller
 * ranking words wants the whole vocabulary ordered, and a ranking over part of
 * it answers a different question.
 */
export const COUNTS_FILE = "full.counts";

/**
 * Load the raw corpus counts for the `full` tier.
 *
 * Separate from the dictionary for the same reason {@link loadScriptTables} is.
 * Nothing on the decoding path reads counts, and the quantised frequencies the
 * decoder does read already ship inside every tier. This file is 243 KB brotli
 * against `full.freq`'s 148 KB, and only a caller that asks for it pays.
 *
 * The counts are positional over the `full` tier's keys, so pair them with a
 * `full` {@link Dictionary} and nothing else. {@link WordCounts.size} and
 * {@link Dictionary.size} agree where the two match.
 */
export async function loadWordCounts(
  source: DictionarySource,
): Promise<WordCounts> {
  return WordCounts.from(await source.bytes(COUNTS_FILE));
}

/**
 * The file the script conversion tables live in.
 *
 * One file rather than one per table, and outside the tiers rather than
 * repeated in each: script conversion does not get more accurate with a bigger
 * dictionary the way reading does, so there is nothing to tier.
 */
export const SCRIPT_FILE = "script.map";

/**
 * Load the script conversion tables.
 *
 * Separate from the dictionary on purpose. A caller converting hanzi to pinyin
 * — which is most of them — never fetches this, and a caller converting between
 * the scripts fetches about 100 KB compressed rather than carrying it inside
 * every tier. See SCRIPTS-AND-LOCALES.md.
 */
export async function loadScriptTables(
  source: DictionarySource,
): Promise<ScriptTables> {
  return readScriptTables(await source.text(SCRIPT_FILE));
}
