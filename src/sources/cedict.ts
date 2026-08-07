/**
 * One sense of one word, as CC-CEDICT records it.
 *
 * A word may have several entries, one per reading: 行 appears three times, as
 * `hang2`, `heng2` and `xing2`. That is why this is a list rather than a map.
 */
export interface CedictEntry {
  readonly traditional: string;
  readonly simplified: string;
  /**
   * Syllables in tone-numbered notation, exactly as written.
   *
   * Two conventions survive untouched, for the merge step to resolve: `u:`
   * stands for ü, as in `lu:4` for 律, and a trailing `r5` marks 儿化 rather
   * than being a syllable of its own, as in `wan2 r5` for 玩儿.
   */
  readonly readings: readonly string[];
  /**
   * Whether the reading is capitalised, which is how CC-CEDICT marks a proper
   * noun.
   *
   * Treat as corroboration rather than proof. A headword containing Latin
   * letters can read as capitalised without being a proper noun — `A圈儿` is
   * `A quan1 r5`, meaning the at sign. The primary signal is jieba's
   * `nr`/`ns`/`nt`/`nz` tags.
   */
  readonly isProperNoun: boolean;
  /**
   * The zh-TW reading, where the entry notes one.
   *
   * Reported against the whole entry even where the note is written inside one
   * sense, because an entry has one reading and cannot hold a sense's. What the
   * note actually covers is in {@link taiwanScope}, and the merge decides from
   * there whether it reaches the headword.
   */
  readonly taiwanReadings?: readonly string[];
  /**
   * How much of the entry the `Taiwan pr.` note covers.
   *
   * Present exactly when {@link taiwanReadings} is.
   */
  readonly taiwanScope?: TaiwanReadingScope;
  readonly definitions: readonly string[];
}

/**
 * How far a `Taiwan pr.` note reaches, which is written as where it sits.
 *
 * CC-CEDICT states a note three ways, and the difference is not decoration:
 *
 * - `entry` — the note is a definition of its own, as in `髮 发 [fa4] /hair/
 *   Taiwan pr. [fa3]/`. It qualifies the headword's reading, so it covers every
 *   sense.
 * - `leading` — the note is parenthesised inside the first definition, as in
 *   `和 和 [he2] /(joining two nouns) and; together with; with
 *   (Taiwan pr. [han4])/(math.) sum/…`. It covers one sense, but the sense the
 *   entry leads with.
 * - `sense` — the note is parenthesised inside a later definition, as in
 *   `從 从 [cong2] /from; through; via/…/(bound form) (Taiwan pr. [zong4])
 *   retainer; attendant/…`. It covers one sense out of several, and not the
 *   one the headword means on its own.
 */
export type TaiwanReadingScope = "entry" | "leading" | "sense";

/**
 * `traditional simplified [readings] /definitions/`.
 */
const ENTRY_LINE = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.*)\/\s*$/u;

/**
 * A note giving the Taiwan reading, whether standalone or inside a definition.
 */
const TAIWAN_READING = /Taiwan pr\. \[([^\]]+)\]/u;

/**
 * A definition that opens with a pronunciation note, rather than containing one.
 *
 * The distinction CC-CEDICT draws by parenthesising: a note **inside** a sense
 * is written `(Taiwan pr. [sheng1]) able to bear`, and one that qualifies the
 * headword's reading is written bare, as its own definition. The kind of note
 * is not always `Taiwan pr.` — 胺 opens with `colloquial pr. [an1]; Taiwan pr.
 * [an1]` — and the note is not always the whole definition either: 帆's is
 * `Taiwan pr. [fan2], except 帆布[fan1 bu4] canvas` and 傍's offers three
 * readings. All of those are still notes about the headword.
 */
