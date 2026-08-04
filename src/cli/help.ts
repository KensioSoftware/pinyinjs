import { type Command, COMMANDS } from "./commands.js";

/**
 * What each flag does, for the help.
 *
 * Keyed by flag name so that a command's help lists exactly the flags it takes
 * and nothing else.
 */
const FLAG_HELP = new Map<string, string>([
  ["notation", "marks (default), numbers, superscript or none"],
  ["locale", "zh-CN (default) or zh-TW"],
  ["apostrophe", "always (default), standard or never"],
  ["capitals", "auto (default), proper or none"],
  ["punctuation", "latin (default) or keep"],
  ["no-grouping", "do not apply GB/T 16159 word spacing"],
  ["third-tone", "write third-tone sandhi: nǐ hǎo becomes ní hǎo"],
  ["no-sandhi", "do not write 一 and 不 sandhi"],
  ["greedy", "decode with the old longest-match baseline"],
  ["no-tone-classes", "leave the tone classes off"],
  ["no-uncertain", "do not mark uncertain readings"],
  ["from", "pinyin, wade-giles or bopomofo (auto by default)"],
  ["data", "read the dictionary from this directory"],
  ["tier", "core, standard or full (default)"],
]);

/**
 * How wide the flag column is, which is the longest flag plus a gap.
 */
const FLAG_WIDTH = 23;

/**
 * The global flags, listed under every command's help.
 */
const GLOBAL_HELP: readonly string[] = (
  [
    ["--data <dir>", "read the dictionary from this directory"],
    ["--tier <tier>", "core, standard or full (default)"],
    ["--json", "write one JSON document per answer"],
    ["-h, --help", "show this help"],
    ["-v, --version", "show the version"],
  ] as const
).map(([flag, help]) => `  ${flag.padEnd(FLAG_WIDTH)}${help}`);

/**
 * The flags that take a value after them, as opposed to standing alone.
 */
const VALUE_FLAGS = new Set([
  "from",
  "notation",
  "locale",
  "apostrophe",
  "capitals",
  "punctuation",
]);

/**
 * A flag as the help lists it.
 */
function flagLine(name: string): string {
  const hasValue = VALUE_FLAGS.has(name);
  const written = `--${name}${hasValue ? " <value>" : ""}`;
  return `  ${written.padEnd(FLAG_WIDTH)}${FLAG_HELP.get(name) ?? ""}`;
}

/**
 * The help for one command.
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
      (command) => `  ${command.name.padEnd(10)}${command.summary}`,
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
    "  pinyinjs explain 长江大桥",
    "  pinyinjs lookup 头发",
    "  pinyinjs syllable nǐhǎo",
    "  pinyinjs romanize běijīng",
    "  cat article.txt | pinyinjs convert",
  ];
}
