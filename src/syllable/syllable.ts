import {
  applyToneMark,
  stripToneMarks,
  toneFromMarks,
} from "../tone/tone-mark.js";
import { NEUTRAL_TONE, type Tone, toneFromNotation } from "../tone/tone.js";
import {
  AFTER_INITIAL_SPELLINGS,
  type Final,
  INITIALS,
  type Initial,
  isFinal,
  isPalatalInitial,
  ZERO_INITIAL_SPELLINGS,
} from "./phonology.js";

/**
 * A single Mandarin syllable, decomposed into its phonological parts.
 *
 * The initial and final are the underlying forms rather than the spelling, so
 * 就 parses to `j` + `iou` and 军 to `j` + `ün`. Spelling is reconstructed on
 * demand by {@link writeSyllable}.
 */
export interface Syllable {
  readonly initial: Initial;
  readonly final: Final;
  /**
   * The tone, or undefined when the source wrote no tone at all.
   *
   * Undefined is distinct from {@link NEUTRAL_TONE}: `de` in 我的 is neutral,
   * whereas the `bei` in a typed `beijing` simply has no tone written. Treating
   * the second as neutral would fabricate information — it would round-trip to
   * `bei5`, and would emit the neutral-tone dot in bopomofo.
   */
  readonly tone: Tone | undefined;
  /**
   * Whether the syllable carries the retroflex r suffix of 儿化, as 玩儿 wánr
   * does.
   *
   * This is a suffix on the syllable rather than a syllable of its own, which is
   * what separates 玩儿 wánr from 女儿 nǚ'ér, where 儿 keeps its own syllable.
   */
  readonly erhua?: boolean;
}

/**
 * How a written final maps back to its underlying form after a palatal initial,
 * where a written u always stands for ü.
 */
const PALATAL_FINALS = new Map<string, Final>([
  ["u", "ü"],
  ["ue", "üe"],
  ["uan", "üan"],
  ["un", "ün"],
]);

/**
 * How a written final maps back to its underlying form after any other initial.
 */
const ABBREVIATED_FINALS = new Map<string, Final>([
  ["iu", "iou"],
  ["ui", "uei"],
  ["un", "uen"],
]);

/**
 * The reverse of {@link ZERO_INITIAL_SPELLINGS}, for reading y- and w- forms.
 */
const ZERO_INITIAL_FINALS = new Map<string, Final>(
  [...ZERO_INITIAL_SPELLINGS].map(([final, spelling]) => [spelling, final]),
);

/**
 * Finals that are written as-is when they make up a whole syllable on their own.
 *
 * Every other final either takes a y or w onset with no initial (i becomes yi)
 * or cannot stand alone at all (ong only ever follows an initial), so accepting
 * anything outside this set would let underlying forms such as `iou` through as
 * if they were valid spellings.
 */
const STANDALONE_FINALS = new Set<Final>([
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
  "m",
  "n",
  "ng",
]);

/**
 * Replace the ways ü gets typed on a keyboard with the letter itself.
 *
 * `v` is the common input convention and `u:` is the ASCII convention CC-CEDICT
 * uses.
 */
export function normaliseUmlaut(text: string): string {
  return text.replaceAll("u:", "ü").replaceAll("v", "ü").replaceAll("V", "Ü");
}

/**
 * Split a written syllable into its initial and the final's spelling.
 *
 * Falls back to treating the whole syllable as a final with no initial, which is
 * what recovers the syllabic nasals: n and ng would otherwise be read as an n
 * initial with nothing after it.
 */
function splitOnInitial(spelling: string): readonly [Initial, string] {
  for (const initial of INITIALS) {
    if (spelling.startsWith(initial) && spelling.length > initial.length) {
      return [initial, spelling.slice(initial.length)];
    }
  }
  return ["", spelling];
}

/**
 * Resolve a written final to its underlying form, given the initial it follows.
 */
function readFinal(initial: Initial, spelling: string): Final | undefined {
  if (initial === "") {
    const zeroInitial = ZERO_INITIAL_FINALS.get(spelling);
    if (zeroInitial !== undefined) {
      return zeroInitial;
    }
    return isFinal(spelling) && STANDALONE_FINALS.has(spelling)
      ? spelling
      : undefined;
  }

  // Only u, ue, uan and un are reinterpreted after a palatal initial. Anything
  // else it can take, such as the iu of jiu, still abbreviates as usual.
  if (isPalatalInitial(initial)) {
    const palatal = PALATAL_FINALS.get(spelling);
    if (palatal !== undefined) {
      return palatal;
    }
  }

  const abbreviated = ABBREVIATED_FINALS.get(spelling);
  if (abbreviated !== undefined) {
    return abbreviated;
  }

  if (!isFinal(spelling)) {
    return undefined;
  }
  // er only ever stands as a syllable of its own, so ger is 歌儿 gēr — the
  // syllable gē carrying an r suffix — and not an initial g with an er final.
  if (spelling === "er") {
    return undefined;
  }
  // Reject underlying forms where a spelling rule requires something else, so
  // that jiou and jü do not pass as alternatives to jiu and ju.
  if (AFTER_INITIAL_SPELLINGS.has(spelling)) {
    return undefined;
  }
  if (isPalatalInitial(initial) && spelling.startsWith("ü")) {
    return undefined;
  }
  return spelling;
}

