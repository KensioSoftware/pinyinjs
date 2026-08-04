#!/usr/bin/env node
import process from "node:process";

import { nodeEnvironment } from "./environment.js";
import { runCli } from "./run.js";

/**
 * The `pinyinjs` binary: wiring, and nothing else.
 *
 * Every decision it could make is made in {@link runCli} against an injected
 * environment, which is why this file is the one place the coverage gate does
 * not reach.
 */
const result = await runCli(process.argv.slice(2), await nodeEnvironment());

for (const line of result.output) {
  console.log(line);
}
for (const line of result.errors) {
  console.error(line);
}
process.exitCode = result.status;
