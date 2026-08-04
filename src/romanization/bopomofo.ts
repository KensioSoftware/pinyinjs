/**
 * Bopomofo (注音符號), in both directions.
 *
 * This is the easy half of romanisation interchange, and the reason is
 * [phonology.ts](../syllable/phonology.ts): a parsed syllable already holds the
 * underlying initial and final rather than the spelling, and bopomofo writes
 * exactly those. 就 is
 * `j` + `iou` and ㄐㄧㄡ; 军 is `j` + `ün` and ㄐㄩㄣ; 中 is `zh` + `ong` and
 * ㄓㄨㄥ. Nothing here undoes a pinyin spelling rule, because `readSyllable`
 * never applied one.
 *
 * So the mapping is compositional — an initial symbol, a medial symbol and a
 * rhyme symbol — and it is a bijection over the whole syllable inventory. The
 * three places it is not quite mechanical are recorded on the tables below.
 */
import { toCharacters } from "../script/characters.js";
import type { Final, Initial } from "../syllable/phonology.js";
import type { Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";

/**
 * The medial (介音) of a syllable, or the empty string for one with none.
 */
type Medial = "" | "i" | "u" | "ü";

/**
 * The rhyme a syllable ends on, or the empty string where the medial is the
 * whole of the final: 於 yú is ㄩ and nothing more.
 */
type Rhyme =
  | ""
  | "a"
  | "o"
  | "e"
  | "ê"
  | "ai"
  | "ei"
  | "ao"
  | "ou"
  | "an"
  | "en"
  | "ang"
  | "eng"
  | "er"
  | "m"
  | "n"
  | "ng";

/**
 * The symbol each initial is written with.
 *
 * A syllable with no initial has no entry and writes nothing, which is what the
 * empty string stands for throughout this file.
 */
const INITIAL_SYMBOLS = new Map<Initial, string>([
  ["b", "ㄅ"],
  ["p", "ㄆ"],
  ["m", "ㄇ"],
  ["f", "ㄈ"],
  ["d", "ㄉ"],
  ["t", "ㄊ"],
  ["n", "ㄋ"],
  ["l", "ㄌ"],
  ["g", "ㄍ"],
  ["k", "ㄎ"],
  ["h", "ㄏ"],
  ["j", "ㄐ"],
  ["q", "ㄑ"],
  ["x", "ㄒ"],
  ["zh", "ㄓ"],
  ["ch", "ㄔ"],
  ["sh", "ㄕ"],
  ["r", "ㄖ"],
  ["z", "ㄗ"],
  ["c", "ㄘ"],
  ["s", "ㄙ"],
]);

/**
 * The symbol each medial is written with.
 */
const MEDIAL_SYMBOLS = new Map<Medial, string>([
  ["i", "ㄧ"],
  ["u", "ㄨ"],
  ["ü", "ㄩ"],
]);

/**
 * The symbol each rhyme is written with.
 *
 * ㄦ is here as a rhyme of its own and also serves as the 儿化 suffix, which is
 * what bopomofo does with it: 歌儿 gēr is ㄍㄜㄦ.
 *
 * The three syllabic nasals at the end are the marginal case. ㄇ and ㄋ are
 * initial letters doing rhyme duty, as bopomofo writes 呣 and 嗯; ㄫ is the
 * obsolete letter for a syllabic ng, used here rather than ㄥ so that 嗯 ǹg and
 * the rare 鞥 ēng do not come out identical.
 */
const RHYME_SYMBOLS = new Map<Rhyme, string>([
  ["a", "ㄚ"],
  ["o", "ㄛ"],
  ["e", "ㄜ"],
  ["ê", "ㄝ"],
  ["ai", "ㄞ"],
  ["ei", "ㄟ"],
  ["ao", "ㄠ"],
  ["ou", "ㄡ"],
  ["an", "ㄢ"],
  ["en", "ㄣ"],
  ["ang", "ㄤ"],
  ["eng", "ㄥ"],
  ["er", "ㄦ"],
  ["m", "ㄇ"],
  ["n", "ㄋ"],
  ["ng", "ㄫ"],
]);

/**
 * How each final divides into a medial and a rhyme.
 *
 * Written out rather than split off the front of the spelling, because the
 * division is phonological and the spelling only mostly follows it: `in` is
 * ㄧㄣ, an i medial over the ㄣ rhyme rather than over an n of its own, and
 * `iong` is ㄩㄥ — a ü medial despite the i in the spelling, which is why
 * 兄 xiōng and 军 jūn share a medial.
 */
const FINAL_PARTS: Record<Final, readonly [Medial, Rhyme]> = {
  a: ["", "a"],
  o: ["", "o"],
  e: ["", "e"],
  ê: ["", "ê"],
  er: ["", "er"],
  ai: ["", "ai"],
  ei: ["", "ei"],
  ao: ["", "ao"],
  ou: ["", "ou"],
  an: ["", "an"],
  en: ["", "en"],
  ang: ["", "ang"],
  eng: ["", "eng"],
  ong: ["u", "eng"],
  i: ["i", ""],
  ia: ["i", "a"],
  io: ["i", "o"],
  ie: ["i", "ê"],
  iao: ["i", "ao"],
  iou: ["i", "ou"],
  ian: ["i", "an"],
  in: ["i", "en"],
  iang: ["i", "ang"],
  ing: ["i", "eng"],
  iong: ["ü", "eng"],
  u: ["u", ""],
  ua: ["u", "a"],
  uo: ["u", "o"],
  uai: ["u", "ai"],
  uei: ["u", "ei"],
  uan: ["u", "an"],
  uen: ["u", "en"],
  uang: ["u", "ang"],
  ueng: ["u", "eng"],
  ü: ["ü", ""],
  üe: ["ü", "ê"],
  üan: ["ü", "an"],
  ün: ["ü", "en"],
  m: ["", "m"],
  n: ["", "n"],
  ng: ["", "ng"],
};

/**
 * The initials whose syllable with an i final is written as the initial alone:
 * 知 is ㄓ, not ㄓㄧ.
 *
 * The i of zhi, chi, shi, ri, zi, ci and si is not the i of ji at all — it is
 * the syllabic continuation of the initial (空韻), and bopomofo simply does not
 * write it. This is the one place the correspondence is not one symbol per
 * part.
 */
const EMPTY_RHYME_INITIALS = new Set<Initial>([
  "zh",
  "ch",
  "sh",
  "r",
  "z",
  "c",
  "s",
]);

/**
 * The mark each tone takes.
 *
 * The neutral tone's dot goes *before* the syllable and the other four go
 * after, which is where bopomofo puts them.
 */
const TONE_MARKS = new Map<Tone, string>([
  [1, "ˉ"],
  [2, "ˊ"],
  [3, "ˇ"],
  [4, "ˋ"],
  [NEUTRAL_TONE, "˙"],
]);

/**
 * The tone each mark stands for, including the shapes a keyboard produces.
 *
 * Tolerant input and standard output, as the rest of the package has: `´` and
 * `` ` `` are the ASCII neighbours of ˊ and ˋ, and are what text that was typed
 * rather than composed tends to carry.
 */
const TONES_BY_MARK = new Map<string, Tone>([
  ["ˉ", 1],
  ["¯", 1],
  ["ˊ", 2],
  ["´", 2],
  ["ˇ", 3],
  ["ˋ", 4],
  ["`", 4],
  ["˙", NEUTRAL_TONE],
  ["·", NEUTRAL_TONE],
]);

/**
 * How the first tone is written.
 *
 * Standard bopomofo leaves it unmarked, which is why `none` is the default. The
 * cost is that a syllable whose tone was never written comes back as a first
 * tone, since bopomofo has no way to say "no tone at all"; `mark` writes ˉ and
 * keeps the two apart.
 */
export interface BopomofoOptions {
  readonly firstTone?: "mark" | "none";
}

/**
 * Write a syllable in bopomofo: 就 jiù becomes ㄐㄧㄡˋ.
 *
 * Total over well-formed syllables — every initial and every final has a
 * symbol — so anything the syllable parser accepts can be written, including
 * the syllables no dictionary uses.
 */
export function writeBopomofo(
  syllable: Syllable,
  options: BopomofoOptions = {},
): string {
  const { initial, final, tone } = syllable;
  const [medial, rhyme] = FINAL_PARTS[final];
  const isEmptyRhyme = final === "i" && EMPTY_RHYME_INITIALS.has(initial);

  const written = [
    INITIAL_SYMBOLS.get(initial) ?? "",
    isEmptyRhyme ? "" : (MEDIAL_SYMBOLS.get(medial) ?? ""),
    isEmptyRhyme ? "" : (RHYME_SYMBOLS.get(rhyme) ?? ""),
    syllable.erhua === true ? "ㄦ" : "",
  ].join("");

  const mark = tone === undefined ? undefined : TONE_MARKS.get(tone);
  if (mark === undefined || (tone === 1 && options.firstTone !== "mark")) {
    return written;
  }
  return tone === NEUTRAL_TONE ? `${mark}${written}` : `${written}${mark}`;
}

/**
 * Write a word in bopomofo, one syllable after another.
 *
 * Separated by spaces, as 教育部's dictionaries write them. A syllable boundary
 * is findable without the space — an initial symbol can only start one — but a
 * long unbroken run of symbols is hard to read, and the space costs nothing.
 */
export function writeBopomofoWord(
  syllables: readonly Syllable[],
  options: BopomofoOptions = {},
): string {
  return syllables
    .map((syllable) => writeBopomofo(syllable, options))
    .join(" ");
}

/**
 * The final each medial and rhyme pair spells, keyed as `medial|rhyme`.
 */
const FINALS_BY_PARTS = new Map<string, Final>(
  Object.entries(FINAL_PARTS).map(([final, [medial, rhyme]]) => [
    `${medial}|${rhyme}`,
    final as Final,
  ]),
);

/**
 * The initial each symbol stands for.
 */
const INITIALS_BY_SYMBOL = new Map<string, Initial>(
  [...INITIAL_SYMBOLS].map(([initial, symbol]) => [symbol, initial]),
);

/**
 * The medial each symbol stands for.
 */
const MEDIALS_BY_SYMBOL = new Map<string, Medial>(
  [...MEDIAL_SYMBOLS].map(([medial, symbol]) => [symbol, medial]),
);

/**
 * The rhyme each symbol stands for.
 */
const RHYMES_BY_SYMBOL = new Map<string, Rhyme>(
  [...RHYME_SYMBOLS].map(([rhyme, symbol]) => [symbol, rhyme]),
);

/**
 * Whether one character is a bopomofo letter or tone mark.
 */
function isSymbol(symbol: string): boolean {
  return (
    INITIALS_BY_SYMBOL.has(symbol) ||
    MEDIALS_BY_SYMBOL.has(symbol) ||
    RHYMES_BY_SYMBOL.has(symbol) ||
    TONES_BY_MARK.has(symbol)
  );
}

/**
 * Whether a string is written in bopomofo at all.
 *
 * This is the one thing bopomofo makes easy that Wade-Giles cannot: it has a
 * script of its own, so it is never mistaken for pinyin and a caller never has
 * to be told which system its input is in.
 */
export function isBopomofo(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed !== "" && toCharacters(trimmed).every((symbol) => isSymbol(symbol))
  );
}

