/**
 * The 21 initials (声母) of Mandarin, longest first so that a prefix match finds
 * zh, ch and sh before z, c and s.
 */
export const INITIALS = [
  "zh",
  "ch",
  "sh",
  "b",
  "p",
  "m",
  "f",
  "d",
  "t",
  "n",
  "l",
  "g",
  "k",
  "h",
  "j",
  "q",
  "x",
  "r",
  "z",
  "c",
  "s",
] as const;

/**
 * A Mandarin initial, or the empty string for a syllable with none (零声母).
 */
export type Initial = (typeof INITIALS)[number] | "";

/**
 * The finals (韵母) of Mandarin in their underlying form.
 *
 * These are the forms the finals take in the phonology rather than the forms
 * they are spelled with: 究 is `j` + `iou` even though it is written `jiu`, and
 * 居 is `j` + `ü` even though it is written `ju`. Keeping the underlying form is
 * what lets Wade-Giles, bopomofo and IPA fall out of a table lookup instead of a
 * second pile of respelling rules.
 */
export const FINALS = [
  "a",
  "o",
  "e",
  "ê",
  "er",
  "ai",
  "ei",
  "ao",
  "ou",
  "an",
  "en",
  "ang",
  "eng",
  "ong",
  "i",
  "ia",
  "ie",
  "iao",
  "iou",
  "ian",
  "in",
  "iang",
  "ing",
  "iong",
  "u",
  "ua",
  "uo",
  "uai",
  "uei",
  "uan",
  "uen",
  "uang",
  "ueng",
  "ü",
  "üe",
  "üan",
  "ün",
  // Marginal finals, all of them confined to interjections.
  "io",
  "m",
  "n",
  "ng",
] as const;

/**
 * A Mandarin final in its underlying form.
 */
export type Final = (typeof FINALS)[number];

/**
 * Initials after which a written u is really ü.
 *
 * These never combine with a true u-group final, so the spelling is unambiguous
 * once the initial is known: 居 ju is `j` + `ü`, whereas 姑 gu is `g` + `u`.
 */
export const PALATAL_INITIALS = ["j", "q", "x"] as const;

/**
 * How each final is spelled when the syllable has no initial.
 *
 * The i, u and ü groups take a y or w onset, and a few of them change shape
 * entirely: `iou` is written `you`, `uei` is written `wei`.
 */
export const ZERO_INITIAL_SPELLINGS = new Map<Final, string>([
  ["i", "yi"],
  ["ia", "ya"],
  ["ie", "ye"],
  ["iao", "yao"],
  ["iou", "you"],
  ["ian", "yan"],
  ["in", "yin"],
  ["iang", "yang"],
  ["ing", "ying"],
  ["iong", "yong"],
  ["u", "wu"],
  ["ua", "wa"],
  ["uo", "wo"],
  ["uai", "wai"],
  ["uei", "wei"],
  ["uan", "wan"],
  ["uen", "wen"],
  ["uang", "wang"],
  ["ueng", "weng"],
  ["ü", "yu"],
  ["üe", "yue"],
  ["üan", "yuan"],
  ["ün", "yun"],
  ["io", "yo"],
]);

/**
 * How each final is abbreviated when the syllable does have an initial.
 *
 * `iou`, `uei` and `uen` lose their middle vowel, and the ü group drops its
 * diaeresis after a palatal initial.
 */
export const AFTER_INITIAL_SPELLINGS = new Map<Final, string>([
  ["iou", "iu"],
  ["uei", "ui"],
  ["uen", "un"],
]);

/**
 * Narrow an arbitrary string to a {@link Final}.
 */
export function isFinal(value: string): value is Final {
  return (FINALS as readonly string[]).includes(value);
}

/**
 * Narrow an arbitrary string to an {@link Initial}.
 *
 * The empty string is an initial, since a syllable is allowed to have none.
 */
export function isInitial(value: string): value is Initial {
  return value === "" || (INITIALS as readonly string[]).includes(value);
}

/**
 * Whether a written u following this initial is really ü.
 */
export function isPalatalInitial(initial: Initial): boolean {
  return (PALATAL_INITIALS as readonly string[]).includes(initial);
}
