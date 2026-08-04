import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DictionarySource } from "./source.js";

/**
 * Read the files off disk, which is the Node path.
 *
 * **This is the only module in the library that imports a Node built-in** —
 * `src/cli/` aside, which is Node by definition and is not importable from the
 * entry point either. It is deliberately not re-exported: pulling it in from
 * the core would put `node:fs` in front of every bundler. Import it directly,
 * or leave it to the `node` export condition once the package is split.
 */
export function fileSource(directory: string): DictionarySource {
  return {
    text: async (name) => readFile(path.join(directory, name), "utf8"),
    bytes: async (name) =>
      new Uint8Array(await readFile(path.join(directory, name))),
  };
}
