import { fileURLToPath } from "node:url";

import {
  assertIdentical,
  assertStringIncludes,
  assertThrowsErrorAsync,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { fileSource } from "./node-source.js";
import { loadDictionary } from "./source.js";

const dataDirectory = fileURLToPath(new URL("../../data", import.meta.url));

describe("reading a dictionary off disk", () => {
  it("reads a tier's key blob as text", async () => {
    const keys = await fileSource(dataDirectory).text("core.keys");
    assertStringIncludes(keys, "银");
  });

  it("reads the frequency table as bytes", async () => {
    const bytes = await fileSource(dataDirectory).bytes("core.freq");
    assertTrue(bytes.length > 0);
  });

  it("loads a whole tier, which is how the build scripts use it", async () => {
    const dictionary = await loadDictionary(fileSource(dataDirectory), "core");
    assertIdentical(dictionary.lookup("银")?.word, "银");
  });

  it("fails loudly for a file that is not there", async () => {
    const error = await assertThrowsErrorAsync(() =>
      fileSource(dataDirectory).text("missing.keys"),
    );
    assertStringIncludes(error.message, "missing.keys");
  });
});