/**
 * A syllable's symbols, taken off the front of the string in order.
 */
interface Parsed {
  readonly initial: Initial;
  readonly medial: Medial;
  readonly rhyme: Rhyme;
  readonly hasErhua: boolean;
}

/**
 * Take the tone mark off, wherever it was written.
 *
 * The neutral dot belongs at the front and the other four at the back, but text
 * in the wild puts them either side, so both are read. A mark at each end is
 * rejected rather than resolved, which is the same call `readSyllable` makes
 * about `běi3`.
 */
function splitTone(
  text: string,
): readonly [string, Tone | undefined] | undefined {
  const leading = TONES_BY_MARK.get(text.slice(0, 1));
  if (leading !== undefined) {
    const rest = text.slice(1);
    return TONES_BY_MARK.has(rest.slice(-1)) ? undefined : [rest, leading];
  }
  const trailing = TONES_BY_MARK.get(text.slice(-1));
  return trailing === undefined
    ? [text, undefined]
    : [text.slice(0, -1), trailing];
}

/**
 * Read the symbols of one syllable, in the order bopomofo writes them.
 *
 * `hasInitial` is what recovers the syllabic nasals on a second pass: ㄇ is an
 * initial letter, so 呣 m̄ parses as an m initial with nothing after it and has
 * to be retried as a rhyme standing alone. `readParts` in
 * [syllable.ts](../syllable/syllable.ts) retries n and ng the same way, for the
 * same reason.
 */
