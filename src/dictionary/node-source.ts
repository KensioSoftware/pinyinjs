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
 * or reach it through the `./node` subpath, which is what it is there for.
 */
export function fileSource(directory: string): DictionarySource {
  return {
    // The directory is this function's whole argument, so
    // `security/detect-non-literal-fs-filename` is describing the API rather
    // than a defect: a loader that could only read a literal path would have
    // nothing to offer. `name` is not user input — it comes from `tierFiles`,
    // which returns a fixed set of artifact names.
    text: async (name) => readFile(path.join(directory, name), "utf8"),
    bytes: async (name) =>
      new Uint8Array(await readFile(path.join(directory, name))),
  };
}
