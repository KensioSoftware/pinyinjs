/**
 * The script tables' on-disk format: its separators and its line tags.
 *
 * Both halves of the format — writing the file and reading it back — are held
 * to the same answers here, which is what stops the two drifting apart.
 */

export const COLUMN = "\t";

export const LINE = "\n";

export const READING = ",";

export const READING_FORM = "=";

/**
 * Line tags, one per table, so that all six ship as one fetchable file.
 */
export const TAGS = {
  toTraditional: "t",
  toSimplified: "s",
  traditionalWord: "w",
  simplifiedWord: "x",
  hansOnly: "h",
  hantOnly: "H",
} as const;
