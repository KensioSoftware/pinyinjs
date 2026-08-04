import {
  normaliseUmlaut,
  readSyllable,
  type Syllable,
} from "../syllable/syllable.js";
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";

/**
 * The token CC-CEDICT uses to mark 儿化 on the syllable before it.
 *
 * It is a suffix, not a syllable: `玩兒 玩儿 [wan2 r5]` is one syllable, `wánr`.
 */
const ERHUA_TOKEN = "r5";

/**
 * Characters whose tone is fixed underlyingly, whatever a source writes.
 *
 * 一 and 不 are the only two characters in Mandarin whose written tone varies by
 * context rather than by meaning. Sources bake that sandhi in, and do so
 * inconsistently — `一不小心` arrives as `yí bù xiǎo xīn` but `一丁不识` as
 * `yī dīng bù shí`. The dictionary stores the underlying tone and applies sandhi
 * at runtime, so both are normalised back here.
 *
 * Keyed by character and matched against the syllable's shape, so that a source
 * giving 一 some unrelated reading is left alone rather than silently retoned.
 */
const UNDERLYING_TONES = new Map<
  string,
  { readonly initial: string; readonly final: string; readonly tone: Tone }
>([
  ["一", { initial: "", final: "i", tone: 1 }],
  ["不", { initial: "b", final: "u", tone: 4 }],
]);

/**
 * Restore a syllable's underlying tone, and read an unmarked one as neutral.
 *
 * Source dictionaries write an unmarked syllable to mean the neutral tone —
 * `de(5096)` for 得 is 轻声. That is the opposite of how user input is read,
 * where an unmarked syllable means the tone simply was not written.
 */
function normaliseSourceSyllable(
  syllable: Syllable,
  character: string,
): Syllable {
  const tone = syllable.tone ?? NEUTRAL_TONE;
  const underlying = UNDERLYING_TONES.get(character);
  if (underlying === undefined) {
    return { ...syllable, tone };
  }
  const isExpectedReading =
    underlying.initial === syllable.initial &&
    underlying.final === syllable.final;
  return { ...syllable, tone: isExpectedReading ? underlying.tone : tone };
}

/**
 * Turn a source dictionary's reading of a word into syllables.
 *
 * Applies every repair the merge step owns: `u:` and `v` become ü, a trailing
 * `r5` becomes 儿化 on the syllable before it, an unmarked tone is read as
 * neutral, and 一 and 不 are restored to their underlying tones.
 *
 * Returns undefined when the reading cannot be trusted — a token that is not a
 * syllable, or a syllable count that does not match the word. A mismatch means
 * an upstream defect not yet accounted for, and such an entry must be kept out
 * of the dictionary rather than guessed at.
 *
 * Measured over the real sources: every one of the 411,956 phrase corpus entries
 * is accepted, and 99.38% of CC-CEDICT. The rejections there are all headwords
 * mixing digits and Latin letters — `3D打印`, `4S店`, `11區` — whose readings
 * include literal characters (`D`, `S`) or numbers spelled out (`san1` for 3).
 * Those belong to the numerals package rather than here, so rejecting them is
 * the intended behaviour rather than a gap.
 */
export function readDictionaryReading(
  word: string,
  readings: readonly string[],
): readonly Syllable[] | undefined {
  // Matched rather than spread, so that characters outside the BMP stay whole
  // and the linter's spread-on-string rule is not fought over every word.
  const characters = word.match(/./gsu) ?? [];
  const syllables: Syllable[] = [];
  let consumed = 0;

  for (const reading of readings) {
    if (reading === ERHUA_TOKEN) {
      const previous = syllables.at(-1);
      // An r5 with nothing before it, or with no 儿 to account for, is broken.
      if (previous === undefined || consumed >= characters.length) {
        return undefined;
      }
      syllables[syllables.length - 1] = { ...previous, erhua: true };
      consumed++;
      continue;
    }

    const character = characters[consumed];
    if (character === undefined) {
      return undefined;
    }
    const syllable = readSyllable(normaliseUmlaut(reading));
    if (syllable === undefined) {
      return undefined;
    }
    syllables.push(normaliseSourceSyllable(syllable, character));
    consumed++;
  }

  return consumed === characters.length && syllables.length > 0
    ? syllables
    : undefined;
}
