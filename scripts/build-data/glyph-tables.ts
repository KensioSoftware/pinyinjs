/**
 * Recompute the glyph-form tables from OpenCC and check the committed ones.
 *
 * `src/script/glyphs.ts` holds the Taiwan and Hong Kong tables as code rather
 * than as an artifact, because 133 mappings do not justify a download and they
 * have to be usable before any dictionary has loaded. The cost of that choice
 * is that nothing would notice an OpenCC release moving a character, so the
 * derivation lives here and the build fails when the two disagree.
 *
 * See SCRIPTS-AND-LOCALES.md for what the tables mean and why the canonical
 * form is Taiwan's.
 */
import { toCharacters } from "../../src/script/characters.js";
import { CANONICAL_FORMS, HONG_KONG_FORMS } from "../../src/script/glyphs.js";
import type { OpenCcTable } from "../../src/sources/opencc.js";

/**
 * How often a variant must appear in 繁體 to count as a live spelling.
 *
 * Both conditions have to hold, and they answer different objections: the
 * absolute floor keeps a single stray spelling from vetoing a mapping, and the
 * relative one keeps a common character from being rewritten merely because its
 * canonical rival is commoner still.
 */
const CURRENT_OCCURRENCES = 10;

const CURRENT_SHARE = 0.05;

/**
 * The tables as they should be, given these sources.
 */
export interface GlyphTables {
  readonly canonical: ReadonlyMap<string, string>;
  readonly hongKong: ReadonlyMap<string, string>;
  /** Mappings OpenCC makes that were dropped because the variant is current. */
  readonly excluded: readonly string[];
}

/**
 * How often each character is written, in each script's headwords.
 *
 * Kept apart rather than pooled, because normalising is safe or unsafe for
 * different reasons in each — see {@link isCurrent}.
 */
export interface CorpusCounts {
  readonly simplified: ReadonlyMap<string, number>;
  readonly traditional: ReadonlyMap<string, number>;
}

/**
 * Count how often each character appears in a corpus of headwords.
 */
export function countCharacters(
  words: Iterable<string>,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    for (const character of toCharacters(word)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Derive both glyph tables from OpenCC's variant tables and a 繁體 corpus.
 *
 * The corpus decides which normalisations are safe. A variant that the
 * dictionary's own 繁體 column writes is a live spelling rather than a regional
 * one, and normalising it away would corrupt legitimate text — 台 is the case
 * that matters, since OpenCC maps it to 臺 while CC-CEDICT writes it 164 times.
 */
export function deriveGlyphTables(
  taiwan: OpenCcTable,
  hongKong: OpenCcTable,
  counts: CorpusCounts,
): GlyphTables {
  const keys = [...new Set([...taiwan.keys(), ...hongKong.keys()])].toSorted(
    byCodePoint,
  );
  const canonicalOf = (key: string): string => taiwan.get(key)?.[0] ?? key;
  const canonicalForms = new Set(keys.map((key) => canonicalOf(key)));

  const canonical = new Map<string, string>();
  const hongKongForms = new Map<string, string>();
  const excluded: string[] = [];

  for (const key of keys) {
    const target = canonicalOf(key);
    const regional = hongKong.get(key)?.[0] ?? key;
    if (target !== regional) {
      hongKongForms.set(target, regional);
    }

    const spellings = [
      ...new Set([
        key,
        ...(taiwan.get(key) ?? []),
        ...(hongKong.get(key) ?? []),
      ]),
    ]
      // A spelling that is some key's canonical form is never normalised away:
      // 么 is Taiwan's form of 幺, so 麼's listing it as an alternative must not
      // turn every 么 into 麼.
      .filter(
        (spelling) => spelling !== target && !canonicalForms.has(spelling),
      );

    for (const spelling of spellings) {
      if (isCurrent(spelling, target, counts)) {
        excluded.push(describeExclusion(spelling, target, counts));
      } else {
        canonical.set(spelling, target);
      }
    }
  }

  return { canonical, hongKong: hongKongForms, excluded };
}

/**
 * Order keys by code point, so a derivation is reproducible run to run.
 */
function byCodePoint(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * Whether a variant must be left alone rather than normalised.
 *
 * Two tests, asking genuinely different questions, which is why they have
 * different thresholds:
 *
 * - **Does 简体 write it?** Any occurrence at all vetoes the mapping. A
 *   normalisation turns the character into a 繁體 form, and doing that to 简体
 *   text is wrong however rare the word — 写字枱 and 义藴 are 简体 headwords
 *   whose keys became unreachable when a frequency floor let 枱 and 藴 through.
 * - **Is it a live 繁體 spelling?** Here a floor is right, because the question
 *   is whether people write it rather than whether it exists. 台 appears 164
 *   times against 臺's 208 and is plainly current; a single stray spelling is
 *   not, and should not veto a mapping the rest of the corpus supports.
 */
function isCurrent(
  spelling: string,
  target: string,
  counts: CorpusCounts,
): boolean {
  if ((counts.simplified.get(spelling) ?? 0) > 0) {
    return true;
  }
  const variant = counts.traditional.get(spelling) ?? 0;
  const settled = counts.traditional.get(target) ?? 0;
  return variant >= CURRENT_OCCURRENCES && variant > settled * CURRENT_SHARE;
}

/**
 * Report an excluded mapping with the counts that excluded it.
 */
function describeExclusion(
  spelling: string,
  target: string,
  counts: CorpusCounts,
): string {
  const hans = counts.simplified.get(spelling) ?? 0;
  const hant = counts.traditional.get(spelling) ?? 0;
  const why = hans > 0 ? `简体 ${String(hans)}` : `繁體 ${String(hant)}`;
  return `${spelling} -> ${target} (${why})`;
}

/**
 * Describe how a committed table differs from the derived one, if it does.
 */
function differences(
  name: string,
  committed: ReadonlyMap<string, string>,
  derived: ReadonlyMap<string, string>,
): string[] {
  const failures: string[] = [];
  for (const [from, to] of derived) {
    const held = committed.get(from);
    if (held !== to) {
      failures.push(
        `${name}: ${from} should map to ${to}, committed ${held ?? "nothing"}`,
      );
    }
  }
  for (const [from, to] of committed) {
    if (!derived.has(from)) {
      failures.push(
        `${name}: ${from} -> ${to} is committed but no longer derived`,
      );
    }
  }
  return failures;
}

/**
 * Check the committed glyph tables against what these sources derive.
 *
 * Returns the failures, empty when the tables are current. The caller fails the
 * build on anything here rather than warning, per the convention in
 * DATA-PIPELINE.md.
 */
export function checkGlyphTables(tables: GlyphTables): readonly string[] {
  return [
    ...differences("canonical glyphs", CANONICAL_FORMS, tables.canonical),
    ...differences("Hong Kong glyphs", HONG_KONG_FORMS, tables.hongKong),
  ];
}
