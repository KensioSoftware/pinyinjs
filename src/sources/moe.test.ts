import {
  assertArrayEquals,
  assertIdentical,
  assertThrowsError,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { type MoeReading, parseMoeReadings, preferReadings } from "./moe.js";
import { tabulateMoeWorkbook } from "./moe-workbook.js";

/**
 * A shared string table holding these strings, in order.
 */
function sharedStrings(strings: readonly string[]): string {
  const entries = strings.map((text) => `<si><t>${text}</t></si>`).join("");
  return `<?xml version="1.0"?><sst count="${String(strings.length)}">${entries}</sst>`;
}

/**
 * A worksheet whose rows are given cell by cell, each cell a column letter and
 * either an index into the shared strings or a number.
 */
function sheet(
  rows: readonly (readonly [string, number | string][])[],
): string {
  const body = rows
    .map((cells, at) => {
      const row = at + 1;
      const written = cells
        .map(([column, value]) =>
          typeof value === "number"
            ? `<c r="${column}${String(row)}" t="s"><v>${String(value)}</v></c>`
            : `<c r="${column}${String(row)}"><v>${value}</v></c>`,
        )
        .join("");
      return `<row r="${String(row)}">${written}</row>`;
    })
    .join("");
  return `<?xml version="1.0"?><worksheet><sheetData>${body}</sheetData></worksheet>`;
}

/**
 * The header row as 《國語辭典簡編本》 lays it out, with the columns this
 * package does not read standing in for the rest.
 */
const STRINGS = [
  "字詞名",
  "多音排序",
  "注音一式",
  "變體類型 1:變 2:又音 3:語音 4:讀音",
  "漢語拼音",
  "變體漢語拼音",
  "釋義",
  "星期",
  "xīng qí",
  "一會兒",
  "yī huǐr ",
  "變",
  "yì huěr",
  "熟悉",
  "shóu xī",
  "讀音",
  "shú xī",
  "a definition that must not be read",
  "期",
  "qí",
  "jī",
];

const HEADER: readonly [string, number][] = [
  ["A", 0],
  ["F", 1],
  ["G", 2],
  ["H", 3],
  ["J", 4],
  ["K", 5],
  ["N", 6],
];

const WORKBOOK = {
  strings: sharedStrings(STRINGS),
  sheet: sheet([
    HEADER,
    [
      ["A", 7],
      ["J", 8],
      ["N", 17],
    ],
    [
      ["A", 9],
      ["H", 11],
      ["J", 10],
      ["K", 12],
    ],
    [
      ["A", 13],
      ["H", 15],
      ["J", 14],
      ["K", 16],
    ],
    [
      ["A", 18],
      ["F", "2"],
      ["J", 20],
    ],
    [
      ["A", 18],
      ["F", "1"],
      ["J", 19],
    ],
  ]),
};

/**
 * A headword's readings as {@link parseMoeReadings} gives them, written out.
 */
function readingsOf(
  readings: ReadonlyMap<string, readonly MoeReading[]>,
  word: string,
): readonly string[] {
  return (readings.get(word) ?? []).map((reading) =>
    [
      reading.readings.join(" "),
      ...(reading.variant === undefined ? [] : [reading.variant.join(" ")]),
    ].join(" / "),
  );
}

describe("reading 教育部's dictionaries", () => {
  describe("tabulating a workbook", () => {
    it("keeps the headword, the order and the reading", () => {
      const table = tabulateMoeWorkbook(WORKBOOK.strings, WORKBOOK.sheet);
      assertArrayEquals(table.split("\n").slice(0, 1), ["星期\t0\txīng qí"]);
    });

    it("never takes a definition", () => {
      const table = tabulateMoeWorkbook(WORKBOOK.strings, WORKBOOK.sheet);
      assertUndefined(
        table.split("\n").find((line) => line.includes("definition")),
      );
    });

    it("keeps a variant that is a reading of the word", () => {
      // 讀音 is the literary reading, and the word is read that way too.
      const table = tabulateMoeWorkbook(WORKBOOK.strings, WORKBOOK.sheet);
      assertIdentical(
        table.split("\n").find((line) => line.startsWith("熟悉")),
        "熟悉\t0\tshóu xī\tshú xī",
      );
    });

    it("drops a variant that is a tone change in connected speech", () => {
      // 變 is what 一 does before a fourth tone, which the merge leaves to the
      // runtime sandhi pass.
      const table = tabulateMoeWorkbook(WORKBOOK.strings, WORKBOOK.sheet);
      assertIdentical(
        table.split("\n").find((line) => line.startsWith("一會兒")),
        "一會兒\t0\tyī huǐr",
      );
    });

    it("finds its columns by name, wherever they are", () => {
      // 《重編國語辭典修訂本》 has its reading in column L, not J.
      const moved = sheet([
        [
          ["A", 0],
          ["H", 1],
          ["I", 3],
          ["L", 4],
          ["M", 5],
        ],
        [
          ["A", 7],
          ["L", 8],
        ],
      ]);
      assertIdentical(
        tabulateMoeWorkbook(WORKBOOK.strings, moved),
        "星期\t0\txīng qí\n",
      );
    });

    it("fails when a column it reads is gone", () => {
      const missing = sheet([
        [
          ["A", 0],
          ["F", 1],
        ],
      ]);
      assertThrowsError(() => tabulateMoeWorkbook(WORKBOOK.strings, missing));
    });

    it("reads a string written inline rather than shared", () => {
      const header = sheet([HEADER]).replace("</sheetData>", "");
      const inline =
        `${header}<row r="2">` +
        `<c r="A2" t="inlineStr"><is><t>期</t></is></c>` +
        `<c r="J2" t="inlineStr"><is><t>q&amp;í</t></is></c>` +
        `</row></sheetData></worksheet>`;
      assertIdentical(
        tabulateMoeWorkbook(WORKBOOK.strings, inline),
        "期\t0\tq&í\n",
      );
    });
  });

  describe("parsing the table", () => {
    const table = tabulateMoeWorkbook(WORKBOOK.strings, WORKBOOK.sheet);

    it("keys each headword's readings in the dictionary's order", () => {
      assertArrayEquals(readingsOf(parseMoeReadings(table, "concise"), "期"), [
        "qí",
        "jī",
      ]);
    });

    it("splits 儿化 off as CC-CEDICT writes it", () => {
      assertArrayEquals(
        readingsOf(parseMoeReadings(table, "concise"), "一會兒"),
        ["yī huǐ r5"],
      );
    });

    it("leaves 兒 alone where it is a syllable of its own", () => {
      const readings = parseMoeReadings("女兒\t0\tnǚ ér\n", "concise");
      assertArrayEquals(readingsOf(readings, "女兒"), ["nǚ ér"]);
    });

    it("carries the variant beside the reading", () => {
      assertArrayEquals(
        readingsOf(parseMoeReadings(table, "concise"), "熟悉"),
        ["shóu xī / shú xī"],
      );
    });

    it("records which dictionary a reading came from", () => {
      const readings = parseMoeReadings(table, "revised");
      assertIdentical(readings.get("星期")?.[0]?.dictionary, "revised");
    });

    it("skips a line with no reading", () => {
      assertUndefined(parseMoeReadings("星期\t0\t\n\n", "concise").get("星期"));
    });
  });

  describe("preferring one dictionary to the other", () => {
    const concise = parseMoeReadings(
      "它們\t0\ttā men\n玩\t0\twán\n",
      "concise",
    );
    const revised = parseMoeReadings(
      "它們\t0\ttuō men\n玩\t1\twàn\n玩\t2\twán\n五百\t0\twǔ bó\n",
      "revised",
    );
    const preferred = preferReadings(concise, revised);

    it("takes a word both list from the first", () => {
      assertArrayEquals(readingsOf(preferred, "它們"), ["tā men"]);
    });

    it("takes a word only the second lists from it", () => {
      assertArrayEquals(readingsOf(preferred, "五百"), ["wǔ bó"]);
    });

    it("keeps both dictionaries' readings of a character", () => {
      assertArrayEquals(readingsOf(preferred, "玩"), ["wán", "wàn", "wán"]);
    });
  });
});