const NOTE_DEFINITION = /^[\w.-]+ pr\. \[/u;

/**
 * How far an entry's `Taiwan pr.` note reaches — see {@link TaiwanReadingScope}.
 */
function taiwanScopeOf(
  definitions: readonly string[],
): TaiwanReadingScope | undefined {
  const marked = definitions.filter((definition) =>
    TAIWAN_READING.test(definition),
  );
  if (marked.length === 0) {
    return undefined;
  }
  if (marked.some((definition) => NOTE_DEFINITION.test(definition))) {
    return "entry";
  }
  return definitions.findIndex((definition) =>
    TAIWAN_READING.test(definition),
  ) === 0
    ? "leading"
    : "sense";
}

/**
 * The marker CC-CEDICT uses for a syllable whose pronunciation is unknown.
 */
const UNKNOWN_READING = /^xx\d?$/u;

/**
 * Read CC-CEDICT's exported dictionary file.
 *
 * Entries with an unknown reading are dropped: `々` is recorded as `[xx5]`, and
 * a syllable with no pronunciation cannot contribute anything to a pinyin
 * dictionary. Everything else is returned as written, including the entries
 * whose headwords are not purely Han — `95后`, `B站` and the like are genuine
 * CC-CEDICT entries, and it is the merge step's job to decide what to do with
 * them.
 */
export function parseCedict(text: string): CedictEntry[] {
  const entries: CedictEntry[] = [];

  for (const line of text.split("\n")) {
    if (line.startsWith("#")) {
      continue;
    }
    const match = ENTRY_LINE.exec(line);
    if (match === null) {
      continue;
    }

    const [, traditional = "", simplified = "", pinyin = "", body = ""] = match;
    const readings = pinyin.split(/\s+/u).filter((reading) => reading !== "");
    if (
      readings.length === 0 ||
      readings.some((r) => UNKNOWN_READING.test(r))
    ) {
      continue;
    }

    const definitions = body.split("/").filter((meaning) => meaning !== "");
    const taiwan = TAIWAN_READING.exec(body);
    const taiwanReadings = taiwan?.[1]
      ?.split(/\s+/u)
      .filter((reading) => reading !== "");
    const taiwanScope = taiwanScopeOf(definitions);

    entries.push({
      traditional: traditional.normalize("NFC"),
      simplified: simplified.normalize("NFC"),
      readings,
      isProperNoun: isCapitalised(readings[0] ?? ""),
      ...(taiwanReadings !== undefined &&
        taiwanReadings.length > 0 &&
        taiwanScope !== undefined && { taiwanReadings, taiwanScope }),
      definitions,
    });
  }

  return entries;
}

/**
 * Whether a reading is written with a capital letter.
 */
function isCapitalised(reading: string): boolean {
  const first = reading.slice(0, 1);
  return first !== first.toLowerCase();
}

/**
 * Where CC-CEDICT's own capitalisation divides a proper noun into its parts.
 *
 * GB/T 16159 5.1 writes the parts of a proper name apart, and CC-CEDICT marks
 * them by capitalising each one: 齐白石 is `[Qi2 Bai2 shi2]`, 司马迁 is
 * `[Si1 ma3 Qian1]`, 上海交通大学 is `[Shang4 hai3 Jiao1 tong1 Da4 xue2]`. So
 * the boundaries are stated by a source rather than guessed at from a surname
 * list or a list of generics — and a compound surname needs no list of compound
 * surnames.
 *
 * Returns every capitalised position after the first, which is one boundary for
 * a personal name and often two or three for an organisation: **48% of the
 * `nt`-tagged entries carrying any boundary carry more than one**, against 1.6%
 * of `nr`. Taking only the first would leave 上海交通大学 as
 * `Shànghǎi Jiāotōngdàxué`.
 *
 * Empty where there is none, which is the case that matters most: 马克思 is
 * `[Ma3 ke4 si1]`, capitalised once and never again, so Marx stays one word.
 *
 * Only meaningful where the first syllable is capitalised too — an entry
 * CC-CEDICT does not consider a proper noun has no parts to divide.
 */
export function nameBoundariesOf(
  readings: readonly string[],
): readonly number[] {
  if (readings.length < 2 || !isCapitalised(readings[0] ?? "")) {
    return [];
  }
  return readings.flatMap((reading, index) =>
    index > 0 && isCapitalised(reading) ? [index] : [],
  );
}
