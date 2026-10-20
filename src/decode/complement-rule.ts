/**
 * The rules for a 得 marking a complement, where a dictionary word would read
 * it `dé`.
 */
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordEndingAt,
  wordStartingAt,
} from "./rules.js";

/**
 * The tags a word carries when the 得 after it marks a complement.
 *
 * A verb or an adjective: 冻得直发抖, 累得直喘, 吹得直响. Nouns are left out,
 * though jieba tags 气 as one and 他气得直跺脚 is the same sentence. A noun is
 * also what stands before a modal 得 or one meaning "to get", and including
 * them read 多音字得看句子 with `de` where it is `děi`.
 */
const COMPLEMENTED_TAGS = /^(?:v|a)/u;

/**
 * A word beginning with 得 does not start where a complement 得 does.
 *
 * The same fault {@link import("./de-rule.js").PARTICLE_DE} fixes for 的. The particle 得 attaches to
 * the verb or adjective in front of it, so a dictionary key spanning that 得
 * and the next character is describing some other sentence: 他冻得直发抖 came
 * out `dòng dé zhí` on the strength of 得直, read `dé zhí`, and 他冻得发抖 with
 * no 直 was right all along.
 *
 * Only a key no source has tagged is forbidden. 得到, 得出 and 得体 are words
 * jieba counted, and a verb can stand before each of them as a verb of its own
 * (才能得到服务, 表现得体). The untagged keys carry a reading somebody asserted
 * for 得 at the head of a phrase, which is mostly `dé` or `děi`, and neither is
 * the reading after a verb.
 *
 * Over the 88,612 sentences of Tatoeba and the 43,367 Chinese Boost 例句 it
 * changes 5 runs in the full tier: 震得直响, 吹得直响, 吹得直晃 and 累得直喘,
 * each now `de`, and 怕得工夫肯略來看覷我麼, where the 得 was already `de` and
 * 工夫 now takes its neutral tone. The core and standard tiers do not change.
 */
export const COMPLEMENT_DE: EdgeRule = {
  name: "complement-de",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (
      edge.to - edge.from < 2 ||
      edge.partOfSpeech !== "" ||
      !edge.text.startsWith("得")
    ) {
      return "keep";
    }
    const before = wordEndingAt(context, edge.from);
    return COMPLEMENTED_TAGS.test(tagOf(context, before)) ? "forbid" : "keep";
  },
};

/** 算得, which is the same in both scripts. */
const SUAN_DE = "算得";

/**
 * What a complement of degree starts with: an adverb, a degree word, an
 * adjective, or the 跟 or 比 of a comparison.
 *
 * 算得很精细, 算得非常准确, 算得快, 算得跟他一样快. What follows 算得 meaning
 * "to count as" is a noun phrase or a verb, so 是, 什么 and 上 are not in it.
 */
const DEGREE_TAGS = /^(?:d|zg|a|p)/u;

/**
 * 算得 taken apart where it is 算 with a complement after it.
 *
 * jieba counted 算得 and tagged it a verb, read `suàn dé`, which is the word
 * meaning "to count as": 这算得什么. Calculating takes a complement like any
 * other verb, and 祖冲之把圆周率算得非常准确 came out `suàn dé fēicháng`. With
 * the word gone the 得 reads as the particle.
 *
 * {@link import("./de-rule.js").POTENTIAL_DE} already handles 算得上. Of the 11 sentences holding 算得
 * in Tatoeba and the Chinese Boost 例句, 7 are 算得上 and the other 4 are the
 * complement this rule reads: 算得很精细, 算得特别快, 算得非常准确 and
 * 算得跟他一样快. All 4 change, and nothing else does.
 */
export const CALCULATING_SUAN: EdgeRule = {
  name: "calculating-suan",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.text !== SUAN_DE) {
      return "keep";
    }
    const after = wordStartingAt(context, edge.to);
    return DEGREE_TAGS.test(tagOf(context, after)) ? "forbid" : "keep";
  },
};
