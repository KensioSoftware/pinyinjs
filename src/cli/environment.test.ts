import { assertIdentical, assertTrue } from "@kensio/smartass";
import { describe, it } from "vitest";

import { nodeEnvironment, readAll, versionFrom } from "./environment.js";

/**
 * A stream of text, as a stream.
 */
function streamed(...chunks: readonly string[]): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]: () => {
      let at = 0;
      return {
        next: () =>
          Promise.resolve(
            at < chunks.length
              ? { value: chunks[at++] ?? "", done: false }
              : { value: "", done: true },
          ),
      };
    },
  };
}

describe("reading a stream to its end", () => {
  it("joins the chunks back into the text they came from", async () => {
    assertIdentical(await readAll(streamed("银", "行\n北京")), "银行\n北京");
  });

  it("reads an empty stream as no text at all", async () => {
    assertIdentical(await readAll(streamed()), "");
  });
});

describe("reading a version out of a manifest", () => {
  it("takes the version the manifest declares", () => {
    assertIdentical(versionFrom('{"version": "1.2.3"}'), "1.2.3");
  });

  it("says so when there is no version to read", () => {
    assertIdentical(versionFrom("{}"), "unknown");
    assertIdentical(versionFrom('{"version": 3}'), "unknown");
    assertIdentical(versionFrom("null"), "unknown");
  });
});

describe("the Node environment", () => {
  it("reports the package's own version", async () => {
    const environment = await nodeEnvironment();
    assertTrue(/^\d+\.\d+\.\d+/u.test(environment.version));
  });

  it("finds the artifacts that shipped, wherever it is run from", async () => {
    const environment = await nodeEnvironment();
    const dictionary = await environment.loadDictionary({
      tier: "core",
      directory: undefined,
    });
    assertTrue(dictionary.size > 0);
  });
});
