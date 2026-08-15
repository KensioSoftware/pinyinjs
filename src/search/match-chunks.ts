/**
 * How much of a query one whole reading can account for.
 *
 * The smallest step the search takes, and the only part of it that looks at the
 * query's letters rather than at the haystack's characters. Kept apart from the
 * walk because it is a pure question about two strings — no dictionary, no
 * memo, no score — which is what makes the walk above it readable as a walk.
 */
import type { Syllable } from "../syllable/syllable.js";
import { type QueryChunk, readQueryChunks, skipSeparators } from "./query.js";

/**
 * Every position the query can be read up to by one whole reading.
 *
 * A reading is usually one syllable, and is not always: 瓩 is `qiānwǎ`, one
 * character read as two. The query accounts for them in order, and may run
 * out partway through, which is a query still being typed.
 */
export function chunksFor(
  query: string,
  from: number,
  reading: readonly Syllable[],
): readonly QueryChunk[] {
  let reached: readonly QueryChunk[] = [{ next: from, isFull: true }];
  for (const syllable of reading) {
    const found: QueryChunk[] = [];
    for (const chunk of reached) {
      const start = skipSeparators(query, chunk.next);
      if (start === query.length) {
        found.push({ next: start, isFull: chunk.isFull });
        continue;
      }
      for (const one of readQueryChunks(query, start, syllable)) {
        found.push({
          next: one.next,
          isFull: chunk.isFull && one.isFull,
        });
      }
    }
    reached = found;
  }
  return reached;
}
