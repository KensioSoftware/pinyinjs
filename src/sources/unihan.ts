/**
 * What the Unihan database knows about one character's readings.
 */
export interface UnihanReadings {
  /**
   * Every known reading, most likely first.
   *
   * Ordering follows `kHanyuPinlu`'s frequency counts where it has them, since
   * that is the only source that ranks a polyphone's readings by how often each
   * is actually used. Readings only the other fields know about follow.
   */
  readonly readings: readonly string[];
  /**
   * The readings each field gave, before they were merged into one order.
   *
   * Kept because which field a reading came from carries meaning that the
   * merged list cannot: `kHanyuPinlu` writes 李 as `li(36)` with no tone mark,
   * where every dictionary field writes `lǐ`. Whether an unmarked reading means
   * 轻声 or merely an unmarked tone can only be decided by comparing the
   * fields, and that decision belongs to the merge rather than here.
   */
  readonly fields: ReadonlyMap<ReadingField, readonly string[]>;
  /**
   * The zh-TW reading, when `kMandarin` gives one that differs from zh-CN.
   *
   * Unihan writes the two as a space-separated pair with zh-Hans first, so
   * `U+4E07 kMandarin wàn mò` means 万 is `wàn` on the mainland and `mò` in
   * Taiwan.
   */
  readonly taiwanReading?: string;
}

/**
 * A line of a Unihan data file: code point, field name, value.
 */
const FIELD_LINE = /^U\+([\dA-F]+)\t(\w+)\t(.+)$/u;

/**
 * A single `kHanyuPinlu` token: a reading with its corpus count, as in
 * `de(5096)`.
 */
const READING_WITH_COUNT = /^(.+)\((\d+)\)$/u;

/**
 * Fields carrying readings, in the order their readings are trusted.
 *
 * `kHanyuPinlu` leads because it ranks readings by frequency. `kTGHZ2013` comes
 * next as the current mainland standard, then `kMandarin` for the characters
 * neither covers, and `kXHC1983` last to catch anything still missing.
 */
export const READING_FIELDS = [
  "kHanyuPinlu",
  "kTGHZ2013",
  "kMandarin",
  "kXHC1983",
] as const;

/**
 * One of the Unihan fields this package reads readings from.
 */
export type ReadingField = (typeof READING_FIELDS)[number];

/**
 * The field whose readings are ranked by corpus frequency.
 *
 * The one field that ranks a polyphone's readings, and the one that sometimes
 * omits a tone mark — the two facts that make it both the most useful and the
 * most careful to read.
 */
export const FREQUENCY_FIELD = "kHanyuPinlu" satisfies ReadingField;

/**
 * Pull the readings out of one field's value.
 *
 * The fields do not share a syntax: `kHanyuPinlu` writes `de(5096) dé(1496)`,
 * the dictionary-indexed fields write `069.040:dé 069.090:de`, and `kMandarin`
 * writes bare readings separated by spaces.
 */
function readFieldValue(field: ReadingField, value: string): string[] {
  const tokens = value.split(/\s+/u).filter((token) => token !== "");

  if (field === "kHanyuPinlu") {
    return tokens
      .map((token) => READING_WITH_COUNT.exec(token))
      .filter((match) => match !== null)
      .map((match) => ({ reading: match[1] ?? "", count: Number(match[2]) }))
      .toSorted((left, right) => right.count - left.count)
      .map(({ reading }) => reading);
  }

  // kTGHZ2013 and kXHC1983 prefix each reading with its dictionary entry
  // number, as in 069.040:dé, and may list several against one entry.
  return tokens
    .flatMap((token) =>
      token.includes(":") ? (token.split(":", 2)[1] ?? "") : token,
    )
    .flatMap((reading) => reading.split(","))
    .filter((reading) => reading !== "");
}

