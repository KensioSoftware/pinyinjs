/**
 * Whether a 弹 is plucked or is a bullet.
 *
 * The two readings are a verb and a noun, so what settles it is what the word
 * beside it is doing rather than what the character is.
 */
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  ASPECT,
  PARTICLE_TAG,
  tagOf,
  wordEndingAt,
  wordStartingAt,
} from "./edge-context.js";
import type { EdgeContext, EdgeRule } from "./rules.js";

/**
 * Whether a syllable is `tán`, the verbal reading of 弹.
 */
export function isTan(syllable: Syllable | undefined): boolean {
  return (
    syllable?.initial === "t" && syllable.final === "an" && syllable.tone === 2
  );
}

/**
 * The character in both scripts, since 彈 is not the shape 弹 is.
 *
 * 得, 教 and 儿 are the same character in either script and need say it once.
 * This one is not, and neither is the 长 above, which is silent on 長 as a
 * result. {@link ASPECT} carries 過 and 著 for the same reason this carries 彈.
 */
export const PLUCKED = new Set(["弹", "彈"]);

/**
 * Whether the character at a position is 弹, in either script.
 */
export function isPluckedAt(context: EdgeContext, at: number): boolean {
  return PLUCKED.has(context.characters[at] ?? "");
}

/**
 * What a 弹 that is playing governs: the instrument, the piece or its composer.
 *
 * 弹吉他, 弹竖琴, 弹肖邦, 弹一曲, 给我们弹一手. The name tags are in because
 * jieba calls 吉他 `ns` and 管风琴, 班卓琴 and 古琴 `nr` — instruments read as
 * places and people — and `m` because a piece is as often counted as named.
 */
export const PLAYED_TAGS = new Set(["n", "nz", "nr", "ns", "nt", "ng", "m"]);

/**
 * Whether a word is an object rather than the far half of a compound.
 *
 * The one place this rule departs from {@link isTeachingAt}, and it is what
 * makes it usable on technical prose. 弹 joins bound morphemes into nouns far
 * more readily than 教 does — 着弹点, 掷弹兵, 供弹爪, 底排弹时, 弹洞 — and every
 * one of those puts a single tagged character after the 弹 where an object
 * would go. What the verb actually governs is a word: 吉他, 竖琴, 管风琴, 电子琴,
 * 一曲, 肖邦. Requiring two characters keeps the compounds out at the cost of
 * 反手持法去弹班卓琴, where the decode reaches 班 rather than 班卓琴 anyway.
 *
 * 教 could not take the same guard, since 教我 and 教你 are the commonest shape
 * it has. Nobody plays a pronoun, so `r` is out of {@link PLAYED_TAGS} too.
 */
function isPlayedObject(word: string | undefined): boolean {
  return word !== undefined && toCharacters(word).length > 1;
}

/**
 * Whether the 弹 at a position is playing something.
 *
 * Much the same shape as {@link isTeachingAt}, and for the same reason: the
 * object is what says so. A 弹 with an instrument, a tune or a name after it is
 * governing it, and a 弹 with 了, 过, 着 or 得 after it is a verb whatever
 * follows that. A particle in front of it rules it out, since a verb does not
 * follow one.
 */
function isPlayingAt(context: EdgeContext, at: number): boolean {
  if (tagOf(context, wordEndingAt(context, at)).startsWith(PARTICLE_TAG)) {
    return false;
  }
  if (ASPECT.has(context.characters[at + 1] ?? "")) {
    return true;
  }
  const played = wordStartingAt(context, at + 1);
  return isPlayedObject(played) && PLAYED_TAGS.has(tagOf(context, played));
}

/**
 * 弹 read as `tán` where it is playing rather than a projectile.
 *
 * The character is stored `dàn` with `tán` as an alternate, and the sources are
 * agreed about it: Unihan's `kHanyuPinlu` counts `dàn(313)` against `tán(50)`
 * and `kMandarin` names `dàn`. That is a fact about a corpus in which nearly
 * every 弹 is ammunition — 子弹, 炮弹, 导弹, 原子弹, 手榴弹 — and every one of
 * those is a word that carries its own reading. What the default is left
 * deciding is the 弹 that stands as a word of its own, and in running text that
 * one is the verb: 他会弹一点儿古筝 came out `dàn`, and 弹吉他, 弹竖琴, 我在弹肖邦
 * and 他钢琴弹得很好 with it.
 *
 * See {@link isPlayingAt} for what decides it. Forcing the single-character
 * edge is not enough on its own, for the reason {@link TEACHING_JIAO} gives: a
 * reading spanning two characters carries its own 弹 into the position, and
 * 我的爱好是开车和弹吉他 read `dàn` off 和弹, a pair the dictionary holds with
 * no part of speech and at the cost of a reading nobody counted. A *tagged*
 * word ending in 弹 is left alone, which is every one that matters — 子弹, 炸弹,
 * 导弹, 反弹, 手榴弹. Nothing has to be done about the other side, since the
 * nominal compounds starting with 弹 are all listed: 弹匣, 弹坑, 弹壳, 弹片,
 * 弹药, 弹道 and 弹头 reach their reading through the word, so a bare 弹 with a
 * noun after it is not the front of one that got away.
 *
 * The 88,866 lines of Tatoeba and zh.wikipedia the other rules were sized
 * against are the wrong corpus for this one on their own: 38 弹 decode as a
 * word of their own in them, and 31 are somebody playing something. So CPP's
 * 20,147 sentences are measured with them as plain text — the benchmark is
 * drawn from zh.wikipedia's military articles, which is precisely where the
 * shapes this rule can break live. Over the 109,013 lines together, 60 弹
 * decode as a word of their own, every one read `dàn`, and 34 of the 60 are
 * wrong.
 *
 * This moves 30 of them, of which 29 are right: the whole of 弹吉他, 弹一曲肖邦
 * and 钢琴弹得很好, and none of 南部弹, 毛瑟弹, 掷弹兵, 供弹爪, 着弹点, 弹洞 or
 * 底排弹时. The one it breaks is 拆弹专家, where a compound has an object's
 * shape on both sides. Five it leaves alone: 开始弹, 四手联弹 and 弹起三次, which
 * have no object to see, 用那种指法弹不会觉得费力, and 反手持法去弹班卓琴, where
 * the decode reaches 班 rather than 班卓琴. On CPP's 40 labelled 弹 nothing
 * moves at all, every one of them having been right through a word.
 */
export const PLAYING_TAN: EdgeRule = {
  name: "playing-tan",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (PLUCKED.has(edge.text)) {
      return isTan(edge.reading[0]) && isPlayingAt(context, edge.from)
        ? "force"
        : "keep";
    }
    return edge.partOfSpeech === "" &&
      isPluckedAt(context, edge.to - 1) &&
      edge.reading.length === edge.to - edge.from &&
      !isTan(edge.reading.at(-1)) &&
      isPlayingAt(context, edge.to - 1)
      ? "forbid"
      : "keep";
  },
};
