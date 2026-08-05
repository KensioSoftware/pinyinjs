import {
  type ConvertedPiece,
  type ConvertOptions,
  convertPieces,
} from "../decode/convert.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { writeWadeGilesWord } from "../transcription/wade-giles.js";
import type { Syllable } from "../syllable/syllable.js";

/**
 * How a system writes a run of syllables that are one word.
 *
 * Every system in `src/transcription/` exports one: `writeWadeGilesWord`,
 * `writeBopomofoWord` and the rest. What each of them decides is only the
 * join* — Wade-Giles hyphenates, Yale and Gwoyeu Romatzyh write solid,
 * bopomofo spaces — which is the whole of the difference between them at this
 * level.
 */
export type WriteWord = (syllables: readonly Syllable[]) => string;

/**
 * What a system wants of the capitals the conversion settled.
 *
 * `capitals` is whether the system writes them at all, and it defaults to true
 * because a romanisation does: Wade-Giles, Yale and Gwoyeu Romatzyh are ways of
 * writing Chinese in the Latin alphabet, so a proper noun and the first word of
 * a sentence take a capital in each of them exactly as they do in pinyin.
 *
 * **IPA is not a romanisation and takes none.** It is a transcription, and its
 * letters are symbols rather than an alphabet: `[T]` is not `[t]` in a larger
 * size but a symbol the IPA does not have, and `[Tʰa˥]` for 他 is not a louder
 * `[tʰa˥]` but nothing at all. Bopomofo is a script without case, so it says
 * the same thing for a different reason — nothing there has a capital to write
 * either.
 */
export interface TranscriptionOptions {
  readonly capitals?: boolean;
}

/**
 * Whether a piece was written with a capital.
 *
 * Read off the text the conversion produced rather than recomputed, because
 * capitalisation is settled by {@link convertPieces} against the whole sentence
 * — a proper noun, or the first word after a full stop — and none of that
 * survives in a bare {@link Syllable}.
 */
function isCapitalised(text: string): boolean {
  const first = /\p{L}/u.exec(text)?.[0];
  return first !== undefined && first !== first.toLowerCase();
}

/**
 * Put a capital back on a transcribed word.
 */
function capitalised(text: string): string {
  // Not global: only the first letter of the word takes the capital.
  return text.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}

/**
 * Write a conversion in another transcription system, word by word.
 *
 * **The word segmentation is shared and only the join changes**, which is the
 * question ROADMAP.md left open. GB/T 16159 分词连写 decides what a *word* is,
 * and that is a fact about the language rather than about pinyin: 北京大学 is
 * two words in any system anybody writes it in. What the standard also decides
 * — that a word's syllables are run together, with a 隔音符号 where the
 * boundary would otherwise be lost — is a pinyin spelling rule, and Wade-Giles
 * has its own: a hyphen between every syllable of a word. So the grouping is
 * reused and the join is the system's.
 *
 * That has a consequence worth stating: the 隔音符号 is **not** written. It
 * would be wrong twice over — the hyphen has already marked the boundary, and
 * Wade-Giles spends the apostrophe on aspiration, so `Hsi'an` would read as a
 * syllable `hsi` followed by an aspirated one.
 *
 * The output inherits the grouping's own limits along with its judgements.
 * 清华大学 is one decoded word that the 专名 rule divides, so this writes
 * `Ch'ing-hua Ta-hsüeh` where the attested form is `Ch'ing-hua ta-hsüeh` — a
 * capital the grouping applies, not a hyphen rule that is wrong. See
 * `docs/romanization/` for what that costs, counted.
 *
 * Takes the pieces {@link convertPieces} produces, as `toHtml` does, so that
 * one conversion can be rendered more than one way.
 *
 * `{ capitals: false }` drops the capitals rather than carrying them over, for
 * the systems that have none to write — see {@link TranscriptionOptions}.
 */
export function toTranscription(
  pieces: readonly ConvertedPiece[],
  writeWord: WriteWord,
  options: TranscriptionOptions = {},
): string {
  const { capitals = true } = options;
  const written: string[] = [];
  let word: Syllable[] = [];
  let hasCapital = false;

  const flush = (): void => {
    if (word.length === 0) {
      return;
    }
    const one = writeWord(word);
    written.push(hasCapital && capitals ? capitalised(one) : one);
    word = [];
    hasCapital = false;
  };

  for (const piece of pieces) {
    if (piece.syllable === undefined) {
      flush();
      written.push(piece.text);
      continue;
    }
    // Adjacent syllable pieces are one word: the conversion puts a piece of
    // its own between two of them wherever it wrote a space.
    hasCapital ||= word.length === 0 && isCapitalised(piece.text);
    word.push(piece.syllable);
  }
  flush();
  return written.join("");
}

/**
 * Convert hanzi to Wade-Giles, end to end.
 *
 * hanzi → pinyin → Wade-Giles, which is the shape ROADMAP.md predicted for the
 * whole `transcription` module: a transcription needs no dictionary of its own,
 * so the only hard problem is the one {@link convertPieces} already solved.
 *
 * Tones are raised digits by default, as {@link writeWadeGilesWord} writes
 * them; `{ notation: "none" }` leaves them off, which is how nearly all real
 * Wade-Giles is written.
 */
export function convertToWadeGiles(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  return toTranscription(
    convertPieces(dictionary, text, options),
    (syllables) =>
      writeWadeGilesWord(
        syllables,
        options.notation === "none" ? { tones: "none" } : {},
      ),
  );
}
