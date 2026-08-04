/**
 * The two Chinese scripts this package reads.
 *
 * Named for their ISO 15924 codes rather than "simplified" and "traditional", to
 * keep them distinct from {@link Locale}, which is a separate axis.
 */
export const SCRIPTS = ["Hans", "Hant"] as const;

/**
 * A Chinese script: `Hans` for 简体 or `Hant` for 繁體.
 *
 * Which script a text is written in is independent of which reading standard
 * applies to it. Mainland editions of classical texts are written in `Hant` but
 * read with `zh-CN` readings, so the two must not be conflated.
 */
export type Script = (typeof SCRIPTS)[number];

/**
 * The reading standards this package distinguishes.
 */
export const LOCALES = ["zh-CN", "zh-TW"] as const;

/**
 * A Mandarin reading standard: `zh-CN` for 普通话 or `zh-TW` for 國語.
 *
 * The two differ on a few hundred readings — 垃圾 is `lājī` in `zh-CN` and
 * `lèsè` in `zh-TW` — but agree on the overwhelming majority, so `zh-TW` is
 * stored as a delta over `zh-CN` rather than as a second dictionary.
 */
export type Locale = (typeof LOCALES)[number];

/**
 * The reading standard assumed when the caller does not name one.
 */
export const DEFAULT_LOCALE = "zh-CN" satisfies Locale;

/**
 * Narrow an arbitrary string to a {@link Script}.
 */
export function isScript(value: string): value is Script {
  return (SCRIPTS as readonly string[]).includes(value);
}

/**
 * Narrow an arbitrary string to a {@link Locale}.
 */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * The script a text is written in, where its characters settle the question.
 *
 * Returns undefined for text that is script-neutral, which is the common case:
 * most characters are unchanged by simplification, so a sentence containing none
 * of the changed ones reads identically under either script and needs no
 * decision. Callers should treat undefined as "either", not as a failure.
 */
export function detectScript(
  text: string,
  hansOnly: ReadonlySet<string>,
  hantOnly: ReadonlySet<string>,
): Script | undefined {
  let hans = 0;
  let hant = 0;
  for (const character of text) {
    if (hansOnly.has(character)) {
      hans++;
    } else if (hantOnly.has(character)) {
      hant++;
    }
  }
  if (hans === hant) {
    return undefined;
  }
  return hans > hant ? "Hans" : "Hant";
}
