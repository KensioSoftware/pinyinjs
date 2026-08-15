import type { Final } from "../syllable/phonology.js";
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
import type { Syllable } from "../syllable/syllable.js";
import { EMPTY_RHYME_INITIALS } from "./bopomofo-symbols.js";

export {
  type BopomofoOptions,
  writeBopomofo,
  writeBopomofoWord,
} from "./bopomofo-symbols.js";
import { FINALS_BY_PARTS } from "./bopomofo-reverse.js";
import { type Parsed, parseSymbols, splitTone } from "./bopomofo-parse.js";

export { isBopomofo } from "./bopomofo-reverse.js";

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
