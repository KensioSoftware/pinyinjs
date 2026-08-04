import { isSeparableStart } from "../syllable/separation.js";
import { splitSyllables } from "../syllable/split.js";

/**
 * When the 隔音符号 is written.
 *
 * The standard conditions it on ambiguity — 如果音节的界限发生混淆 — but in
 * practice every style guide and implementation writes it wherever a syllable
 * inside a word begins with a, o or e, so that is the default. `standard`
 * writes it only where leaving it out would genuinely read as something else.
 */
export type ApostropheStyle = "always" | "standard" | "never";

/**
 * The apostrophe pinyin uses, which is the typewriter one rather than a curly
 * quote: it is a letter of the orthography, not punctuation.
 */
const APOSTROPHE = "'";

/**
 * Whether a word's syllables would read back as themselves without any
 * apostrophes.
 *
 * Asked of the reader rather than of a rule, by putting the question to the
 * same splitter that parses input: `hǎiōu` comes apart as `hǎi` + `ōu` and so
 * needs nothing, where `Xīān` reads as the single syllable `xian` and does.
 * A word the splitter cannot read at all counts as ambiguous.
 */
function isUnambiguous(syllables: readonly string[]): boolean {
  const split = splitSyllables(syllables.join(""));
  return (
    split?.length === syllables.length &&
    split.every((read, at) => read === syllables[at])
  );
}

/**
 * Join a word's syllables, writing the 隔音符号 where the orthography wants it.
 *
 * GB/T 16159: an apostrophe goes before any syllable of a word that begins with
 * a, o or e and is not the first. 西安 is `Xī'ān`, 天安门 is `Tiān'ānmén`, and
 * 女儿 is `nǚ'ér` — which is exactly what separates it from 玩儿 `wánr`, where
 * the 儿 is a suffix on one syllable rather than a syllable of its own.
 */
export function joinWord(
  syllables: readonly string[],
  style: ApostropheStyle = "always",
): string {
  const marked = syllables.map((syllable, at) =>
    at > 0 && isSeparableStart(syllable)
      ? `${APOSTROPHE}${syllable}`
      : syllable,
  );
  const plain = syllables.join("");

  if (
    style === "never" ||
    marked.every((word) => !word.startsWith(APOSTROPHE))
  ) {
    return plain;
  }
  return style === "standard" && isUnambiguous(syllables)
    ? plain
    : marked.join("");
}
