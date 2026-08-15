/**
 * The grouping rules that work from a list of words rather than from a tag.
 *
 * The spaced-word list, the 老/小 address prefixes and the 姓名 division all
 * ask what a word *is* rather than what jieba called it, which is why they
 * sit apart from the aspect and suffix rules.
 */
import type { DecodedWord } from "../decode/word.js";
export { ADDRESS_PREFIX } from "./address-grouping.js";
import { characterCount, toCharacters } from "../script/characters.js";
import { divideAt, type GroupingRule } from "./rule.js";
import { LONGEST_SPACED_WORD, SPACED_WORD_FORMS } from "./word-list.js";

/**
 * The character span each decoded word covers, in order.
 */
function spansOf(
  words: readonly DecodedWord[],
): readonly { readonly at: number; readonly word: DecodedWord }[] {
  let at = 0;
  return words.map((word) => {
    const span = { at, word };
    at += toCharacters(word.text).length;
    return span;
  });
}

/**
 * Rewrite the words covering a span into the parts the standard writes.
 *
 * The readings are redistributed by character count, so this only applies where
 * every covered word reads one syllable per character. 儿化 cannot be
 * redistributed and is left alone.
 */
function respace(
  covered: readonly DecodedWord[],
  parts: readonly string[],
): readonly DecodedWord[] | undefined {
  const reading = covered.flatMap((word) => [...word.reading]);
  const characters = covered.flatMap((word) => toCharacters(word.text));
  if (reading.length !== characters.length) {
    return undefined;
  }
  const head = covered[0];
  /* c8 ignore next 3 -- the caller only passes a span it matched */
  if (head === undefined) {
    return undefined;
  }

  let at = 0;
  return parts.map((part) => {
    const length = toCharacters(part).length;
    const written = {
      text: part,
      reading: reading.slice(at, at + length),
      isProperNoun: head.isProperNoun,
      partOfSpeech: head.partOfSpeech,
      isKnown: head.isKnown,
    };
    at += length;
    return written;
  });
}

/**
 * The longest listed form starting at a word, with how many words it consumed.
 *
 * Longest-first, so 一个人 would beat 一个 if both were listed. A listed entry
 * has to end on a word boundary too: it is a claim about whole words, not
 * about the middle of one.
 */
function longestListedFrom(
  spans: readonly { readonly at: number; readonly word: DecodedWord }[],
  index: number,
):
  | { readonly written: readonly DecodedWord[]; readonly consumed: number }
  | undefined {
  for (let end = spans.length; end > index; end--) {
    const covered = spans.slice(index, end).map((span) => span.word);
    const text = covered.map((word) => word.text).join("");
    if (characterCount(text) <= LONGEST_SPACED_WORD) {
      const parts = SPACED_WORD_FORMS.get(text);
      const written = parts === undefined ? undefined : respace(covered, parts);
      if (written !== undefined) {
        return { written, consumed: end - index - 1 };
      }
    }
  }
  return undefined;
}

/**
 * Write the words GB/T 16159 spaces in a way no rule reaches.
 *
 * Matches longest-first at each word boundary, and only where the entry ends on
 * a word boundary too: a table entry is a claim about a whole word or several,
 * not about the middle of one.
 */
export const SPACED_WORD_LIST: GroupingRule = {
  name: "spaced-word-list",
  apply: (words) => {
    const spans = spansOf(words);
    const grouped: DecodedWord[] = [];

    for (let index = 0; index < spans.length; index++) {
      const start = spans[index];
      /* c8 ignore next 3 -- index stays inside the array */
      if (start === undefined) {
        continue;
      }
      const matched = longestListedFrom(spans, index);
      grouped.push(...(matched?.written ?? [start.word]));
      index += matched?.consumed ?? 0;
    }

    return grouped;
  },
};

const DIVIDED_TAGS = new Set(["nr", "nt"]);

/**
 * The parts of a proper name are written apart: 齐白石 is `Qí Báishí`.
 *
 * GB/T 16159 5.1 writes 姓 apart from 名 and a proper noun apart from its
 * generic, each part capitalised. Both halves of that clause are this rule,
 * because the evidence for them is the same evidence.
 *
 * 齐白石 and 北京大学 are dictionary entries, so the decoder produces **one**
 * word each — and reading them as one word is what makes them read correctly at
 * all. That makes this a *split*, and splitting contradicts the dictionary's own
 * claim that the characters belong together. It needs a condition strong enough
 * to survive the whole dictionary, and the obvious ones are not: a surname list
 * takes 马克思, 高尔基, 巴赫 and 牛顿 apart, none of which is a Chinese name,
 * and a list of generics cannot say where 上海浦东发展银行 divides.
 *
 * **The condition is CC-CEDICT's own capitalisation**, which states the
 * boundaries outright: 齐白石 is `[Qi2 Bai2 shi2]`, 司马迁 `[Si1 ma3 Qian1]`,
 * 上海交通大学 `[Shang4 hai3 Jiao1 tong1 Da4 xue2]`, and 马克思 `[Ma3 ke4 si1]`
 * with no second capital at all. So a compound surname is recognised without a
 * list of compound surnames, a generic without a list of generics, and a
 * transliteration is excluded without a list of transliterations. It is the same
 * source and the same signal the proper-noun veto already trusts — see "jieba's
 * 专名 tags need a second opinion" in ROADMAP.md — extended from *whether* a
 * word is a proper noun to *where* its parts divide.
 *
 * **Every stated boundary is cut, not only the first**, which is what separates
 * an organisation from a person: 48% of `nt` entries carrying a boundary carry
 * more than one, against 1.6% of `nr`. One cut would leave 上海交通大学 as
 * `Shànghǎi Jiāotōngdàxué`.
 *
 * A tag is still required, because the mark is not confined to what 5.1 covers:
 * 5,341 `ns` entries carry one, where `PLACE_GENERICS` already applies a
 * measured condition, and `nz` carries 346 of which 第二次世界大战
 * `[Di4 er4 Ci4 Shi4 jie4 Da4 zhan4]` divides in the wrong place. Both are
 * measured out in `docs/orthography/`.
 */
export const NAME_PARTS: GroupingRule = {
  name: "name-parts",
  apply: (words, dictionary) =>
    words.flatMap((word) => {
      const boundaries = dictionary.lookup(word.text)?.nameBoundaries ?? [];
      if (boundaries.length === 0 || !word.isProperNoun) {
        return [word];
      }
      if (!DIVIDED_TAGS.has(word.partOfSpeech)) {
        return [word];
      }
      const parts = divideAt(word, boundaries);
      // Every part is a proper noun in its own right, so each takes a capital:
      // `Qí Báishí`, `Běijīng Dàxué`.
      return parts.map((part) => ({ ...part, isProperNoun: true }));
    }),
};
