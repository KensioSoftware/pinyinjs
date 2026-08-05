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
   * CC-CEDICT writes these two ways: as a definition of its own
   * (`/Taiwan pr. [fa3]/`) and buried inside one
   * (`/behavior; conduct (Taiwan pr. [xing4])/`). The second form belongs to
   * that sense alone, which this cannot express, so it is reported against the
   * whole entry.
   */
  readonly taiwanReadings?: readonly string[];
  readonly definitions: readonly string[];
}

/**
 * `traditional simplified [readings] /definitions/`.
 */
const ENTRY_LINE = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.*)\/\s*$/u;

/**
 * A note giving the Taiwan reading, whether standalone or inside a definition.
 */
const TAIWAN_READING = /Taiwan pr\. \[([^\]]+)\]/u;

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

    entries.push({
      traditional: traditional.normalize("NFC"),
      simplified: simplified.normalize("NFC"),
      readings,
      isProperNoun: isCapitalised(readings[0] ?? ""),
      ...(taiwanReadings !== undefined &&
        taiwanReadings.length > 0 && { taiwanReadings }),
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
 * Where CC-CEDICT's own capitalisation puts a boundary inside a proper noun.
 *
 * 毛泽东 is written `[Mao2 Ze2 dong1]` and 司马迁 `[Si1 ma3 Qian1]`: the second
 * capital is where the 姓 ends and the 名 begins, and it lands after two
 * syllables for a compound surname without anything having to know that 司马 is
 * one. GB/T 16159 5.1 writes those apart — `Máo Zédōng`, `Sīmǎ Qiān` — so this
 * is the boundary the grouping needs, stated by a source rather than guessed at
 * from a surname list.
 *
 * Returns the index of the first capitalised syllable after the first, or
 * undefined where there is none. A transliteration is the case that matters:
 * 马克思 is `[Ma3 ke4 si1]`, capitalised once and never again, so Marx comes
 * back undefined and stays one word.
 *
 * Only meaningful where the first syllable is capitalised too — an entry
 * CC-CEDICT does not consider a proper noun says nothing about 姓 and 名.
 */
export function nameBoundaryOf(
  readings: readonly string[],
): number | undefined {
  if (readings.length < 2 || !isCapitalised(readings[0] ?? "")) {
    return undefined;
  }
  const at = readings.findIndex(
    (reading, index) => index > 0 && isCapitalised(reading),
  );
  return at > 0 ? at : undefined;
}
