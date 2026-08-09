import { toCharacters } from "../script/characters.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
import type { Syllable } from "../syllable/syllable.js";
import { decodeReading, type DictionaryArtifact } from "./artifact.js";
import { FrequencyTable } from "./frequency-table.js";
import { KeyIndex } from "./key-index.js";

/**
 * Separator between a line's columns, matching what the artifact writes.
 */
const COLUMN = "\t";

const LINE = "\n";

const ALTERNATE = ",";

const PROPER_NOUN_FLAG = "p";

/**
 * Where a proper name divides, after the proper-noun flag: `p1`, `p2.4`. *
 * `security/detect-unsafe-regex` flags the nested quantifier, and there is no
 * ambiguity behind it: a literal `.` separates `\d+` from `(?:\.\d+)*`, so no
 * input can be split between them two ways. Timed on a string of digits and
 * dots that cannot match, it is linear — 8k to 128k characters doubles the time
 * for each doubling of the input, 39µs to 607µs.
 */
const NAME_BOUNDARIES = /^p(?<at>\d+(?:\.\d+)*)$/u;

/**
 * What the dictionary knows about one word.
 */
export interface WordEntry {
  readonly word: string;
  /** 普通话 reading. */
  readonly reading: readonly Syllable[];
  /** 國語 reading, absent when it does not differ. */
  readonly taiwanReading?: readonly Syllable[];
  readonly partOfSpeech: string;
  readonly isProperNoun: boolean;
  /**
   * Where a proper name divides into its parts, in characters.
   *
   * Present only where CC-CEDICT's own capitalisation divides it: 齐白石 is
   * `[Qi2 Bai2 shi2]`, 司马迁 `[Si1 ma3 Qian1]`, 上海交通大学
   * `[Shang4 hai3 Jiao1 tong1 Da4 xue2]`. Absent for 马克思 `[Ma3 ke4 si1]`,
   * which is why a transliteration stays one word.
   */
  readonly nameBoundaries?: readonly number[];
  /**
   * Decoding cost, where lower means more likely.
   *
   * Quantised from the corpus frequency; see {@link FrequencyTable.costOf}.
   */
  readonly cost: number;
}

/**
 * A compiled dictionary, queried without being parsed.
 *
 * The blobs stay exactly as they were fetched. Only two things are computed on
 * load — the key offsets and the line offsets — and both are scans for a
 * separator rather than a parse. Individual entries are decoded lazily, the
 * first time a word is asked about, because a decode of all 722,934 would cost
 * far more than the lookups a page ever performs.
 *
 * A word is found under either script: 繁體 forms are keys in their own right,
 * so no 简体 ↔ 繁體 conversion happens on the lookup path. See
 * SCRIPTS-AND-LOCALES.md for why that shortcut would destroy accuracy.
 *
 * Regional 繁體 glyph forms *are* normalised here, and that is a different
 * thing: 裏 and 裡 are the same character in two standards with one reading, so
 * folding them together loses nothing and is what lets Hong Kong text find keys
 * at all. Only the reading is taken from the normalised form — callers keep the
 * characters the text was written with.
 */
export class Dictionary {
  /**
   * Wrap an artifact's three blobs.
   */
  static from(artifact: DictionaryArtifact): Dictionary {
    return new Dictionary(artifact);
  }

  readonly #index: KeyIndex;
  readonly #entries: string;
  readonly #lineStarts: Uint32Array;
  readonly #frequencies: FrequencyTable;
  readonly #decoded = new Map<number, WordEntry>();

  /**
   * Scan the entry blob for its line starts. Use {@link Dictionary.from}.
   */
  private constructor(artifact: DictionaryArtifact) {
    this.#index = KeyIndex.from(artifact.keys);
    this.#entries = artifact.entries;

    const starts: number[] = [0];
    let separator = this.#entries.indexOf(LINE);
    while (separator !== -1) {
      starts.push(separator + 1);
      separator = this.#entries.indexOf(LINE, separator + 1);
    }
    starts.push(this.#entries.length + 1);
    this.#lineStarts = Uint32Array.from(starts);

    this.#frequencies = FrequencyTable.from(
      artifact.frequencies,
      this.#index.size,
    );
  }