function parseSymbols(text: string, hasInitial: boolean): Parsed | undefined {
  const symbols = toCharacters(text);
  let at = 0;

  const initial = hasInitial
    ? INITIALS_BY_SYMBOL.get(symbols[at] ?? "")
    : undefined;
  if (initial !== undefined) {
    at += 1;
  }
  const medial = MEDIALS_BY_SYMBOL.get(symbols[at] ?? "");
  if (medial !== undefined) {
    at += 1;
  }
  // ㄦ is the 儿化 suffix everywhere except at the very front of a syllable,
  // where it is the rhyme of 儿 ér itself. That is what separates ㄦ from ㄕㄦ:
  // 事儿 shìr writes no rhyme at all, so the ㄦ can only be the suffix, and
  // 二儿 èr with a suffix is ㄦㄦ.
  const isSuffix = at > 0 && symbols[at] === "ㄦ";
  const rhyme = isSuffix ? undefined : RHYMES_BY_SYMBOL.get(symbols[at] ?? "");
  if (rhyme !== undefined) {
    at += 1;
  }
  const hasErhua = at > 0 && symbols[at] === "ㄦ";
  if (hasErhua) {
    at += 1;
  }

  return at === symbols.length
    ? {
        initial: initial ?? "",
        medial: medial ?? "",
        rhyme: rhyme ?? "",
        hasErhua,
      }
    : undefined;
}

