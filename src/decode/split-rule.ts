/**
 * How a 离合词 is read once a 量词 has been pushed into the middle of it.
 *
 * 请假 is one word and carries one reading. 请个假 is the same word with a
 * classifier inside it, and the halves are left standing on their own.
 */
import { isSameSyllable } from "../dictionary/entry.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordsStartingAt,
} from "./rules.js";

/**
 * The classifier that separates the halves, in both scripts.
 *
 * 个 alone, and the measurement below is the reason. Every other 量词 was tried
 * and the noise buried the signal. The dictionary tags 道, 名, 家, 子, 口 and 集
 * `q` too, and those spend almost all of their time as ordinary morphemes, so
 * 知道了 read its 了 as `liǎo` off 知了 and 有道理 its 理 as `lǐ` off 有理.
 * Widening to the whole `q` tag carries the rule from 3 firings to 109, of
 * which 46 are that one 知道了.
 *
 * 下 and 回 are outside it for a different reason. Both separate a compound
 * readily enough, but both also head a directional complement, and 坐下来,
 * 拿回来 and 生下来 all end in a 来 that is neutral where the compound behind
 * them says `lái`. Adding the pair costs 34 wrong firings to gain none.
 */
const CLASSIFIER = new Set(["个", "個"]);

/**
 * The tag prefix jieba gives a verb.
 *
 * A prefix, so that `vn` and `vd` are in. 有空 is tagged `vn`.
 */
const VERB_TAG = "v";

/**
 * The two halves a classifier separates at a position, or undefined.
 *
 * The position is one half of the pair and the classifier says which. A 个 in
 * front of it makes it the tail, and a 个 behind it makes it the head. Both are
 * wanted, because either half can be the polyphone. 请个假 misreads the 假 and
 * 弹个琴 the 弹.
 */
function separatedAt(
  context: EdgeContext,
  at: number,
): { readonly word: string; readonly offset: number } | undefined {
  const { characters } = context;
  if (CLASSIFIER.has(characters[at + 1] ?? "") && at + 2 < characters.length) {
    return {
      /* c8 ignore next -- both positions are inside the run just measured */
      word: `${characters[at] ?? ""}${characters[at + 2] ?? ""}`,
      offset: 0,
    };
  }
  if (CLASSIFIER.has(characters[at - 1] ?? "") && at >= 2) {
    return {
      /* c8 ignore next -- both positions are inside the run just measured */
      word: `${characters[at - 2] ?? ""}${characters[at] ?? ""}`,
      offset: 1,
    };
  }
  return undefined;
}

/**
 * Whether a tagged word of more than one character starts at a position.
 *
 * The guard that keeps the rule off a 个 that is counting the word after it.
 * 我看见那儿有个奇怪的女人 has 有奇 behind it, a key meaning *and a fraction
 * more*, and forcing its `jī` onto a 奇 that opens 奇怪 is the one wrong firing
 * the corpus offers. A tag is asked for and not merely a key, because the full
 * tier holds 720,000 of them and 打个折么 finds 折么 that way. The tag is the
 * record that somebody counted the word.
 */