/**
 * Read the readings out of a Unihan data file such as `Unihan_Readings.txt`.
 *
 * Only the fields in {@link READING_FIELDS} are looked at; everything else in
 * the file, including the Cantonese, Japanese and Korean readings, is ignored.
 *
 * Note that these sources write an unmarked syllable to mean the *neutral*
 * tone, not an unknown one — `de(5096)` for 得 is 轻声. Callers turning these
 * strings into syllables must resolve them that way rather than leaving the
 * tone undefined.
 */
export function parseUnihanReadings(text: string): Map<string, UnihanReadings> {
  const byField = new Map<string, Map<ReadingField, string[]>>();
  const taiwanReadings = new Map<string, string>();

  for (const line of text.split("\n")) {
    const match = FIELD_LINE.exec(line);
    if (match === null) {
      continue;
    }
    const [, codePoint = "", fieldName = "", value = ""] = match;
    if (!(READING_FIELDS as readonly string[]).includes(fieldName)) {
      continue;
    }

    const field = fieldName as ReadingField;
    const character = String.fromCodePoint(Number.parseInt(codePoint, 16));
    const readings = readFieldValue(field, value);
    if (readings.length === 0) {
      continue;
    }

    // kMandarin's second value is the zh-TW reading, not another zh-CN one.
    if (field === "kMandarin" && readings.length > 1) {
      const [mainland = "", taiwan = ""] = readings;
      if (taiwan !== mainland) {
        taiwanReadings.set(character, taiwan);
      }
      readings.length = 1;
    }

    const fields = byField.get(character) ?? new Map<ReadingField, string[]>();
    fields.set(field, readings);
    byField.set(character, fields);
  }

  const parsed = new Map<string, UnihanReadings>();
  for (const [character, fields] of byField) {
    const ordered: string[] = [];
    for (const field of READING_FIELDS) {
      const fieldReadings = fields.get(field) ?? [];
      for (const reading of fieldReadings) {
        if (!ordered.includes(reading)) {
          ordered.push(reading);
        }
      }
    }

    const taiwanReading = taiwanReadings.get(character);
    parsed.set(character, {
      readings: ordered,
      fields,
      ...(taiwanReading !== undefined && { taiwanReading }),
    });
  }

  return parsed;
}

/**
 * A line of `Unihan_Variants.txt` naming the variants of one character.
 */
const VARIANT_LINE =
  /^U\+([\dA-F]+)\t(kSimplifiedVariant|kTraditionalVariant)\t(.+)$/u;

const VARIANT_CODE_POINT = /^U\+([\dA-F]+)$/u;

/**
 * Which characters each script writes a given character as.
 */
export interface UnihanVariants {
  /** Simplified forms of a traditional character. */
  readonly simplified: ReadonlyMap<string, readonly string[]>;
  /** Traditional forms of a simplified character. */
  readonly traditional: ReadonlyMap<string, readonly string[]>;
}

/**
 * Read the script variants out of `Unihan_Variants.txt`.
 *
 * Both directions are one-to-many: 发 has the two traditional forms 發 and 髮,
 * which is exactly the ambiguity that makes traditional text more accurate to
 * convert than simplified.
 */
export function parseUnihanVariants(text: string): UnihanVariants {
  const simplified = new Map<string, string[]>();
  const traditional = new Map<string, string[]>();

  for (const line of text.split("\n")) {
    const match = VARIANT_LINE.exec(line);
    if (match === null) {
      continue;
    }
    const [, codePoint = "", fieldName = "", value = ""] = match;
    const character = String.fromCodePoint(Number.parseInt(codePoint, 16));
    const variants = value
      .split(/\s+/u)
      .map((token) => VARIANT_CODE_POINT.exec(token))
      .filter((found) => found !== null)
      .map((found) =>
        String.fromCodePoint(Number.parseInt(found[1] ?? "0", 16)),
      );
    if (variants.length === 0) {
      continue;
    }
    const target =
      fieldName === "kSimplifiedVariant" ? simplified : traditional;
    target.set(character, [...(target.get(character) ?? []), ...variants]);
  }

  return { simplified, traditional };
}
