/**
 * How a found candidate list is narrowed before it is handed back.
 *
 * Both of the searches in `candidates.ts` end the same way: they have every word
 * a reading reaches, in rank order, and the caller wants fewer of them. The
 * narrowing is the same for both — collapse the two scripts, then cut to the
 * limit — so it lives here rather than twice there, and the options that drive
 * it live beside it.
 */
import { convertCharacters, type ScriptTables } from "../script/conversion.js";
import type { Script } from "../script/script.js";

/**
 * Which script a caller wants a candidate list written in, and the tables that
 * can tell.
 *
 * The two are one option because neither is any use without the other. Both
 * scripts are dictionary keys, so a reading group holds 银行 *and* 銀行 — over a
 * third of a typical list is that pairing — and the artifact deliberately does
 * not record which 简体 form pairs with which 繁體 one, since conversion never
 * needs it. So the index cannot pair them on its own, and honouring a
 * preference means loading `script.map`: about 100 KB that the hanzi → pinyin
 * path never fetches.
 *
 * Asking for the preference and the tables in one object is what keeps that
 * cost visible at the call site rather than hidden inside a load.
 *
 * ```ts
 * const tables = await loadScriptTables(source);
 * candidates(index, "yinhang", { script: { prefer: "Hans", tables } });
 * // 银行, and not 銀行 beside it
 * ```
 */
export interface ScriptPreference {
  /** The script to keep where both writings of a word are candidates. */
  readonly prefer: Script;
  /** The conversion tables, from `loadScriptTables`. */
  readonly tables: ScriptTables;
}

/**
 * How a candidate list should be narrowed.
 */
export interface CandidateOptions {
  /** How many candidates to return at most. */
  readonly limit?: number;
  /** Keep one writing of a word rather than both; see {@link ScriptPreference}. */
  readonly script?: ScriptPreference;
}

/**
 * Keep one writing of a word where the group holds both scripts.
 *
 * Paired by 简体 form in both directions rather than by converting toward the
 * preference, because simplification is many-to-one and so the 简体 form is the
 * one both writings agree on. Going the other way needs a reading to tell 發
 * from 髮, and a pair that failed to meet would simply be left as two.
 *
 * The kept writing takes the rank of the better-placed of the two, so
 * collapsing a list never reorders what is left of it.
 */
function preferScript(
  words: readonly string[],
  script: ScriptPreference,
): readonly string[] {
  /** Whether a candidate is the writing the caller asked for. */
  const isWanted = (word: string, simplified: string): boolean =>
    script.prefer === "Hans" ? word === simplified : word !== simplified;

  const chosen = new Map<string, string>();
  const order: string[] = [];
  for (const word of words) {
    const simplified = convertCharacters(script.tables.toSimplified, word);
    const held = chosen.get(simplified);
    if (held === undefined) {
      chosen.set(simplified, word);
      order.push(simplified);
      continue;
    }
    if (!isWanted(held, simplified) && isWanted(word, simplified)) {
      chosen.set(simplified, word);
    }
  }
  /* c8 ignore next -- every entry in `order` was put in `chosen` beside it */
  return order.map((simplified) => chosen.get(simplified) ?? simplified);
}

/**
 * Apply the caller's options to a ranked list of candidates.
 *
 * In that order, because a limit counts what the caller will actually see: a
 * list of five that collapses to three should be cut to three, not cut to five
 * and then collapsed to two.
 */
export function narrowCandidates(
  found: readonly string[],
  options: CandidateOptions,
): readonly string[] {
  const preferred =
    options.script === undefined ? found : preferScript(found, options.script);
  return options.limit === undefined
    ? preferred
    : preferred.slice(0, Math.max(0, options.limit));
}
