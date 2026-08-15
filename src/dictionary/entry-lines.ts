/**
 * The entry blob read as lines and columns, and nothing above that.
 *
 * `Dictionary` never parses its artifact; it scans for separators and slices.
 * That scanning is a concern of its own — it is the only code that knows the
 * blob is tab-separated columns one line per key — so it sits here, and the
 * dictionary above it deals in positions and words.
 */

/**
 * Separator between a line's columns, matching what the artifact writes.
 */
const COLUMN = "\t";

const LINE = "\n";

/**
 * A blob of entry lines, indexed by position.
 */
export class EntryLines {
  /**
   * Scan a blob for its line starts.
   *
   * The scan is the whole of the load cost: an `indexOf` per line, and no
   * allocation beyond the offsets themselves. Everything after it is a slice.
   */
  static from(entries: string): EntryLines {
    const starts: number[] = [0];
    let separator = entries.indexOf(LINE);
    while (separator !== -1) {
      starts.push(separator + 1);
      separator = entries.indexOf(LINE, separator + 1);
    }
    starts.push(entries.length + 1);
    return new EntryLines(entries, Uint32Array.from(starts));
  }

  readonly #entries: string;
  readonly #lineStarts: Uint32Array;

  private constructor(entries: string, lineStarts: Uint32Array) {
    this.#entries = entries;
    this.#lineStarts = lineStarts;
  }

  /**
   * The columns of the line at a position.
   */
  columnsAt(at: number): readonly string[] {
    const start = this.#lineStarts[at];
    const nextStart = this.#lineStarts[at + 1];
    /* c8 ignore next 3 -- every position comes from a successful key lookup */
    if (start === undefined || nextStart === undefined) {
      return [];
    }
    return this.#entries.slice(start, nextStart - 1).split(COLUMN);
  }

  /**
   * The reading column of a line, without slicing or splitting the rest of it.
   *
   * Deriving a word's reading needs its characters' readings and nothing else
   * about them, and this is asked of every line in the dictionary during a
   * reverse index build, so the other four columns are never touched.
   */
  readingColumnAt(at: number): string {
    const start = this.#lineStarts[at];
    const nextStart = this.#lineStarts[at + 1];
    if (start === undefined || nextStart === undefined) {
      return "";
    }
    const end = nextStart - 1;
    const column = this.#entries.indexOf(COLUMN, start);
    return this.#entries.slice(
      start,
      column === -1 || column > end ? end : column,
    );
  }
}
