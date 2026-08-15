/**
 * Taking a written syllable apart into an initial and a final.
 *
 * The tables that spelling needs — the palatal finals, the abbreviations
 * pinyin writes, the zero-initial forms — and the reading that uses them.
 * `syllable.ts` puts the parts back together with a tone.
 */
import {
  AFTER_INITIAL_SPELLINGS,
  type Final,
  INITIALS,
  type Initial,
  isFinal,
  isPalatalInitial,
} from "./phonology.js";

import {
  ABBREVIATED_FINALS,
  PALATAL_FINALS,
  STANDALONE_FINALS,
  ZERO_INITIAL_FINALS,
} from "./final-tables.js";

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
export function readParts(
  spelling: string,
): readonly [Initial, Final] | undefined {
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