/**
 * Split a toneless spelling into its initial and final.
 *
 * Retries the whole spelling as a final standing on its own when the split
 * fails, which is what recovers ng: it would otherwise be read as an n initial
 * followed by a stray g.
 */
function readParts(spelling: string): readonly [Initial, Final] | undefined {
  const [initial, finalSpelling] = splitOnInitial(spelling);
  const final = readFinal(initial, finalSpelling);
  if (final !== undefined) {
    return [initial, final];
  }
  if (initial !== "") {
    const standalone = readFinal("", spelling);
    if (standalone !== undefined) {
      return ["", standalone];
    }
  }
  return undefined;
}

/**
 * Read a written syllable into its phonological parts.
 *
 * Accepts both tone-marked (`jiù`) and tone-numbered (`jiu4`) notation, along
 * with the `v` and `u:` conventions for ü, and the r suffix of 儿化. Returns
 * undefined for anything that is not a well-formed Mandarin syllable.
 */
export function readSyllable(text: string): Syllable | undefined {
  const trimmed = normaliseUmlaut(text.trim()).normalize("NFC");
  if (trimmed === "") {
    return undefined;
  }

  const numberedMatch = /^(.*?)([0-5])$/u.exec(trimmed);
  const body = numberedMatch?.[1] ?? trimmed;
  const numberedTone =
    numberedMatch?.[2] === undefined
      ? undefined
      : toneFromNotation(Number(numberedMatch[2]));

  const markedTone = toneFromMarks(body);
  if (numberedTone !== undefined && markedTone !== undefined) {
    // Mixed notation such as jiù4 is more likely a mistake than an intent.
    return undefined;
  }

  const spelling = stripToneMarks(body).toLowerCase();
  const tone = numberedTone ?? markedTone;

  const parts = readParts(spelling);
  if (parts !== undefined) {
    return { initial: parts[0], final: parts[1], tone };
  }

  // 儿化: wánr is wán carrying an r suffix rather than a syllable in its own
  // right. Tried only after the whole spelling fails, so that ér and èr keep
  // their own reading instead of being read as e with a suffix.
  if (spelling.endsWith("r")) {
    const base = readParts(spelling.slice(0, -1));
    if (base !== undefined) {
      return { initial: base[0], final: base[1], tone, erhua: true };
    }
  }

  return undefined;
}

/**
 * Whether a string is a well-formed Mandarin syllable.
 */
export function isSyllable(text: string): boolean {
  return readSyllable(text) !== undefined;
}

/**
 * Spell a syllable without its tone.
 */
export function writeSyllableSpelling(syllable: Syllable): string {
  const { initial, final } = syllable;
  const suffix = syllable.erhua === true ? "r" : "";
  if (initial === "") {
    return `${ZERO_INITIAL_SPELLINGS.get(final) ?? final}${suffix}`;
  }
  if (isPalatalInitial(initial) && final.startsWith("ü")) {
    return `${initial}${final.replace("ü", "u")}${suffix}`;
  }
  return `${initial}${AFTER_INITIAL_SPELLINGS.get(final) ?? final}${suffix}`;
}

/**
 * How a syllable's tone should be written.
 *
 * `marks` is the standard diacritic notation, `numbers` appends the tone number,
 * and `none` writes the plain syllable.
 */
export type ToneNotation = "marks" | "numbers" | "none";

/**
 * Spell a syllable, writing its tone in the requested notation.
 */
export function writeSyllable(
  syllable: Syllable,
  notation: ToneNotation = "marks",
): string {
  const spelling = writeSyllableSpelling(syllable);
  switch (notation) {
    case "marks": {
      return applyToneMark(spelling, syllable.tone);
    }
    case "numbers": {
      // An unwritten tone stays unwritten, rather than being invented as 5.
      return syllable.tone === undefined
        ? spelling
        : `${spelling}${String(syllable.tone)}`;
    }
    case "none": {
      return spelling;
    }
  }
}
