import type { Dictionary } from "../dictionary/dictionary.js";
import type { DecodedWord } from "../decode/word.js";
import { characterCount, toCharacters } from "../script/characters.js";
import { IDIOM_HYPHENS } from "./idioms.js";
import { AABB_REDUPLICATION, ABAB_REDUPLICATION } from "./reduplication.js";
import { divideAt, type GroupingRule, join, splitAt } from "./rule.js";
import { LONGEST_SPACED_WORD, SPACED_WORD_FORMS } from "./word-list.js";

/**
 * jieba's tags for the aspect particles 了, 着 and 过.
 */
const ASPECT_TAGS = new Set(["ul", "uz", "ug"]);

/**
 * Whether a word is one an aspect particle can attach to.
 *
 * jieba's verb tags all begin `v`; an adjective takes one too, as 好了 does.
 * Anything else in front of a 了 is a sentence-final 了 rather than an aspect
 * marker, and is written on its own: 我还给你了 is `Wǒ huán gěi nǐ le`, not
 * `nǐle`.
 */
function isAspectHost(word: DecodedWord): boolean {
  return word.partOfSpeech.startsWith("v") || word.partOfSpeech === "a";
}

/**
 * jieba's tag for a suffix, which is what 们 and 者 are.
 */
const SUFFIX_TAG = "k";

/**
 * The generic half of an administrative place name.
 *
 * Both scripts, since a 繁體 name is a key in its own right and never converted
 * before lookup.
 */
const ADMINISTRATIVE_GENERICS = new Set([
  "市",
  "省",
  "县",
  "縣",
  "区",
  "區",
  "镇",
  "鎮",
  "乡",
  "鄉",
  "村",
  "州",
]);

/**
 * Fold every word a predicate accepts into the word before it.
 */
function joinBackwards(
  words: readonly DecodedWord[],
  isAttached: (word: DecodedWord, head: DecodedWord) => boolean,
): readonly DecodedWord[] {
  const grouped: DecodedWord[] = [];
  for (const word of words) {
    const head = grouped.at(-1);
    if (head !== undefined && isAttached(word, head)) {
      grouped[grouped.length - 1] = join(head, word);
      continue;
    }
    grouped.push(word);
  }
  return grouped;
}

/**
 * 了, 着 and 过 attach to the verb in front of them.
 *
 * GB/T 16159: 他看了 is `tā kànle`, not `tā kàn le`. Safe as a rule because it
 * only ever joins what the decode had already separated — the dictionary has no
 * entry for 看了, so nothing the dictionary asserted is being overridden. The
 * readings do not change either way, so the worst case is untidy spacing.
 */
export const ASPECT_PARTICLES: GroupingRule = {
  name: "aspect-particles",
  apply: (words) =>
    joinBackwards(
      words,
      (word, head) => ASPECT_TAGS.has(word.partOfSpeech) && isAspectHost(head),
    ),
};

/**
 * A suffix attaches to the word in front of it.
 *
 * 我们 is `wǒmen`, 作者 is `zuòzhě`. Same reasoning as the aspect particles: a
 * suffix that reached the decode as a word of its own was not in the
 * dictionary attached to anything.
 */
export const SUFFIXES: GroupingRule = {
  name: "suffixes",
  apply: (words) =>
    joinBackwards(words, (word) => word.partOfSpeech === SUFFIX_TAG),
};

/**
 * A place name's generic half is written separately, and capitalised.
 *
 * GB/T 16159 专名和通名分写: 南京市 is `Nánjīng Shì`, 西湖区 is `Xīhú Qū`.
 *
 * Two conditions keep it from running away, both of them measured against the
 * whole dictionary rather than guessed. The word must be tagged a place name,
 * and **the part before the generic must itself be a word** — without the
 * second, 上山下乡 and 三街六市 are tagged `ns` and come apart as
 * `Shàngshānxià Xiāng` and `Sānjiēliù Shì`. Together they fire on 4,798 of the
 * dictionary's 8,781 candidates and hold back 427.
 *
 * The rule deliberately never touches a two-character name, so 上海 stays
 * `Shànghǎi` and 长城 stays `Chángchéng`: there, the generic character is part
 * of the proper name rather than a description of it, and no rule can tell the
 * two apart — 黄河 is `Huáng Hé` and 青海 is `Qīnghǎi`.
 */
