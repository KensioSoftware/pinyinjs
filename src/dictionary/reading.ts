import {
  normaliseUmlaut,
  readSyllable,
  type Syllable,
} from "../syllable/syllable.js";
import { toCharacters } from "../script/characters.js";
import { NEUTRAL_TONE, type Tone } from "../tone/tone.js";
import { withErhua } from "./erhua.js";

/**
 * The token CC-CEDICT uses to mark 儿化 on the syllable before it.
 *
 * It is a suffix, not a syllable: `玩兒 玩儿 [wan2 r5]` is one syllable, `wánr`.
 */
export const ERHUA_TOKEN = "r5";

/**
 * A reading token that is punctuation rather than a syllable.
 *
 * CC-CEDICT records the comma of a two-clause proverb as a reading of its own:
 * 一不做，二不休 reads `yi1 bu4 zuo4 , er4 bu4 xiu1`. The comma accounts for the
 * 、character in the headword and contributes no syllable, so it has to be
 * consumed rather than rejected — 642 entries, almost all of them 谚语, depend
 * on it.
 */
const PUNCTUATION_TOKEN = /^[\p{P}\p{S}]+$/u;

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
 * One syllable of a reading, together with the characters it reads.
 *
 * Usually one character to one syllable, but not always: 儿化 gives two
 * characters one syllable (玩儿 is `wánr`), and punctuation gives a character no
 * syllable at all.
 */
export interface ReadCharacters {
  /** The characters this syllable reads, in the order the word writes them. */
  readonly characters: string;
  /** The syllable, or undefined for punctuation, which is written but unread. */
  readonly syllable: Syllable | undefined;
}

/**
 * Align a source dictionary's reading of a word against the word's characters.
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
 * The alignment matters beyond validation: deriving a traditional form needs to
 * know which syllable reads which character, since it is the reading that picks
 * between 發 and 髮 for 发.
 *
 * Measured over the real sources: every one of the 411,956 phrase corpus entries
 * is accepted, and 99.88% of CC-CEDICT's 124,754. What remains rejected are
 * headwords mixing digits and Latin letters — `3D打印`, `4S店`, `11區` — whose
 * readings include literal characters (`D`, `S`) or numbers spelled out (`san1`
 * for 3). Reading those aloud is the numerals package's job, and CC-CEDICT's own
 * readings for them are a useful worked set for it, so they are deferred rather
 * than discarded.
 */
export function readAlignedReading(
  word: string,
  readings: readonly string[],
): readonly ReadCharacters[] | undefined {
  const characters = toCharacters(word);
  const aligned: ReadCharacters[] = [];
  let consumed = 0;

  /**
   * Take the next character as read by nothing, which is what punctuation is.
   */
  const takeUnread = (): void => {
    aligned.push({
      /* c8 ignore next -- only called once the character is known to be there */
      characters: characters[consumed] ?? "",
      syllable: undefined,
    });
    consumed++;
  };

  for (const reading of readings) {
    if (reading === ERHUA_TOKEN) {
      const previous = aligned.at(-1);
      // An r5 with nothing before it, or with no 儿 to account for, is broken.
      if (
        previous?.syllable === undefined ||
        consumed >= characters.length ||
        previous.syllable.erhua === true
      ) {
        return undefined;
      }
      aligned[aligned.length - 1] = {
        /* c8 ignore next -- guarded by the bounds check just above */
        characters: previous.characters + (characters[consumed] ?? ""),
        syllable: withErhua(previous.syllable),
      };
      consumed++;
      continue;
    }

    // Punctuation the source gave no reading for, such as the · separating the
    // parts of a transliterated name: 亞西爾·阿拉法特 is read as seven syllables
    // for eight characters. Skipped so the rest stays aligned.
    while (
      !PUNCTUATION_TOKEN.test(reading) &&
      PUNCTUATION_TOKEN.test(characters[consumed] ?? "")
    ) {
      takeUnread();
    }

    const character = characters[consumed];
    if (character === undefined) {
      return undefined;
    }

    // Punctuation that does have a reading lines up with a punctuation
    // character and produces no syllable, which is what keeps multi-clause
    // proverbs readable.
    if (PUNCTUATION_TOKEN.test(reading)) {
      if (!PUNCTUATION_TOKEN.test(character)) {
        return undefined;
      }
      takeUnread();
      continue;
    }
    const syllable = readSyllable(normaliseUmlaut(reading));
    if (syllable === undefined) {
      return undefined;
    }
    aligned.push({
      characters: character,
      syllable: normaliseSourceSyllable(syllable, character),
    });
    consumed++;
  }

  // Trailing punctuation, likewise unread.
  while (PUNCTUATION_TOKEN.test(characters[consumed] ?? "")) {
    takeUnread();
  }

  if (consumed !== characters.length) {
    return undefined;
  }
  return aligned.some((read) => read.syllable !== undefined)
    ? aligned
    : undefined;
}

/**
 * Turn a source dictionary's reading of a word into syllables.
 *
 * The syllables of {@link readAlignedReading}, for callers that do not need to
 * know which character each one reads.
 */
export function readDictionaryReading(
  word: string,
  readings: readonly string[],
): readonly Syllable[] | undefined {
  const aligned = readAlignedReading(word, readings);
  return aligned
    ?.map((read) => read.syllable)
    .filter((syllable) => syllable !== undefined);
}