/**
 * Resolve parsed symbols to an underlying final.
 *
 * ㄨㄥ is the one context-dependent rhyme in the system: with an initial it is
 * `ong` (中 ㄓㄨㄥ) and without one it is `ueng` (翁 ㄨㄥ). Everything else
 * reads the same wherever it stands.
 */
function finalOf(parsed: Parsed): Final | undefined {
  const { initial, medial, rhyme } = parsed;
  if (medial === "" && rhyme === "") {
    return EMPTY_RHYME_INITIALS.has(initial) ? "i" : undefined;
  }
  if (medial === "u" && rhyme === "eng") {
    return initial === "" ? "ueng" : "ong";
  }
  return FINALS_BY_PARTS.get(`${medial}|${rhyme}`);
}

/**
 * Read one parse of a bopomofo string, or nothing if it does not resolve.
 */
function readParsed(text: string, hasInitial: boolean): Syllable | undefined {
  const parsed = parseSymbols(text, hasInitial);
  const final = parsed === undefined ? undefined : finalOf(parsed);
  return parsed === undefined || final === undefined
    ? undefined
    : {
        initial: parsed.initial,
        final,
        tone: undefined,
        ...(parsed.hasErhua && { erhua: true }),
      };
}

/**
 * Read a bopomofo syllable: ㄐㄧㄡˋ becomes 就 jiù.
 *
 * An unmarked syllable is a first tone rather than a toneless one, because
 * bopomofo marks the first tone by leaving it off — the omission is itself
 * written, in a way that a bare `bei` typed as pinyin is not. Undefined for
 * anything that is not exactly one well-formed syllable.
 */
export function readBopomofo(text: string): Syllable | undefined {
  const split = splitTone(text.trim().normalize("NFC"));
  if (split === undefined || split[0] === "") {
    return undefined;
  }
  const [written, tone] = split;

  const read = readParsed(written, true) ?? readParsed(written, false);
  return read === undefined ? undefined : { ...read, tone: tone ?? 1 };
}
