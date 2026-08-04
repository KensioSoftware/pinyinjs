/**
 * Measure the romanisation tables: what round-trips, and what cannot.
 *
 * Two claims are worth numbers here, and they pull in opposite directions.
 *
 * The first is that the tables are *complete and reversible*. That one is
 * exhaustive rather than sampled: every syllable in the inventory, in every
 * tone state and with and without 儿化, written and read back.
 *
 * The second is that Wade-Giles cannot always be read back at all, which is the
 * thing ROADMAP.md named as this phase's hard part. Apostrophes and diacritics
 * are dropped constantly in the wild — `Tsingtao`, `Chungking`, `Mao Tse-tung`
 * — and once they are gone the spelling stands for several syllables. This
 * counts how many, and then asks what it costs on real vocabulary rather than
 * on the syllabary, because the two are very different questions: `chu` is one
 * spelling out of 400 and it is an extremely common one.
 *
 * The tables themselves are checked against an independent syllabary in
 * `src/romanization/syllabary.test.ts`, which is where correctness lives; this
 * script is about what the mapping can and cannot do.
 */
import {
  readBopomofo,
  writeBopomofo,
} from "../../src/romanization/bopomofo.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  writeWadeGiles,
  writeWadeGilesSpelling,
} from "../../src/romanization/wade-giles.js";
import { parsePhrasePinyin } from "../../src/sources/phrase-pinyin.js";
import { DICTIONARY_SYLLABLES } from "../../src/syllable/inventory.js";
import {
  readSyllable,
  type Syllable,
  writeSyllableSpelling,
} from "../../src/syllable/syllable.js";
import { type Tone, TONES } from "../../src/tone/tone.js";
import { readSource, SOURCE_FILES } from "./sources.js";

/**
 * Every syllable of the inventory, parsed once.
 */
const SYLLABLES: readonly Syllable[] = [...DICTIONARY_SYLLABLES].flatMap(
  (spelling) => {
    const syllable = readSyllable(spelling);
    return syllable === undefined ? [] : [syllable];
  },
);

/**
 * Every tone a syllable can be written with, including having none written.
 */
const TONE_STATES: readonly (Tone | undefined)[] = [undefined, ...TONES];

/**
 * Whether two syllables are the same in every respect.
 */
function isSame(one: Syllable, other: Syllable): boolean {
  return (
    one.initial === other.initial &&
    one.final === other.final &&
    one.tone === other.tone &&
    (one.erhua === true) === (other.erhua === true)
  );
}

/**
 * Every form the inventory takes: each syllable, each tone, with and without
 * the 儿化 suffix.
 */
const FORMS: readonly Syllable[] = SYLLABLES.flatMap((syllable) =>
  TONE_STATES.flatMap((tone) =>
    [false, true].map((erhua) => ({
      ...syllable,
      tone,
      ...(erhua && { erhua }),
    })),
  ),
);

const lines: string[] = [];

const say = (text = ""): void => {
  lines.push(text);
};

const count = (label: string, value: number | string): void => {
  say(`${label.padEnd(38)}${String(value)}`);
};

say();
say("round trip");
say("──────────");
count("syllables in the inventory", SYLLABLES.length);
count("forms (syllable × tone × 儿化)", FORMS.length);

const bopomofoMisses = FORMS.filter((form) => {
  const read = readBopomofo(writeBopomofo(form));
  return read === undefined || !isSame(read, form);
});
count("bopomofo read back exactly", FORMS.length - bopomofoMisses.length);
count(
  "  of which the tone was unwritten",
  bopomofoMisses.filter((form) => form.tone === undefined).length,
);
count(
  "  anything else",
  bopomofoMisses.filter((form) => form.tone !== undefined).length,
);

const wadeMisses = FORMS.filter((form) => {
  const read = readWadeGiles(writeWadeGiles(form));
  return read.every((candidate) => !isSame(candidate, form));
});
count("Wade-Giles read back exactly", FORMS.length - wadeMisses.length);
count("  missed", wadeMisses.length);

const distinctBopomofo = new Set(
  SYLLABLES.map((syllable) => writeBopomofo(syllable)),
);
const distinctWade = new Set(
  SYLLABLES.map((syllable) => writeWadeGilesSpelling(syllable)),
);
count("distinct bopomofo spellings", distinctBopomofo.size);
count("distinct Wade-Giles spellings", distinctWade.size);

// ── What one Wade-Giles spelling can stand for ──────────────
//
// Twice: as written, and with the marks a real text drops.
say();
say("Wade-Giles read back");
say("────────────────────");

/**
 * How a syllable is written in pinyin, for reporting.
 */
const written = (syllable: Syllable): string =>
  writeSyllableSpelling({ ...syllable, erhua: false });

/**
 * What each droppable mark looks like once it has been dropped.
 */
