import { assertIdentical, assertNumberToNearest } from "@kensio/smartass";
import { describe, it } from "vitest";

import { emptyTally, report, scoreCase } from "./score.js";

/**
 * Score a single conversion and reduce it straight to percentages.
 */
function scoreOne(expected: string, actual: string) {
  return report(scoreCase(expected, actual));
}

describe("accuracy scoring", () => {
  describe("a perfect conversion", () => {
    it("scores full marks on every measure", () => {
      const scores = scoreOne(
        "Wǒ yào qù Běijīng wánr.",
        "Wǒ yào qù Běijīng wánr.",
      );
      assertIdentical(scores.exact, 100);
      assertIdentical(scores.readings, 100);
      assertIdentical(scores.bases, 100);
      assertIdentical(scores.tones, 100);
      assertIdentical(scores.capitals, 100);
      assertIdentical(scores.spacing, 100);
    });
  });

  describe("readings and spacing are scored separately", () => {
    it("scores every reading correct but penalises the unjoined word", () => {
      // 北京 read right but written as two words instead of one, and the
      // proper noun left uncapitalised.
      const scores = scoreOne(
        "Wǒ yào qù Běijīng wánr.",
        "wǒ yào qù běi jīng wánr.",
      );
      assertIdentical(scores.readings, 100);
      assertIdentical(scores.bases, 100);
      assertNumberToNearest(scores.spacing, 90.9, 0.1);
      assertNumberToNearest(scores.capitals, 66.7, 0.1);
      assertIdentical(scores.exact, 0);
    });

    it("scores spacing correct but readings wrong when only the reading slips", () => {
      const scores = scoreOne("yínháng", "yínxíng");
      assertIdentical(scores.spacing, 100);
      assertIdentical(scores.bases, 50);
      assertIdentical(scores.readings, 50);
    });
  });

  describe("tones are separable from the reading beneath them", () => {
    it("counts a wrong tone as a right base and a wrong reading", () => {
      const scores = scoreOne("hǎo", "hào");
      assertIdentical(scores.bases, 100);
      assertIdentical(scores.readings, 0);
      assertIdentical(scores.tones, 0);
    });

    it("reports tone accuracy relative to correctly read syllables", () => {
      // Three syllables: yín right, háng read wrong entirely, jiù read right
      // but toned wrong. So two of three bases land, one of three readings, and
      // of the two syllables that were read right, one carries the right tone.
      const scores = scoreOne("yínháng jiù", "yínxíng jiu");
      assertNumberToNearest(scores.bases, 66.7, 0.1);
      assertNumberToNearest(scores.readings, 33.3, 0.1);
      assertIdentical(scores.tones, 50);
    });
  });

  describe("alignment", () => {
    it("keeps the penalty proportional when a syllable is dropped", () => {
      // Dropping one syllable should cost one syllable, not everything after it.
      const scores = scoreOne("wǒ yào qù Běijīng", "wǒ qù Běijīng");
      assertNumberToNearest(scores.bases, 80, 0.1);
      assertNumberToNearest(scores.readings, 80, 0.1);
    });

    it("charges for an invented syllable as much as for a dropped one", () => {
      const scores = scoreOne("wǒ qù Běijīng", "wǒ yào qù Běijīng");
      assertNumberToNearest(scores.bases, 80, 0.1);
      assertNumberToNearest(scores.readings, 80, 0.1);
    });
  });

  describe("tallies", () => {
    it("starts empty", () => {
      const tally = emptyTally();
      assertIdentical(tally.cases, 0);
      assertIdentical(report(tally).readings, 0);
    });

    it("accumulates across cases so a run can be summed", () => {
      const tally = emptyTally();
      scoreCase("hǎo", "hǎo", tally);
      scoreCase("hǎo", "hào", tally);
      assertIdentical(tally.cases, 2);
      assertIdentical(tally.exact, 1);
      assertIdentical(report(tally).readings, 50);
      assertIdentical(report(tally).bases, 100);
    });
  });

  describe("input that is not pinyin", () => {
    it("degrades rather than throwing", () => {
      const scores = scoreOne("hǎo", "???");
      assertIdentical(scores.readings, 0);
    });
  });
});
