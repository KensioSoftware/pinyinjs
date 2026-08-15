/**
 * Reading and ranking the pronunciation fields Unihan carries.
 *
 * The fields disagree and are not equally trustworthy, so the order they are
 * consulted in is what settles a character's readings.
 */
import {
  FREQUENCY_FIELD,
  READING_FIELDS,
  type ReadingField,
} from "./unihan.js";

const READING_WITH_COUNT = /^(.+)\((\d+)\)$/u;
/**

/**
 * Pull the readings out of one field's value.
 *
 * The fields do not share a syntax: `kHanyuPinlu` writes `de(5096) dé(1496)`,
 * the dictionary-indexed fields write `069.040:dé 069.090:de`, and `kMandarin`
 * writes bare readings separated by spaces.
 */
export function readFieldValue(field: ReadingField, value: string): string[] {
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
 * Whether `kHanyuPinlu` ranks this character's readings against each other.
 *
 * True only where it lists more than one, which is the difference between a
 * ranking and a bare observation — see {@link fieldOrder}. It decides both what
 * ranks the readings here and whether anything downstream is entitled to
 * re-rank them, so it is one predicate rather than two.
 */
export function isFrequencyRanked(
  fields: ReadonlyMap<ReadingField, readonly string[]>,
): boolean {
  return (fields.get(FREQUENCY_FIELD) ?? []).length > 1;
}

/**
 * Which fields to trust, in order, for one character.
 *
 * `kHanyuPinlu` is a ranking, and a ranking of one thing is not a ranking. Where
 * the field lists a single reading it never compared it against anything, so it
 * is saying "this reading occurred in the corpus" rather than "this reading
 * leads" — and it is demoted to last, keeping its reading as a candidate
 * without letting it set the default.
 *
 * That matters because the corpus behind the field, 《現代漢語頻率詞典》,
 * predates the 1985 普通话异读词审音表. Where it is the only voice it can be
 * reporting a reading that was standard then and is not now: of the ten
 * characters where a lone `kHanyuPinlu` reading disagrees with `kMandarin`,
 * eight are the superseded reading — 绩 `jī` for `jì`, 迹 `jī` for `jì`, 脊
 * `jí` for `jǐ`, 哮 `xiāo` for `xiào`, 茸 `rōng` for `róng`, 澎 `pēng` for
 * `péng`, 啥 `shà` for `shá`, 甸 `diān` for `diàn`. A high count does not make
 * one current; 绩 `jī` carries 132 of them.
 *
 * The other two are genuine variants where both readings are current — 谁 is
 * `shéi` or `shuí`, 桔 is `jié` or `jú` — so `kMandarin` deciding them costs
 * nothing that a word entry does not already settle.
 */
export function fieldOrder(
  fields: ReadonlyMap<ReadingField, readonly string[]>,
): readonly ReadingField[] {
  if (isFrequencyRanked(fields)) {
    return READING_FIELDS;
  }
  return [
    ...READING_FIELDS.filter((field) => field !== FREQUENCY_FIELD),
    FREQUENCY_FIELD,
  ];
}

/**
 * Gather one character's readings from its fields, likeliest first.
 *
 * A reading appearing in several fields keeps the position its highest-trusted
 * one gives it, and every field's readings survive: the order decides the
 * default, not the membership.
 */
export function rankReadings(
  fields: ReadonlyMap<ReadingField, readonly string[]>,
): string[] {
  const ordered: string[] = [];
  for (const field of fieldOrder(fields)) {
    for (const reading of fields.get(field) ?? []) {
      if (!ordered.includes(reading)) {
        ordered.push(reading);
      }
    }
  }
  return ordered;
}
