import {
  assertArrayEquals,
  assertIdentical,
  assertMapSize,
  assertNonNullable,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { openCcDefault, parseOpenCcTable } from "./opencc.js";

/**
 * Real lines from OpenCC's `TWVariants.txt` and `HKVariants.txt`, including the
 * header comment and the `@reverse-prefer` directive that rides in a comment.
 */
const SAMPLE = [
  "# Open Chinese Convert (OpenCC) Dictionary",
  "# File: TWVariants.txt",
  "# Format: key\tvalue(s) (values separated by spaces)",
  "",
  "峯\t峰",
  "裏\t裡",
  "着\t著",
  "# @reverse-prefer: 梁",
  "梁\t梁",
  "樑\t梁 樑",
  "只\t只 衹",
  "麼\t麼 么",
].join("\n");

describe("OpenCC tables", () => {
  describe("parseOpenCcTable", () => {
    it("reads a one-to-one mapping", () => {
      const table = parseOpenCcTable(SAMPLE);
      assertArrayEquals([...(table.get("峯") ?? [])], ["峰"]);
    });

    it("keeps every value of a one-to-many mapping, in order", () => {
      const table = parseOpenCcTable(SAMPLE);
      assertArrayEquals([...(table.get("樑") ?? [])], ["梁", "樑"]);
      assertArrayEquals([...(table.get("只") ?? [])], ["只", "衹"]);
    });

    it("keeps a key that maps to itself", () => {
      const table = parseOpenCcTable(SAMPLE);
      // Distinct from an absent key: 梁 is attested as already standard.
      assertArrayEquals([...(table.get("梁") ?? [])], ["梁"]);
    });

    it("ignores comment lines, including the @reverse-prefer directive", () => {
      const table = parseOpenCcTable(SAMPLE);
      assertUndefined(table.get("# @reverse-prefer: 梁"));
      assertMapSize(table, 7);
    });

    it("returns nothing for an empty file", () => {
      assertMapSize(parseOpenCcTable(""), 0);
    });

    it("skips a line with no value column", () => {
      assertMapSize(parseOpenCcTable("峯\n裏\t裡"), 1);
    });

    it("skips a line whose value column is only spaces", () => {
      assertMapSize(parseOpenCcTable("峯\t  \n裏\t裡"), 1);
    });
  });

  describe("openCcDefault", () => {
    it("gives the first value as the default", () => {
      const table = parseOpenCcTable(SAMPLE);
      assertIdentical(openCcDefault(table, "樑"), "梁");
      assertIdentical(openCcDefault(table, "只"), "只");
    });

    it("gives undefined for a character the table has no opinion on", () => {
      const table = parseOpenCcTable(SAMPLE);
      assertUndefined(openCcDefault(table, "好"));
    });

    it("gives the character itself where the table says it is standard", () => {
      const table = parseOpenCcTable(SAMPLE);
      const found = openCcDefault(table, "梁");
      assertNonNullable(found);
      assertIdentical(found, "梁");
    });
  });
});
