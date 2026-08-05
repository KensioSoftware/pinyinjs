import { sampleDictionary } from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertStringIncludes,
  assertStringNotIncludes,
  assertThrowsErrorAsync,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { COMMANDS } from "./commands.js";
import { type CliEnvironment, type CliResult, runCli } from "./run.js";

const dictionary = sampleDictionary();

/**
 * An environment with nothing on standard input.
 */
function environmentOf(input = ""): CliEnvironment {
  return {
    version: "1.2.3",
    readInput: () => Promise.resolve(input),
    loadDictionary: () => Promise.resolve(dictionary),
  };
}

/**
 * Run the CLI and return everything it produced, status included.
 */
async function run(argv: readonly string[], input = ""): Promise<CliResult> {
  return runCli(argv, environmentOf(input));
}

describe("running the CLI", () => {
  it("shows the general help when given nothing", async () => {
    const result = await run([]);
    assertIdentical(result.status, 0);
    assertStringIncludes(result.output.join("\n"), "Usage: pinyinjs <command>");
  });

  it("lists every command in the general help", async () => {
    const listed = await run([]);
    const help = listed.output.join("\n");
    for (const command of COMMANDS) {
      assertStringIncludes(help, command.name);
      assertStringIncludes(help, command.summary);
      // Asserting that both appear is not enough: the column was padded to a
      // fixed 10, which is exactly the width of `transcribe`, and the summary
      // ran straight into the name while both substrings were still there.
      assertStringIncludes(help, `${command.name}  `);
    }
  });

  it("shows a command's own help, with the flags it takes", async () => {
    const shown = await run(["convert", "--help"]);
    const help = shown.output.join("\n");
    assertStringIncludes(help, "pinyinjs convert [text...]");
    assertStringIncludes(help, "--greedy");
    assertStringIncludes(help, "--tier <tier>");
  });

  it("leaves a command's own flags out of another command's help", async () => {
    const shown = await run(["lookup", "--help"]);
    const help = shown.output.join("\n");
    assertStringIncludes(help, "pinyinjs lookup <word...>");
    assertStringNotIncludes(help, "--greedy");
  });

  it("reports the version", async () => {
    const result = await run(["--version"]);
    assertArrayEquals(result.output, ["1.2.3"]);
  });

  it("refuses a command it does not have", async () => {
    const result = await run(["romanise", "银行"]);
    assertIdentical(result.status, 1);
    assertArrayLength(result.output, 0);
    assertStringIncludes(
      result.errors.join("\n"),
      "there is no romanise command",
    );
  });

  it("refuses a flag the command has no use for", async () => {
    const result = await run(["lookup", "--greedy", "银行"]);
    assertIdentical(result.status, 1);
    assertStringIncludes(
      result.errors.join("\n"),
      "lookup does not take --greedy",
    );
  });

  it("refuses a flag value the library does not take", async () => {
    const result = await run(["convert", "--notation", "bopomofo", "银行"]);
    assertIdentical(result.status, 1);
    assertStringIncludes(result.errors.join("\n"), "--notation must be one of");
  });

  it("reads standard input when given no arguments", async () => {
    const result = await run(["convert"], "银行\n北京\n");
    assertArrayEquals(result.output, ["yínháng", "Běijīng"]);
  });

  it("does not count the empty line a file ends with", async () => {
    const withNewline = await run(["convert"], "银行\n");
    const without = await run(["convert"], "银行");
    assertArrayLength(withNewline.output, 1);
    assertArrayLength(without.output, 1);
  });

  it("prefers its arguments to standard input", async () => {
    const result = await run(["convert", "北京"], "银行\n");
    assertArrayEquals(result.output, ["Běijīng"]);
  });

  it("says so when it was given nothing to work on", async () => {
    const result = await run(["convert"]);
    assertIdentical(result.status, 1);
    assertStringIncludes(result.errors.join("\n"), "convert needs [text...]");
  });

  it("shows the help of a command that takes no arguments or flags", async () => {
    const shown = await run(["info", "--help"]);
    const help = shown.output.join("\n");
    assertStringIncludes(help, "pinyinjs info");
    assertStringNotIncludes(help, "Options:");
  });

  it("lets a real failure through rather than reporting it as misuse", async () => {
    const broken: CliEnvironment = {
      ...environmentOf(),
      loadDictionary: () => Promise.reject(new Error("no artifacts there")),
    };
    const error = await assertThrowsErrorAsync(() =>
      runCli(["convert", "银行"], broken),
    );
    assertIdentical(error.message, "no artifacts there");
  });

  it("does not ask for input for a command that takes none", async () => {
    const result = await run(["info"]);
    assertIdentical(result.status, 0);
  });
});
