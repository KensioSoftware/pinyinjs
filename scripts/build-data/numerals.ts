/**
 * Score the numerals against CC-CEDICT's own readings of its numeric headwords.
 *
 * ROADMAP.md's instruction for this phase: the merge rejects the entries whose
 * headwords carry digits, because a reading cannot be aligned to a character
 * that is not one — and those readings are a ready-made worked set. They are
 * somebody else's transcription of how the digits are said, which is exactly
 * what a numeral module has no other source for. Pull them out rather than
 * inventing examples.
 *
 * Every one of them is read digit by digit, which is itself the finding: the
 * cardinal style is unattested here, so what this scores is the digit style,
 * `yāo`, and where each belongs.
 */
import { readNumeral } from "../../src/numerals/numerals.js";
import { toCharacters } from "../../src/script/characters.js";
import { parseCedict } from "../../src/sources/cedict.js";
import { writeSyllable } from "../../src/syllable/syllable.js";
import { readSource, SOURCE_FILES } from "./sources.js";

const cedict = parseCedict(await readSource(SOURCE_FILES.cedict));

/**
 * A run of digits inside a headword, with what CC-CEDICT reads it as.
 */
interface Case {
  readonly word: string;
  readonly digits: string;
  /** The syllables CC-CEDICT gives those digits, tone-numbered. */
  readonly want: readonly string[];
}

/**
 * How many syllables a stretch of a headword is read with.
 *
 * CC-CEDICT writes one syllable per character, so a digit run of n digits takes
 * the n readings at its offset — the same alignment the merge does, and the
 * reason an unaligned entry is rejected rather than guessed at.
 */
function digitCases(word: string, readings: readonly string[]): Case[] {
  const characters = toCharacters(word);
  if (characters.length !== readings.length) {
    unaligned.push(`${word} [${readings.join(" ")}]`);
    return [];
  }
  const cases: Case[] = [];
  let at = 0;
  while (at < characters.length) {
    if (!/\d/u.test(characters[at] ?? "")) {
      at += 1;
      continue;
    }
    const from = at;
    while (/\d/u.test(characters[at] ?? "")) {
      at += 1;
    }
    cases.push({
      word,
      digits: characters.slice(from, at).join(""),
      want: readings.slice(from, at).map((reading) => reading.toLowerCase()),
    });
  }
  return cases;
}

/**
 * Headwords CC-CEDICT does not read the digits of at all.
 *
 * `11区 [11 Qu1]` writes the digits back as themselves, so the reading has
 * fewer syllables than the word has characters and nothing can be aligned to
 * them. This is exactly why the merge rejects the entry rather than storing a
 * guess, and it is worth counting rather than quietly skipping.
 */
const unaligned: string[] = [];

const withDigits = cedict.filter((entry) => /\d/u.test(entry.simplified));
const cases = withDigits.flatMap((entry) =>
  digitCases(entry.simplified, entry.readings),
);

/**
 * Whether the digits were left unread, which CC-CEDICT does for some entries.
 */
const isUnread = (found: Case): boolean => found.want.join("") === found.digits;

const read = cases.filter((found) => !isUnread(found));
const unread = cases.filter((found) => isUnread(found));

/**
 * What this module reads a run of digits as, in a style.
 */
function reading(digits: string, options: { readonly yao: boolean }): string[] {
  return (
    readNumeral(digits, { style: "digits", ...options })?.map((syllable) =>
      writeSyllable(syllable, "numbers"),
    ) ?? []
  );
}

const misses: string[] = [];
let matched = 0;
let matchedWithYao = 0;

for (const found of read) {
  const plain = reading(found.digits, { yao: false }).join(" ");
  const yao = reading(found.digits, { yao: true }).join(" ");
  const want = found.want.join(" ");
  if (plain === want) {
    matched += 1;
  } else if (yao === want) {
    matchedWithYao += 1;
  } else {
    misses.push(`  ${found.word}\t${found.digits}\twant ${want}\tgot ${plain}`);
  }
}

const lines = [
  "",
  "CC-CEDICT's numeric headwords",
  "─────────────────────────────",
  `headwords with digits  ${String(withDigits.length)}`,
  `  digits left unread   ${String(unaligned.length)} (${unaligned.join(", ")})`,
  `digit runs to score    ${String(cases.length)}`,
  `  read digit by digit  ${String(read.length)}`,
  `  read as a quantity   ${String(unread.length)}`,
  "",
  `matched, plain digits  ${String(matched)}`,
  `matched with yāo       ${String(matchedWithYao)}`,
  `missed                 ${String(misses.length)}`,
  ...(misses.length > 0 ? ["", "misses:", ...misses] : []),
  "",
];
process.stdout.write(`${lines.join("\n")}\n`);
