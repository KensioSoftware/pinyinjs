/**
 * Taking the readings out of a 教育部 dictionary's workbook.
 *
 * The workbook has seventeen columns, and only the headword, the order of its
 * readings, its 漢語拼音 and its variant reading are read. Definitions,
 * examples, synonyms and the rest are never parsed. See `moe.ts` for what is
 * done with the readings.
 */
import { HEADER_ROW, readRows, readSharedStrings } from "./xlsx.js";

/**
 * The columns this package reads, by the name the header row gives them.
 *
 * Found by name rather than by letter, because the two dictionaries lay their
 * columns out differently: 《重編國語辭典修訂本》 has 漢語拼音 in column L and
 * 《國語辭典簡編本》 in column J. A release that drops one fails the build
 * rather than reading the wrong column.
 */
const HEADERS = {
  word: "字詞名",
  order: "多音排序",
  pinyin: "漢語拼音",
  variantKind: "變體類型",
  variant: "變體漢語拼音",
} as const;

/**
 * The kinds of variant reading that are readings of the word itself.
 */
const VARIANT_KINDS = new Set(["又音", "語音", "讀音", "或讀"]);

/**
 * Turn a dictionary's worksheet into a table of headword, order and reading.
 *
 * Done once, when the download is cached, so the build reads a small table and
 * never the 125 MB of XML the spreadsheet is made of. The output is one
 * tab-separated line per reading, with a fourth column where the entry gives
 * a variant reading, and the header row is dropped.
 */
export function tabulateMoeWorkbook(
  sharedStringsXml: string,
  sheetXml: string,
): string {
  const strings = readSharedStrings(sharedStringsXml);
  const header = readRows(HEADER_ROW.exec(sheetXml)?.[0] ?? "", strings).get(1);
  // 變體類型 carries its legend in the header, and the two dictionaries'
  // legends differ, so a header is matched on how it starts.
  const columnOf = (name: string): string => {
    const found = [...(header ?? [])].find(([, text]) =>
      text.startsWith(name),
    )?.[0];
    if (found === undefined) {
      throw new Error(`教育部 dictionary has no ${name} column`);
    }
    return found;
  };
  const columns = {
    word: columnOf(HEADERS.word),
    order: columnOf(HEADERS.order),
    pinyin: columnOf(HEADERS.pinyin),
    variantKind: columnOf(HEADERS.variantKind),
    variant: columnOf(HEADERS.variant),
  };
  const rows = readRows(sheetXml, strings, new Set(Object.values(columns)));

  const lines: string[] = [];
  for (const [row, cells] of rows) {
    const word = cells.get(columns.word) ?? "";
    const pinyin = cells.get(columns.pinyin) ?? "";
    if (row === 1 || word === "" || pinyin === "") {
      continue;
    }
    const kind = cells.get(columns.variantKind) ?? "";
    const variant = VARIANT_KINDS.has(kind)
      ? (cells.get(columns.variant) ?? "")
      : "";
    lines.push(
      [
        word,
        orderOf(cells.get(columns.order)),
        spaced(pinyin),
        ...(variant === "" ? [] : [spaced(variant)]),
      ].join("\t"),
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * A headword's 多音排序, which is blank for a headword with one reading.
 */
function orderOf(order: string | undefined): string {
  return order === undefined || order === "" ? "0" : order;
}

/**
 * A reading with its syllables separated by single spaces.
 */
function spaced(pinyin: string): string {
  return pinyin.replaceAll(/\s+/gu, " ");
}
