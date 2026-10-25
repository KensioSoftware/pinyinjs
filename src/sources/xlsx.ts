/**
 * Reading cells out of a spreadsheet's XML, as an `.xlsx` workbook stores
 * them: a worksheet of cells, and a table of the strings they share.
 *
 * Only as much of the format as 教育部's downloads use. Formulas, styles and
 * the other sheets of a workbook are never read.
 */

/**
 * The header row of a worksheet.
 */
export const HEADER_ROW = /<row r="1"[\s\S]*?<\/row>/u;

/**
 * One cell of a worksheet: its attributes and whatever is inside it.
 */
const CELL = /<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu;

/**
 * One entry of the shared string table.
 */
const SHARED_STRING = /<si>([\s\S]*?)<\/si>/gu;

/**
 * The text runs of a string, which rich text splits into several.
 */
const TEXT_RUN = /<t(?: [^>]*)?>([^<]*)<\/t>/gu;

/**
 * Undo the escaping XML applies to text.
 */
function unescapeXml(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

/**
 * The text of a cell's string, joining its runs.
 */
function textOf(xml: string): string {
  return unescapeXml(
    [...xml.matchAll(TEXT_RUN)].map((run) => run[1] ?? "").join(""),
  );
}

/**
 * Read the workbook's shared string table.
 */
export function readSharedStrings(xml: string): readonly string[] {
  return [...xml.matchAll(SHARED_STRING)].map((entry) =>
    textOf(entry[1] ?? ""),
  );
}

/**
 * Read a worksheet's cells into rows, keeping only the columns asked for.
 */
export function readRows(
  sheetXml: string,
  strings: readonly string[],
  wanted?: ReadonlySet<string>,
): Map<number, Map<string, string>> {
  const rows = new Map<number, Map<string, string>>();
  for (const cell of sheetXml.matchAll(CELL)) {
    const attributes = cell[1] ?? "";
    const reference = /\br="([A-Z]+)(\d+)"/u.exec(attributes);
    const column = reference?.[1];
    if (column === undefined || wanted?.has(column) === false) {
      continue;
    }
    const body = cell[2] ?? "";
    const value = /<v>([^<]*)<\/v>/u.exec(body)?.[1];
    let text: string;
    if (/\bt="s"/u.test(attributes)) {
      text = strings[Number(value)] ?? "";
    } else if (value === undefined) {
      text = textOf(body);
    } else {
      text = unescapeXml(value);
    }
    const row = Number(reference?.[2]);
    const cells = rows.get(row) ?? new Map<string, string>();
    cells.set(column, text.trim());
    rows.set(row, cells);
  }

  return rows;
}
