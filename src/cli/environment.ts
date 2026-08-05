import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { fileSource } from "../dictionary/node-source.js";
import { loadDictionary } from "../dictionary/source.js";
import { type ColourDepth, depthFrom } from "./colour.js";
import type { CliEnvironment } from "./run.js";

/**
 * Where the artifacts that shipped with the package are.
 *
 * Resolved from this module rather than from the working directory, so that the
 * CLI finds its own data wherever it is run from. `src/cli/` and `dist/cli/`
 * are both one directory below the package root, so one path serves the
 * compiled binary and a run straight from the sources.
 */
function shippedData(): string {
  return fileURLToPath(new URL("../../data", import.meta.url));
}

/**
 * Read a stream of text to its end.
 */
export async function readAll(input: AsyncIterable<string>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of input) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

/**
 * Read all of standard input, or nothing when it is a terminal.
 *
 * A terminal means nothing was piped in, and waiting on it would hang the
 * command with no indication of why.
 */
/* c8 ignore start -- the real process stream; readAll does the work */
async function readInput(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }
  process.stdin.setEncoding("utf8");
  // Typed here rather than at each chunk: the stream's iterator is `any`, and
  // the encoding set above is what makes every chunk a string.
  const input: AsyncIterable<string> = process.stdin;
  return readAll(input);
}
/* c8 ignore stop */

/**
 * The version a package manifest declares.
 *
 * Read out of the manifest rather than written down here, since a version
 * repeated in two places is a version that will disagree with itself.
 */
export function versionFrom(manifest: string): string {
  const parsed: unknown = JSON.parse(manifest);
  const found =
    typeof parsed === "object" && parsed !== null && "version" in parsed
      ? parsed.version
      : undefined;
  return typeof found === "string" ? found : "unknown";
}

/**
 * The package's own version, for `--version`.
 */
async function version(): Promise<string> {
  return versionFrom(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
}

/**
 * What this process's terminal says about itself.
 *
 * The reading half only: {@link depthFrom} decides what it means, so that the
 * decision is a pure function with a test rather than a sniff at the point of
 * use. Standard output is the stream asked about, since that is where a
 * command's answer goes.
 */
/* c8 ignore start -- the real process; depthFrom does the deciding */
function terminalColours(): ColourDepth {
  return depthFrom({
    isTerminal: process.stdout.isTTY,
    noColour: process.env["NO_COLOR"],
    term: process.env["TERM"],
    colorterm: process.env["COLORTERM"],
  });
}
/* c8 ignore stop */

/**
 * Wire the CLI up to Node.
 */
export async function nodeEnvironment(): Promise<CliEnvironment> {
  return {
    version: await version(),
    colours: terminalColours(),
    readInput,
    loadDictionary: async (choice) =>
      loadDictionary(
        fileSource(choice.directory ?? shippedData()),
        choice.tier,
      ),
  };
}
