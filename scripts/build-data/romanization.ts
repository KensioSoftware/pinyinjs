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
import { readGwoyeu, writeGwoyeu } from "../../src/romanization/gwoyeu.js";
import {
  readIpa,
  writeIpa,
  writeIpaSymbols,
} from "../../src/romanization/ipa.js";
import {
  readWadeGiles,
  readWadeGilesLoosely,
  readWadeGilesWord,
  splitWadeGiles,
  writeWadeGiles,
  writeWadeGilesSpelling,
} from "../../src/romanization/wade-giles.js";
import {
  readYale,
  writeYale,
  writeYaleSpelling,
} from "../../src/romanization/yale.js";
import { parsePhrasePinyin } from "../../src/sources/phrase-pinyin.js";
import { DICTIONARY_SYLLABLES } from "../../src/syllable/inventory.js";
import {
  readSyllable,
  type Syllable,
  writeSyllable,
  writeSyllableSpelling,
} from "../../src/syllable/syllable.js";
import { NEUTRAL_TONE, type Tone, TONES } from "../../src/tone/tone.js";
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

/**
 * How a syllable is written in pinyin, for reporting.
 */
const written = (syllable: Syllable): string =>
  writeSyllableSpelling({ ...syllable, erhua: false });

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

/**
 * One system, in both directions, as the round trip needs it.
 *
 * `spell` is the toneless spelling, which is what the ambiguity count is over:
 * a system that writes the tone can always tell two syllables apart by it, and
 * that is not the question being asked.
 */
interface System {
  readonly name: string;
  readonly write: (syllable: Syllable) => string;
  readonly read: (text: string) => readonly Syllable[];
  readonly spell: (syllable: Syllable) => string;
}

const SYSTEMS: readonly System[] = [
  {
    name: "bopomofo",
    write: (syllable) => writeBopomofo(syllable),
    read: (text): readonly Syllable[] => {
      const read = readBopomofo(text);
      return read === undefined ? [] : [read];
    },
    spell: (syllable) => writeBopomofo(syllable),
  },
  {
    name: "Wade-Giles",
    write: (syllable) => writeWadeGiles(syllable),
    read: (text) => readWadeGiles(text),
    spell: (syllable) => writeWadeGilesSpelling(syllable),
  },
  {
    name: "Yale",
    write: (syllable) => writeYale(syllable),
    read: (text) => readYale(text),
    spell: (syllable) => writeYaleSpelling(syllable),
  },
  {
    // The same table with the tone written as a digit rather than as a mark,
    // which is the only difference between 4,240 and 5,088 for this system.
    name: "Yale, numbered",
    write: (syllable) => writeYale(syllable, { tones: "numbers" }),
    read: (text) => readYale(text),
    spell: (syllable) => writeYaleSpelling(syllable),
  },
  {
    // The tone is in the spelling rather than on it, so the analogue of a
    // toneless spelling is the basic form — every syllable in one tone.
    name: "Gwoyeu Romatzyh",
    write: (syllable) => writeGwoyeu(syllable),
    read: (text) => readGwoyeu(text),
    spell: (syllable) => writeGwoyeu({ ...syllable, tone: 1 }),
  },
  {
    name: "IPA",
    write: (syllable) => writeIpa(syllable),
    read: (text) => readIpa(text),
    spell: (syllable) => writeIpaSymbols(syllable),
  },
];

for (const system of SYSTEMS) {
  const misses = FORMS.filter((form) =>
    system.read(system.write(form)).every((found) => !isSame(found, form)),
  );
  count(`${system.name} read back exactly`, FORMS.length - misses.length);
  const unwritten = misses.filter((form) => form.tone === undefined).length;
  const neutral = misses.filter((form) => form.tone === NEUTRAL_TONE).length;
  if (unwritten > 0) {
    count("  of which the tone was unwritten", unwritten);
  }
  if (neutral > 0) {
    count("  of which the tone was neutral", neutral);
  }
  const other = misses.length - unwritten - neutral;
  if (other > 0) {
    count("  anything else", other);
    for (const form of misses.slice(0, 8)) {
      say(`    ${written(form)}${form.erhua === true ? "r" : ""}`);
    }
  }
}

say();
// Yale is counted once: the numbered variant is the same spelling table.
const DISTINCT_SYSTEMS = SYSTEMS.filter(
  (system) => system.name !== "Yale, numbered",
);
for (const system of DISTINCT_SYSTEMS) {
  const spellings = new Map<string, string[]>();
  for (const syllable of SYLLABLES) {
    const key = system.spell(syllable);
    spellings.set(key, [...(spellings.get(key) ?? []), written(syllable)]);
  }
  const shared = [...spellings].filter(([, pinyin]) => pinyin.length > 1);
  count(`distinct ${system.name} spellings`, spellings.size);
  for (const [spelling, pinyin] of shared) {
    say(`  ${spelling.padEnd(10)}${pinyin.join(", ")}`);
  }
}

// ── What Gwoyeu Romatzyh's four spellings per syllable cost ──────────────
//
// The count above holds the tone still, which is the only way to compare GR
// with a system that writes the tone separately. The question GR raises on its
// own is what happens once the tone is let loose: it spells 424 syllables four
// ways each, and every one of those spellings has to be distinct from every
// other or the reader cannot tell them apart.
say();
say("Gwoyeu Romatzyh, tone by tone");
say("─────────────────────────────");

