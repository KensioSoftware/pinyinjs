import { toCharacters } from "../script/characters.js";

/**
 * How a text pass rewrites a run of characters, one output string per input
 * character.
 *
 * Length-preserving in characters rather than in text: a pass may write a
 * character as more than one — a full-width comma becomes a comma and a space —
 * or as none, so long as it writes exactly one string for each.
 */
export type RewriteCharacters = (
  characters: readonly string[],
) => readonly string[];

/**
 * Apply a text pass across parts that must stay separate.
 *
 * The orthography's last two passes read across the whole conversion: a
 * sentence capital belongs to whichever word starts the sentence, and a mark
 * needs to know whether anything follows it before it takes a space. That is
 * fine while the output is one string, and not fine once it is a list of
 * syllables to be wrapped one by one. Running the same pass over the characters
 * of every part at once, then handing each part its own characters back, keeps
 * one implementation for both.
 */
export function rewriteParts(
  parts: readonly string[],
  rewrite: RewriteCharacters,
): readonly string[] {
  const owners: number[] = [];
  const characters: string[] = [];
  for (const [at, part] of parts.entries()) {
    for (const character of toCharacters(part)) {
      characters.push(character);
      owners.push(at);
    }
  }

  const rewritten = rewrite(characters);
  const written: string[] = Array.from({ length: parts.length }, () => "");
  for (const [at, owner] of owners.entries()) {
    /* c8 ignore next 2 -- owners are indices of parts, and rewrite keeps its
       output the same length as its input */
    written[owner] = (written[owner] ?? "") + (rewritten[at] ?? "");
  }

  return written;
}
