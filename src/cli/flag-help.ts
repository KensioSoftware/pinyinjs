/**
 * What each flag does, in one line, and how it is written in the help.
 *
 * The leaf both help tables read from: the command help and the global flag
 * help each lay these out differently, and neither owns them.
 */
/**
 * What each flag does, for the help.
 *
 * Keyed by flag name so that a command's help lists exactly the flags it takes
 * and nothing else.
 */
export const FLAG_HELP = new Map<string, string>([
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
export function flagWritten(name: string): string {
  return `--${name}${VALUE_FLAGS.has(name) ? " <value>" : ""}`;
}