const grForms = new Map<string, string[]>();
for (const syllable of SYLLABLES) {
  for (const tone of [1, 2, 3, 4] as const) {
    const key = writeGwoyeu({ ...syllable, tone });
    grForms.set(key, [
      ...(grForms.get(key) ?? []),
      `${written(syllable)} tone ${String(tone)}`,
    ]);
  }
}
count("syllables × the four tones", SYLLABLES.length * 4);
count("distinct spellings", grForms.size);
for (const [spelling, forms] of grForms) {
  if (forms.length > 1) {
    say(`  ${spelling.padEnd(10)}${forms.join(", ")}`);
  }
}

// ── What one Wade-Giles spelling can stand for ──────────────
//
// Twice: as written, and with the marks a real text drops.
say();
say("Wade-Giles read back");
say("────────────────────");

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
// ── And what a splitter can do with a word ──────────────
//
// The figures above are per syllable. A word run together without its hyphens
// asks two questions at once — where the boundary is, and which syllable each
// piece was — and they have very different answers, so they are counted apart.
say();
say("splitting a word written without its hyphens");
say("────────────────────────────────────────────");

interface SplitScore {
  boundary: number;
  whole: number;
}

const marked: SplitScore = { boundary: 0, whole: 0 };
const dropped: SplitScore = { boundary: 0, whole: 0 };
let multiSyllable = 0;
let boundaryMisses = 0;
let missVowel = 0;
let missN = 0;
let missYi = 0;

/** A Wade-Giles spelling with every droppable mark taken off. */
const stripMarks = (spelling: string): string =>
  spelling.replaceAll(/['êŭü]/gu, (mark) =>
    mark === "ê" ? "e" : mark === "'" ? "" : "u",
  );

const LEADING_VOWELS = new Set(["a", "e", "ê", "i", "o", "u", "ü"]);
const parsedSyllables = new Map<string, Syllable | undefined>();

for (const readings of entries.values()) {
  if (readings.length < 2) {
    continue;
  }
  const word = readings.map((reading) => {
    if (!parsedSyllables.has(reading)) {
      parsedSyllables.set(reading, readSyllable(reading));
    }
    const parsed = parsedSyllables.get(reading);
    return parsed === undefined ? undefined : { ...parsed, tone: undefined };
  });
  if (word.includes(undefined)) {
    continue;
  }
  const syllables = word as readonly Syllable[];
  multiSyllable += 1;

  const parts = syllables.map((one) =>
    writeWadeGilesSpelling(one).toLowerCase(),
  );
  const wanted = syllables.map((one) => writeSyllable(one)).join("");

  for (const [spelt, score] of [
    [parts, marked],
    [parts.map((part) => stripMarks(part)), dropped],
  ] as const) {
    const split = splitWadeGiles(spelt.join(""));
    const isBoundaryRight = split?.join("|") === spelt.join("|");
    if (isBoundaryRight) {
      score.boundary += 1;
    }
    const read = readWadeGilesWord(spelt.join(""));
    if (read?.map((one) => writeSyllable(one)).join("") === wanted) {
      score.whole += 1;
    }
    // The mechanism behind the misses, counted on the marked run: a Wade-Giles
    // syllable ends in -n or -ng and the next one starts with a vowel or n-, so
    // the boundary slides by one letter.
    if (score === marked && !isBoundaryRight && split !== undefined) {
      boundaryMisses += 1;
      let at = 0;
      while (at < spelt.length && split[at] === spelt[at]) {
        at += 1;
      }
      const next = spelt[at + 1] ?? "";
      const head = next[0] ?? "";
      if (LEADING_VOWELS.has(head)) {
        missVowel += 1;
      } else if (head === "n") {
        missN += 1;
      }
      if (next === "i") {
        missYi += 1;
      }
    }
  }
}

const ofWords = (part: number): string =>
  `${((part / multiSyllable) * 100).toFixed(2)}%`;
const ofMisses = (part: number): string =>
  `${((part / boundaryMisses) * 100).toFixed(2)}%`;

count("multi-syllable words", multiSyllable.toLocaleString("en-GB"));
count("marks kept: boundary found", ofWords(marked.boundary));
count("marks kept: word comes back", ofWords(marked.whole));
count("marks dropped: boundary found", ofWords(dropped.boundary));
count("marks dropped: word comes back", ofWords(dropped.whole));
say();
count("boundary misses, marks kept", boundaryMisses.toLocaleString("en-GB"));
count("  the next syllable starts n-", ofMisses(missN));
count("  ... or with a vowel", ofMisses(missVowel));
count(
  "  a swallowed 一, which is `i`",
  `${missYi.toLocaleString("en-GB")} (${ofMisses(missYi)})`,
);

// The names this was built for, and whether they are Wade-Giles at all.
say();
say("the names that motivate a splitter");
say("──────────────────────────────────");
for (const name of [
  "maotsetung",
  "kuomintang",
  "taipei",
  "chungking",
  "tsingtao",
  "peking",
  "nanking",
]) {
  const split = splitWadeGiles(name);
  const read = readWadeGilesWord(name);
  say(
    `  ${name.padEnd(12)}${(split?.join("-") ?? "not Wade-Giles").padEnd(20)}${
      read?.map((one) => writeSyllable(one)).join("") ?? ""
    }`,
  );
}

say();

process.stdout.write(`${lines.join("\n")}\n`);
