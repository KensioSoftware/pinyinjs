import type { DictionaryArtifact } from "./artifact.js";
import { Dictionary } from "./dictionary.js";
import type { Tier } from "./tiers.js";

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