export const PLACE_GENERICS: GroupingRule = {
  name: "place-generics",
  apply: (words, dictionary) =>
    words.flatMap((word) => {
      const characters = toCharacters(word.text);
      const generic = characters.at(-1) ?? "";
      if (
        word.partOfSpeech !== "ns" ||
        characters.length < 3 ||
        !ADMINISTRATIVE_GENERICS.has(generic) ||
        dictionary.lookup(characters.slice(0, -1).join("")) === undefined
      ) {
        return [word];
      }
      const split = splitAt(word, characters.length - 1);
      if (split === undefined) {
        return [word];
      }
      // Both halves are capitalised: 通名 is part of the name, not a common
      // noun trailing it.
      return split.map((part) => ({ ...part, isProperNoun: true }));
    }),
};

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

/**
 * The 称呼语 GB/T 16159 writes in front of a surname.
 *
 * 老 and 小 only. 大 is written the same way in 大李, but it is also an ordinary
 * adjective in front of anything at all, and it is the one that goes wrong:
 * over 88,866 lines the three of them fire 49 times together and both clear
 * mistakes are 大 — 泡大池 is a big pool and 那头大熊 is a big bear. Dropping it
 * leaves 38 firings and every one visible in the sample is a real form of
 * address.
 */
const ADDRESS_PREFIXES = new Set(["老", "小"]);

/**
 * 老王 is `Lǎo Wáng`: the prefix takes a capital of its own.
 *
 * The words are already written apart — nothing here moves a boundary — and
 * what was missing is only the capital, so this marks the prefix a proper noun
 * and lets the writer do what it already does with one. That is why it is a
 * grouping rule despite grouping nothing: `isProperNoun` is the flag the
 * capital hangs off, and there is one place it is set.
 *
 * The surname is the evidence. A one-character word the dictionary marks a
 * proper noun is what 老 and 小 attach to, and CC-CEDICT's capitalisation has
 * already vetoed the tags that would otherwise let 小 in front of anything —
 * see "jieba's 专名 tags need a second opinion" in ROADMAP.md.
 */
export const ADDRESS_PREFIX: GroupingRule = {
  name: "address-prefix",
  apply: (words) =>
    words.map((word, at) => {
      const next = words[at + 1];
      if (
        !ADDRESS_PREFIXES.has(word.text) ||
        next === undefined ||
        !next.isProperNoun ||
        characterCount(next.text) !== 1 ||
        next.separator !== undefined
      ) {
        return word;
      }
      return { ...word, isProperNoun: true };
    }),
};

/**
 * jieba's tags for the two kinds of proper noun 5.1 divides.
 *
 * A person and an organisation. Places are `PLACE_GENERICS`' business, and `nz`
 * is left out — both are measured out in `docs/orthography/`.
 */
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

/**
 * The rules applied by default, in order.
 *
 * The hyphens come last, because every rule before them moves word boundaries
 * and a hyphen is a statement about where a boundary ended up.
 */
export const GROUPING_RULES: readonly GroupingRule[] = [
  ASPECT_PARTICLES,
  SUFFIXES,
  PLACE_GENERICS,
  NAME_PARTS,
  SPACED_WORD_LIST,
  ADDRESS_PREFIX,
  AABB_REDUPLICATION,
  ABAB_REDUPLICATION,
  IDIOM_HYPHENS,
];

/**
 * Run the 分词连写 rules over a decoded run.
 */
export function applyGrouping(
  words: readonly DecodedWord[],
  dictionary: Dictionary,
  rules: readonly GroupingRule[] = GROUPING_RULES,
): readonly DecodedWord[] {
  let grouped = words;
  for (const rule of rules) {
    grouped = rule.apply(grouped, dictionary);
  }
  return grouped;
}
