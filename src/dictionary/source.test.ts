import { SAMPLE_ENTRIES } from "#test/fixtures/decoder-dictionary.js";
import {
  assertFalse,
  assertIdentical,
  assertObjectEquals,
  assertStringIncludes,
  assertThrowsErrorAsync,
  assertTrue,
} from "@kensio/smartass";
import { describe, it, vi } from "vitest";

import { buildArtifact } from "./artifact.js";
import {
  type DictionarySource,
  fetchSource,
  loadArtifact,
  loadDictionary,
  tierFiles,
} from "./source.js";

const artifact = buildArtifact(SAMPLE_ENTRIES);

/**
 * Stand in for the network, recording the URLs asked for.
 *
 * Stubbed through vitest rather than assigned onto the global, so that the
 * suite's `unstubGlobals` puts the real `fetch` back after each test. Note
 * that `restoreMocks` does not: it covers `vi.spyOn`, not `vi.stubGlobal`.
 */
function withFetch(urls: string[], response: () => Response): DictionarySource {
  vi.stubGlobal("fetch", (input: string): Promise<Response> => {
    urls.push(input);
    return Promise.resolve(response());
  });
  return fetchSource("https://example.test/data/");
}

/**
 * A source serving one artifact from memory, recording what was asked for.
 */
function memorySource(asked: string[] = []): DictionarySource {
  const files = new Map<string, string>([
    ["full.keys", artifact.keys],
    ["full.entries", artifact.entries],
  ]);
  return {
    text: (name: string): Promise<string> => {
      asked.push(name);
      return Promise.resolve(files.get(name) ?? "");
    },
    bytes: (name: string): Promise<Uint8Array> => {
      asked.push(name);
      return Promise.resolve(artifact.frequencies);
    },
  };
}

describe("loading a dictionary", () => {
  describe("tierFiles", () => {
    it("names the three files a tier is made of", () => {
      assertObjectEquals(tierFiles("full"), {
        keys: "full.keys",
        entries: "full.entries",
        frequencies: "full.freq",
      });
    });

    it("names them per tier", () => {
      assertIdentical(tierFiles("core").keys, "core.keys");
    });
  });

  describe("loadArtifact", () => {
    it("reads the three files back into an artifact", async () => {
      const loaded = await loadArtifact(memorySource(), "full");
      assertIdentical(loaded.keys, artifact.keys);
      assertIdentical(loaded.entries, artifact.entries);
    });

    it("asks for exactly the tier's three files", async () => {
      const asked: string[] = [];
      await loadArtifact(memorySource(asked), "full");
      assertIdentical(
        [...asked]
          .toSorted((left, right) => left.localeCompare(right))
          .join(","),
        "full.entries,full.freq,full.keys",
      );
    });
  });

  describe("loadDictionary", () => {
    it("wraps the loaded artifact so it can be queried", async () => {
      const dictionary = await loadDictionary(memorySource(), "full");
      assertTrue(dictionary.hasPrefix("银"));
      assertIdentical(dictionary.lookup("银行")?.word, "银行");
    });
  });

  describe("fetchSource", () => {
    it("reads a file from under the base URL", async () => {
      const urls: string[] = [];
      const source = withFetch(urls, () => new Response("keys"));
      assertIdentical(await source.text("full.keys"), "keys");
      assertIdentical(urls[0], "https://example.test/data/full.keys");
    });

    it("does not double the separator when the base URL ends in one", async () => {
      const urls: string[] = [];
      const source = withFetch(urls, () => new Response("keys"));
      await source.text("full.keys");
      assertFalse(urls[0]?.includes("//full") ?? true);
    });

    it("reads bytes for the frequency table", async () => {
      const source = withFetch([], () => new Response(new Uint8Array([7, 8])));
      const bytes = await source.bytes("full.freq");
      assertIdentical(bytes[1], 8);
    });

    it("refuses a response that is not ok, rather than caching a 404 page", async () => {
      const source = withFetch(
        [],
        () => new Response("nope", { status: 404, statusText: "Not Found" }),
      );
      const error = await assertThrowsErrorAsync(() =>
        source.text("full.keys"),
      );
      assertStringIncludes(error.message, "404");
    });
  });
});
