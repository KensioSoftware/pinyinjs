/**
 * The 儿 that belongs to the word in front of it.
 */
import type { EdgeContext, EdgeRule } from "./rules.js";

/**
 * 儿 does not stand on its own where the dictionary attests the 儿化.
 *
 * 儿化 is a per-word dictionary fact taken from CC-CEDICT's explicit `r5`
 * token, and 2,009 of the 2,067 keys ending in 儿 carry it. What that leaves is
 * an edge: 这边儿, 上边儿 and 旁边儿 are all listed and 那边儿 is not, so
 * 我得跑到那边儿去 read the 儿 as a syllable of its own — `nàbian ér` — and the
 * decode was choosing between 那边 plus 儿 and 那 plus 边儿 on frequency alone.
 *
 * This forbids the bare 儿 edge when the character in front of it makes an
 * attested 儿化 word, so the only paths left are the ones that absorb it. That
 * asserts nothing the dictionary does not already say — 边儿 is `biānr` because
 * CC-CEDICT says so — which is what separates it from synthesising 儿化 with a
 * suffix rule, the thing ORTHOGRAPHY.md rejects and the old project got wrong.
 *
 * Measured over the same 88,866 lines it fires 7 times, and all 7 are right:
 * 照片儿, 出门儿, 热点儿, 辣味儿, 晚会儿, 针管儿, 碍事儿. It is deliberately
 * silent on the 20 bare 儿 with no attested 儿化 behind them, which are 马儿,
 * 门铃儿 and a row of Mongol names transliterated with 儿.
 */
export const ATTESTED_ERHUA: EdgeRule = {
  name: "attested-erhua",
  verdictFor: (context: EdgeContext) => {
    const { characters, edge } = context;
    if (edge.text !== "儿" || edge.from === 0) {
      return "keep";
    }
    /* c8 ignore next -- the edge starts inside the run it was built from */
    const absorbed = `${characters[edge.from - 1] ?? ""}儿`;
    const reading = context.dictionary.lookup(absorbed)?.reading;
    return (reading?.at(-1)?.erhua ?? false) ? "forbid" : "keep";
  },
};