const DROPPED = new Map([
  ["'", ""],
  ["ê", "e"],
  ["ŭ", "u"],
  ["ü", "u"],
]);

/**
 * A spelling with all of its marks taken off, as a hurried text writes it.
 */
const sloppy = (spelling: string): string =>
  spelling.replaceAll(/['êŭü]/gu, (mark) => DROPPED.get(mark) ?? "");

/**
 * What one syllable's spelling reads back as, written properly and written
 * with its marks dropped.
 */
interface Read {
  readonly pinyin: string;
  readonly spelling: string;
  readonly exact: readonly string[];
  readonly loose: readonly string[];
}

const reads: readonly Read[] = SYLLABLES.map((syllable) => {
  const spelling = writeWadeGilesSpelling(syllable);
  return {
    pinyin: written(syllable),
    spelling,
    exact: readWadeGiles(spelling).map((found) => written(found)),
    loose: readWadeGilesLoosely(sloppy(spelling)).map((found) =>
      written(found),
    ),
  };
});

// Reported per spelling rather than per syllable, since the question is what a
// reader of one spelling gets.
const ambiguous = [...new Map(reads.map((read) => [read.spelling, read]))]
  .map(([, read]) => read)
  .filter((read) => read.exact.length > 1);
count("distinct spellings", new Set(reads.map((read) => read.spelling)).size);
count("standing for more than one syllable", ambiguous.length);
for (const read of ambiguous) {
  say(`  ${read.spelling.padEnd(10)}${read.exact.join(", ")}`);
}

say();
say("with the marks dropped");
say("──────────────────────");

count(
  "spellings carrying a droppable mark",
  reads.filter((read) => /['êŭü]/u.test(read.spelling)).length,
);
const merged = reads.filter((read) => read.loose.length > 1);
count("syllables still recovered alone", reads.length - merged.length);
count("syllables that merge with others", merged.length);

const bySize = new Map<number, number>();
for (const read of reads) {
  bySize.set(read.loose.length, (bySize.get(read.loose.length) ?? 0) + 1);
}
const sizes = [...bySize].toSorted((a, b) => a[0] - b[0]);
for (const [size, howMany] of sizes) {
  count(`  reading back as ${String(size)}`, howMany);
}

// Taking the first candidate is the one guess available without a dictionary,
// and it is not arbitrary: exact readings come first, so it amounts to
// believing that the text wrote what it meant and the marks are simply
// missing. It is right exactly where the marks-dropped spelling is somebody
// else's *correct* spelling.
const headRight = new Set(
  reads.filter((read) => read.loose[0] === read.pinyin).map((r) => r.pinyin),
);
count("first candidate is the right one", headRight.size);

say();
say("the worst of them:");
const worst = merged
  .toSorted((a, b) => b.loose.length - a.loose.length)
  .slice(0, 12);
for (const read of worst) {
  say(
    `  ${read.spelling.padEnd(9)}${sloppy(read.spelling).padEnd(9)}${read.loose.join(", ")}`,
  );
}

// ── And what that costs on real vocabulary ──────────────
//
// The syllabary counts every syllable once, which flatters nothing either way:
// the spellings that merge are not a random half of the language, and could as
// easily have been the rare half. This weights them by how often each syllable
// is actually written, over the phrase corpus the inventory itself came from.
say();
say("over the phrase corpus");
say("──────────────────────");

const merges = new Map(
  reads.map((read) => [read.pinyin, read.loose.length > 1]),
);

const entries = parsePhrasePinyin(await readSource(SOURCE_FILES.phrasePinyin));
let syllables = 0;
let ambiguousSyllables = 0;
let recovered = 0;
let unreadable = 0;
const spellings = new Map<string, string>();

for (const readings of entries.values()) {
  for (const reading of readings) {
    let spelling = spellings.get(reading);
    if (spelling === undefined) {
      const syllable = readSyllable(reading);
      spelling = syllable === undefined ? "" : writeSyllableSpelling(syllable);
      spellings.set(reading, spelling);
    }
    syllables += 1;
    const doesMerge = merges.get(spelling);
    if (doesMerge === undefined) {
      unreadable += 1;
    } else if (doesMerge) {
      ambiguousSyllables += 1;
    }
    if (headRight.has(spelling)) {
      recovered += 1;
    }
  }
}

const share = (part: number): string =>
  `${((part / syllables) * 100).toFixed(2)}%`;

count("entries", entries.size.toLocaleString("en-GB"));
count("syllables written", syllables.toLocaleString("en-GB"));
count("outside the inventory", unreadable.toLocaleString("en-GB"));
count(
  "whose marks-dropped spelling merges",
  `${ambiguousSyllables.toLocaleString("en-GB")} (${share(ambiguousSyllables)})`,
);
count(
  "recovered by taking the first",
  `${recovered.toLocaleString("en-GB")} (${share(recovered)})`,
);
say();

process.stdout.write(`${lines.join("\n")}\n`);