function opensTaggedWord(context: EdgeContext, at: number): boolean {
  return wordsStartingAt(context, at).some(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * The syllable a separated compound gives one of its halves, or undefined.
 *
 * Three things have to hold, and each one is carrying its weight over the
 * corpus. The pair has to be a word the dictionary tags, since an untagged key
 * is a reading somebody recorded rather than a word anybody counted, and
 * 是个甚么 finds 是甚 that way and would read its 甚 as `shèn`. The character in
 * front has to be a verb. That is what separates 请个假 from 一个只, 两个都 and
 * 八个行, where the 个 counts the numeral in front of it and the pair behind is
 * an accident. And the far half has to stand clear of a tagged word of its own,
 * for the reason {@link opensTaggedWord} gives.
 */
function separatedSyllableAt(
  context: EdgeContext,
  at: number,
): Syllable | undefined {
  const separated = separatedAt(context, at);
  if (separated === undefined) {
    return undefined;
  }
  const { word, offset } = separated;
  const entry = context.dictionary.lookup(word);
  if (entry?.reading.length !== 2 || entry.partOfSpeech === "") {
    return undefined;
  }
  const [head = ""] = toCharacters(word);
  if (!tagOf(context, head).startsWith(VERB_TAG)) {
    return undefined;
  }
  const tail = offset === 1 ? at : at + 2;
  return opensTaggedWord(context, tail) ? undefined : entry.reading[offset];
}

/**
 * Whether a pair the dictionary holds carries the unseparated reading across.
 *
 * Forcing the single-character edge settles nothing on its own, for the reason
 * {@link TEACHING_JIAO} gives. A reading spanning two characters brings its own
 * half with it. 能给我打个折么 read `shémǒ` off 折么, a key the dictionary holds
 * with no part of speech and at the cost of a word nothing has ever counted.
 * A *tagged* word is left alone, which is every one that matters.
 */
function carriesReading(
  context: EdgeContext,
  edge: EdgeContext["edge"],
): boolean {
  if (edge.partOfSpeech !== "" || edge.reading.length !== edge.to - edge.from) {
    return false;
  }
  return edge.reading.some((syllable, offset) => {
    const said = separatedSyllableAt(context, edge.from + offset);
    return said !== undefined && !isSameSyllable(syllable, said);
  });
}

/**
 * A 离合词 keeps its reading when a 量词 is pushed into the middle of it.
 *
 * 请假 is `qǐngjià` and 请个假 came out `qǐng gè jiǎ`, because the word the
 * reading hangs on is no longer there to be matched and each half falls back on
 * its character's default. 睡个觉 went to `jué`, 弹个琴 to `dàn`, 教个书 to
 * `jiào` and 有个空 to `kōng`, all of them the reading the compound exists to
 * rule out. Nothing here is new about the characters. The dictionary already
 * holds `jià` as an alternate of 假 and already states that 请假 is `qǐng jià`.
 * What was missing is that the second fact reaches the first across a 个.
 *
 * A 离合词 is a verb and its object written as one word, so the halves come
 * apart and take an infix between them the way no other compound does. The
 * classifier is the commonest infix, and that is what makes the shape
 * decidable. See {@link separatedSyllableAt} for the three conditions and
 * {@link CLASSIFIER} for why no other 量词 is in.
 *
 * Both halves are settled, because either can be the polyphone. 请个假 and
 * 睡个觉 misread the tail, 弹个琴 and 教个书 the head.
 *
 * Measured over the same 88,866 lines of Tatoeba and zh.wikipedia the other
 * rules were sized against, 2,018 head-个-tail shapes have a dictionary pair
 * behind them. The conditions admit 3 and all 3 are corrections (请个假 to
 * `jià`, 打个折 to `zhé` and 睡個覺 to `jiào`). The 66 they decline are pairs the
 * index happens to hold (两个都 off 两都, 一个和 off 一和, 那个是 off 那是,
 * 一个只 off 一只), where no word was ever split in two, and the verb-head
 * condition alone accounts for 44 of them.
 *
 * The one real firing given up is 瞅个空 for `kòng`, which 瞅空 would carry if
 * an untagged pair were allowed to. It goes with 是个甚, and that trade is the
 * right way round, since the corpus has one of each and admitting untagged
 * pairs opens the rule to 720,000 keys nobody counted.
 *
 * The measurement is thin because the shape is rare in written text, so the
 * conditions were sized against the dictionary as well. 2,994 tagged pairs with
 * a verb in front hold a half whose reading differs from its character's
 * default, and they are led by 认为, 获得, 关系 and 告诉, none of which any 个
 * can be pushed into. The rule never reaches them, since it fires on a 个 that
 * is written rather than on a pair that exists.
 */
export const SEPARATED_COMPOUND: EdgeRule = {
  name: "separated-compound",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.to - edge.from !== 1 || edge.reading.length !== 1) {
      return carriesReading(context, edge) ? "forbid" : "keep";
    }
    const said = separatedSyllableAt(context, edge.from);
    const here = edge.reading[0];
    /* c8 ignore next -- a one-syllable reading has a syllable at zero */
    if (said === undefined || here === undefined) {
      return "keep";
    }
    return isSameSyllable(here, said) ? "force" : "keep";
  },
};
