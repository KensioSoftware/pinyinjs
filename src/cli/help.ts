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
  ["tones", "numbers (default) or none"],
  ["require-tones", "count a syllable typed with no tone as wrong"],
  ["require-spacing", "count the word spacing towards the score"],
  ["separator", "what goes between words, - by default"],
  ["syllables", "join (default) or separate"],
  ["umlaut", "how ü is written: v (default) or u"],
  ["hash", "add a short hash of the text, to narrow collisions"],
  ["hash-length", "how many characters that hash is, 4 by default"],
  ["max-length", "the longest the slug may be, cut at a word"],
  ["fallback", "what to write where a text slugs to nothing"],
  ["read-numbers", "say the digits rather than keeping them"],
  ["query", "the pinyin to look for: beijing, bei jing or bj"],
  ["greedy", "decode with the old longest-match baseline"],
  ["system", "write it in bopomofo, wade-giles, yale, gwoyeu or ipa"],
  ["no-tone-classes", "leave the tone classes off"],
  ["no-uncertain", "do not mark uncertain readings"],
  ["no-lang", "leave the lang attribute off"],
  ["from", "pinyin, wade-giles or bopomofo (auto by default)"],
  ["to", "zh-Hans (default), zh-Hant, zh-Hant-TW or zh-Hant-HK"],
  ["from-script", "Hans or Hant, where detection cannot tell"],
  ["data", "read the dictionary from this directory"],
  ["tier", "core, standard or full (default)"],
]);

/**
 * How wide the command column is in the listing.
 *
 * Derived from the longest name rather than fixed, because a fixed 10 was
 * exactly the width of `transcribe` and ran the summary straight into it. A
 * number that has to be revisited whenever a command is added is a number that
 * will not be.
 */
const COMMAND_WIDTH =
  Math.max(...COMMANDS.map((command) => command.name.length)) + 2;

/**
 * The flags that take a value after them, as opposed to standing alone.
 */
const VALUE_FLAGS = new Set([
  "query",
  "from",
  "to",
  "from-script",
  "system",
  "notation",
  "locale",
  "apostrophe",
  "capitals",
  "punctuation",
  "tones",
  "separator",
  "syllables",
  "umlaut",
  "hash-length",
  "max-length",
  "fallback",
]);

/**
 * A flag as the help writes it, before its description.
 */
function flagWritten(name: string): string {
  return `--${name}${VALUE_FLAGS.has(name) ? " <value>" : ""}`;
}

/**
 * The global flags, listed under every command's help.
 *
 * Both spellings of the colour flags are listed rather than one being a quiet
 * alias: nobody should have to discover which of the two this command chose.
 */
const GLOBAL_FLAG_HELP = [
  ["--data <dir>", "read the dictionary from this directory"],
  ["--tier <tier>", "core, standard or full (default)"],
  ["--colour, --color", "colour the tones, terminal or not"],
  ["--no-colour, --no-color", "leave the tones uncoloured"],
  ["--json", "write one JSON document per answer"],
  ["-h, --help", "show this help"],
  ["-v, --version", "show the version"],
] as const;

/**
 * How wide the flag column is, which is the longest flag written plus a gap.
 *
 * Derived for the same reason {@link COMMAND_WIDTH} is: it was a fixed 23, and
 * `--no-colour, --no-color` is exactly 23 characters long.
 */
const FLAG_WIDTH =
  Math.max(
    ...GLOBAL_FLAG_HELP.map(([flag]) => flag.length),
    ...[...FLAG_HELP.keys()].map((name) => flagWritten(name).length),
  ) + 2;

const GLOBAL_HELP: readonly string[] = GLOBAL_FLAG_HELP.map(
  ([flag, help]) => `  ${flag.padEnd(FLAG_WIDTH)}${help}`,
);

/**
 * A flag as the help lists it.
 */
function flagLine(name: string): string {
  return `  ${flagWritten(name).padEnd(FLAG_WIDTH)}${FLAG_HELP.get(name) ?? ""}`;
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