  /**
   * The columns of the line at a position.
   */
  #columns(at: number): readonly string[] {
    const start = this.#lineStarts[at];
    const nextStart = this.#lineStarts[at + 1];
    /* c8 ignore next 3 -- every position comes from a successful key lookup */
    if (start === undefined || nextStart === undefined) {
      return [];
    }
    return this.#entries.slice(start, nextStart - 1).split(COLUMN);
  }

  /**
   * The stored reading of a key, or undefined when it is not a key.
   *
   * Read from the blob without decoding the rest of the line, since deriving a
   * word's reading needs its characters' readings and nothing else about them.
   */
  #storedReading(word: string): string | undefined {
    const found = this.#index.lookup(word);
    return found.isKey ? (this.#columns(found.index)[0] ?? "") : undefined;
  }

  /**
   * Decode one line into an entry.
   */
  #decode(word: string, at: number): WordEntry {
    const [reading = "", taiwan = "", partOfSpeech = "", flags = ""] =
      this.#columns(at);

    // An empty reading means the word is read as its characters' defaults,
    // which is how 87.8% of multi-character entries are stored.
    const encoded =
      reading === ""
        ? toCharacters(word)
            .map((character) => this.#storedReading(character) ?? "")
            .join(" ")
        : reading;
    const decoded = decodeReading(encoded) ?? [];
    const taiwanReading = decodeReading(taiwan);
    const stated = NAME_BOUNDARIES.exec(flags)?.groups?.["at"];
    const nameBoundaries =
      stated === undefined ? [] : stated.split(".").map(Number);

    return {
      word,
      reading: decoded,
      ...(taiwanReading !== undefined && { taiwanReading }),
      partOfSpeech,
      isProperNoun: flags.includes(PROPER_NOUN_FLAG),
      ...(nameBoundaries.length > 0 && { nameBoundaries }),
      cost: this.#frequencies.costOf(at),
    };
  }

  /**
   * How many words the dictionary holds, counting each script's key.
   */
  get size(): number {
    return this.#index.size;
  }

  /**
   * Whether any word begins with this text. An exact match counts.
   *
   * This is the question the lattice asks at every position, and answering it
   * is what lets a scan stop as soon as no word can extend.
   */
  hasPrefix(text: string): boolean {
    return this.#index.hasPrefix(toCanonicalGlyphs(text));
  }

  /**
   * The entry for a word under either script, or undefined.
   *
   * A 繁體 word written in Hong Kong's glyph forms is normalised to the
   * Taiwan-standard forms the keys are built from, so 裏面 and 看着 find the
   * entries for 裡面 and 看著 rather than falling back to their characters. The
   * entry names the canonical spelling; the caller keeps the original text.
   */
  lookup(word: string): WordEntry | undefined {
    const canonical = toCanonicalGlyphs(word);
    const found = this.#index.lookup(canonical);
    if (!found.isKey) {
      return undefined;
    }
    const held = this.#decoded.get(found.index);
    if (held !== undefined) {
      return held;
    }
    const entry = this.#decode(canonical, found.index);
    this.#decoded.set(found.index, entry);
    return entry;
  }

  /**
   * Every reading a single character is known to take, most likely first.
   *
   * The lattice needs these for its single-character fallback edges: 行 has to
   * offer `xíng`, `háng` and `héng` at a position no word covers.
   *
   * The alternates are read off the canonical form's line, the same form
   * {@link Dictionary.lookup} found the entry under. Searching the index for
   * the raw character instead would land on the insertion point for a Hong Kong
   * glyph form that is not itself a key — 裏 sits between whatever keys
   * surround it — and take some unrelated entry's alternates.
   */
  readingsOf(character: string): readonly (readonly Syllable[])[] {
    const entry = this.lookup(character);
    if (entry === undefined) {
      return [];
    }
    const found = this.#index.lookup(toCanonicalGlyphs(character));
    const alternates = (this.#columns(found.index)[4] ?? "")
      .split(ALTERNATE)
      .map((text) => decodeReading(text))
      .filter((reading) => reading !== undefined);
    return [entry.reading, ...alternates];
  }
}
