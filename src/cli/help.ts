import { type Command, COMMANDS } from "./commands.js";
import { flagLine, GLOBAL_HELP } from "./global-help.js";

/**
 * How wide the command column is, derived rather than written down.
 *
 * Hard-coding it was how the table last went wrong: a fixed 12 was exactly
 * the width of `transcribe` and ran the summary straight into it. A
 * number that has to be revisited whenever a command is added is a number that
 * will not be.
 */
const COMMAND_WIDTH =
  Math.max(...COMMANDS.map((command) => command.name.length)) + 2;

/**
 * The help for one command: what it does, and the flags it takes.
 */
export function commandHelp(command: Command): readonly string[] {
  return [
    `pinyinjs ${command.name}${command.argument === "" ? "" : ` ${command.argument}`}`,
    "",
    `  ${command.summary}.`,
    ...(command.argument.startsWith("[")
      ? ["", "  Reads standard input when given no arguments."]
      : []),
    ...(command.flags.length > 0
      ? ["", "Options:", ...command.flags.map((flag) => flagLine(flag))]
      : []),
    "",
    "Options for every command:",
    ...GLOBAL_HELP,
  ];
}

/**
 * The help shown when no command was given.
 */
export function generalHelp(): readonly string[] {
  return [
    "pinyinjs — Chinese hanzi and pinyin, from the command line",
    "",
    "Usage: pinyinjs <command> [arguments] [options]",
    "",
    "Commands:",
    ...COMMANDS.map(
      (command) => `  ${command.name.padEnd(COMMAND_WIDTH)}${command.summary}`,
    ),
    "",
    "Options for every command:",
    ...GLOBAL_HELP,
    "",
    "Run pinyinjs <command> --help for a command's own options.",
    "",
    "Examples:",
    "  pinyinjs convert 我要去北京。",
    "  pinyinjs convert --notation numbers 银行",
    "  pinyinjs slug 我想学中文。",
    "  pinyinjs explain 长江大桥",
    "  pinyinjs lookup 头发",
    "  pinyinjs match --query bjdx 北京大学 上海大学",
    "  pinyinjs syllable nǐhǎo",
    "  pinyinjs transcribe běijīng",
    "  cat article.txt | pinyinjs convert",
  ];
}
