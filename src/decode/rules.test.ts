import {
  dictionaryOf,
  entry,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { allEdges, buildLattice, type LatticeEdge } from "./lattice.js";
import {
  applyEdgeRules,
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
  wordStartingAt,
} from "./rules.js";

const dictionary = sampleDictionary();

/**
 * A rule giving one verdict to every edge whose text matches.
 */
function ruleFor(
  text: string,
  verdict: "forbid" | "force",
  reading?: string,
): EdgeRule {
  return {
    name: `${verdict}-${text}`,
    verdictFor: ({ edge }: EdgeContext) =>
      edge.text === text &&
      (reading === undefined || edge.reading[0]?.final === reading)
        ? verdict
        : "keep",
  };
}

/**
 * The edges of a run once the rules have had it.
 */
function ruled(
  run: string,
  rules: readonly EdgeRule[],
): readonly LatticeEdge[] {
  return allEdges(
    applyEdgeRules(buildLattice(dictionary, run), dictionary, rules),
  );
}

describe("edge rules", () => {
  it("leaves the lattice alone when there are no rules", () => {
    const lattice = buildLattice(dictionary, "银行");
    assertIdentical(applyEdgeRules(lattice, dictionary, []), lattice);
  });

  it("leaves the lattice alone when no rule has an opinion", () => {
    const lattice = buildLattice(dictionary, "银行");
    assertIdentical(
      applyEdgeRules(lattice, dictionary, [ruleFor("北京", "forbid")]),
      lattice,
    );
  });

  it("forbids the edges a rule rejects", () => {
    const edges = ruled("北京银行", [ruleFor("银行", "forbid")]);
    assertTrue(edges.every((edge) => edge.text !== "银行"));
    // The characters are still there to be read on their own.
    assertTrue(edges.some((edge) => edge.text === "银"));
  });

  it("forces an edge by forbidding the rivals covering the same characters", () => {
    // 行 offers xíng, háng and héng at that position; forcing one leaves it
    // alone there, and leaves the word 银行 over the pair untouched.
    const edges = ruled("银行", [ruleFor("行", "force", "ang")]);
    const single = edges.filter((edge) => edge.text === "行");
    assertArrayLength(single, 1);
    const [only] = single;
    assertNonNullable(only);
    assertIdentical(only.reading[0]?.final, "ang");
    assertTrue(edges.some((edge) => edge.text === "银行"));
  });

  it("keeps both readings when two rules force the same span", () => {
    const edges = ruled("银行", [
      ruleFor("行", "force", "ang"),
      ruleFor("行", "force", "ing"),
    ]);
    assertArrayLength(
      edges.filter((edge) => edge.text === "行"),
      2,
    );
  });

  it("takes the first verdict a rule has, in order", () => {
    const edges = ruled("北京银行", [
      ruleFor("银行", "force"),
      ruleFor("银行", "forbid"),
    ]);
    assertTrue(edges.some((edge) => edge.text === "银行"));
  });

  it("discards the rules rather than strand a run with no path", () => {
    // Forbidding the only edge over 囧 would leave the run undecodable, so the
    // lattice the decode gets is the one the rules never touched.
    const stranding = ruleFor("囧", "forbid");
    const lattice = buildLattice(dictionary, "囧");
    assertIdentical(applyEdgeRules(lattice, dictionary, [stranding]), lattice);
  });

  it("allows a position to be emptied where another edge spans it", () => {
    // 玩儿 covers both characters, so forbidding 儿 on its own strands nothing.
    const edges = ruled("玩儿", [ruleFor("儿", "forbid")]);
    assertTrue(edges.every((edge) => edge.text !== "儿"));
    assertTrue(edges.some((edge) => edge.text === "玩儿"));
  });
});

describe("what a rule can ask about its neighbours", () => {
  const words = dictionaryOf([
    entry("我", "wǒ", { partOfSpeech: "r" }),
    entry("走", "zǒu", { partOfSpeech: "v" }),
    entry("北", "běi"),
    entry("京", "jīng"),
    entry("北京", "běi jīng", { partOfSpeech: "ns" }),
  ]);
  const context = (run: string): EdgeContext => {
    const lattice = buildLattice(words, run);
    const [edge] = lattice.edges[0] ?? [];
    assertNonNullable(edge);
    return { dictionary: words, characters: lattice.characters, edge };
  };

  it("finds the longest word ending at a position", () => {
    assertIdentical(wordEndingAt(context("北京走"), 2), "北京");
  });

  it("finds the longest word starting at a position", () => {
    assertIdentical(wordStartingAt(context("我北京"), 1), "北京");
  });

  it("reports nothing where there is no word", () => {
    assertIdentical(wordEndingAt(context("我走"), 0), undefined);
    assertIdentical(wordStartingAt(context("走囧"), 1), undefined);
  });

  it("reports nothing past the end of the run", () => {
    // Where a 得 closes a sentence there is no following word to ask about.
    assertIdentical(wordStartingAt(context("我走"), 2), undefined);
  });

  it("reports a word's part of speech, and nothing for no word", () => {
    assertArrayEquals(
      [
        tagOf(context("我走"), "我"),
        tagOf(context("我走"), undefined),
        tagOf(context("我走"), "囧"),
      ],
      ["r", "", ""],
    );
  });
});
