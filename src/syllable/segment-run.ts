/**
 * Reading a run of pinyin with no boundaries written in it.
 *
 * `split.ts` deals with the boundaries a word does write, the apostrophes and
 * the hyphens, and hands each run between them here. What happens here is a
 * search: every way of cutting the run into syllables, scored, with the
 * cheapest kept. This is the syllables inside one word, and not
 * `decode/segment.ts`, which is the words inside a text.
 */
import {
  isPieceAttested,
  isPieceWellMarked,
  LONGEST_SYLLABLE,
  readPiece,
  type RunTables,
  tablesFor,
} from "./run-tables.js";

/**
 * A reading of a run, and what it costs.
 *
 * A syllable costs a point, and a syllable whose tone mark is out of place
 * costs another. A misplaced mark is therefore worth exactly one syllable
 * boundary, which is what keeps the reader's slip readable while letting the
 * mark decide a split that is otherwise a tie. `xīa` stays whole, since `xī`
 * + `a` costs the same two points and the longer piece holds the tie; `xīan1`
 * comes apart as `xī` + `an1`, which is the same two pieces without the
 * misplaced mark and so a point cheaper than `xīa` + `n1`.
 */
interface Segmentation {
  readonly syllables: readonly string[];
  readonly cost: number;
}

/**
 * What one pass over a run found, and whether its own rules bound it.
 */
interface PassReading {
  readonly reading: Segmentation | undefined;
  readonly wasConstrained: boolean;
}

/**
 * Read a run of pinyin with no explicit boundaries as syllables, as cheaply as
 * it can be read.
 *
 * Works longest-first, which is what the orthography assumes: an apostrophe is
 * required exactly where the longest-first reading would be wrong, so `xian` is
 * one syllable and 西安 must be written `Xī'ān` to be read as two. Cost breaks
 * that habit only where a tone mark says the boundary lies elsewhere, and ties
 * go to the longer piece, so a run with every mark in place reads as it always
 * did.
 *
 * `isSeparated` carries the other half of the apostrophe rule. Longest-first
 * alone reads `guórén` as `guór'én` and `huángěi` as `huáng'ěi`, both of which
 * the missing apostrophe rules out — so a run is first read with a/o/e barred
 * from starting any syllable but the first, and only falls back to plain
 * longest-first where that finds nothing or costs more. The fallback is what
 * keeps input tolerant: `hǎiōu` is written wrong, and still reads as two
 * syllables.
 *
 * The separated pass also holds out for real syllables rather than merely
 * well-formed ones, because barring a vowel otherwise pushes it into nonsense:
 * `Tiānānmén` would come apart as `tiā nān mén` where `tiā` is not a syllable
 * of the language at all.
 *
 * Read back to front, one suffix at a time, since without that a long run of
 * ambiguous syllables would backtrack exponentially.
 *
 * Reports whether either of the separated pass's own rules ever ruled a piece
 * out, which is what tells {@link segmentRun} that the fallback has nothing
 * new to find.
 */
function readRun(
  run: string,
  tables: RunTables,
  isSeparated: boolean,
): PassReading {
  const readings = Array.from<Segmentation | undefined>({
    length: run.length + 1,
  });
  readings[run.length] = { syllables: [], cost: 0 };
  let wasConstrained = false;

  for (let at = run.length - 1; at >= 0; at--) {
    let best: Segmentation | undefined;
    const furthest = Math.min(run.length, at + LONGEST_SYLLABLE);
    for (let end = furthest; end > at; end--) {
      const rest = readings[end];
      if (rest === undefined) {
        continue;
      }
      // A piece costs a point at least, so a candidate that cannot come in
      // under the best reading so far is not worth reading at all. Ties are
      // pruned with the rest, which is what leaves them to the longer piece.
      if (best !== undefined && rest.cost + 1 >= best.cost) {
        continue;
      }
      // A syllable is written with one tone, so a second mark is a second
      // syllable: `dìèr` is 第二 with the apostrophe left out.
      /* c8 ignore next 2 -- unreachable: both indices are inside the run */
      const marks =
        (tables.marksBefore[end] ?? 0) - (tables.marksBefore[at] ?? 0);
      if (marks > 1) {
        continue;
      }
      if (isSeparated && tables.isSeparableAt[end] === true) {
        wasConstrained = true;
        continue;
      }
      const piece = run.slice(at, end);
      const syllable = readPiece(tables, piece);
      if (syllable === undefined) {
        continue;
      }
      if (isSeparated && !isPieceAttested(tables, piece, syllable)) {
        wasConstrained = true;
        continue;
      }
      const cost =
        rest.cost +
        (marks === 0 || isPieceWellMarked(tables, piece, syllable) ? 1 : 2);
      if (best === undefined || cost < best.cost) {
        best = { syllables: [piece, ...rest.syllables], cost };
      }
    }
    readings[at] = best;
  }

  return { reading: readings[0], wasConstrained };
}

/**
 * Segment a run, honouring the apostrophe rule where it can be honoured.
 *
 * The separated reading wins every tie, so the rule holds wherever it can. It
 * gives way only to a cheaper reading, which is a reading leaving fewer tone
 * marks out of place: `xīan1` reads as `xīa` + `n1` under the rule, and as `xī`
 * + `an1` without it, and the mark on `xī` is what says the second is meant.
 */
export function segmentRun(run: string): readonly string[] | undefined {
  const tables = tablesFor(run);
  const separated = readRun(run, tables, true);
  // Where neither of the separated pass's rules ever ruled a piece out, the two
  // passes were choosing between the same readings and reached the same one.
  if (separated.reading !== undefined && !separated.wasConstrained) {
    return separated.reading.syllables;
  }

  const loose = readRun(run, tables, false).reading;
  if (separated.reading === undefined) {
    return loose?.syllables;
  }
  return loose !== undefined && loose.cost < separated.reading.cost
    ? loose.syllables
    : separated.reading.syllables;
}
